// 后端服务：静态托管 dist + 代理百度图像识别 / 通义千问
// API Key 只存在于服务端，前端不暴露
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BAIDU_API_KEY,
  BAIDU_SECRET_KEY,
  QWEN_API_KEY,
  QWEN_MODEL,
  PORT,
  missingEnv,
} from './config.js'

if (missingEnv.length) {
  console.error(`[startup] 缺少环境变量: ${missingEnv.join(', ')}`)
  console.error('[startup] 请在项目根目录创建 .env 并填入密钥（参考 .env.example）')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, '..', 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

// ---------- 百度 access_token 缓存 ----------
let tokenCache = { token: '', expiresAt: 0 }

async function getBaiduToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token
  const url =
    'https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials' +
    `&client_id=${encodeURIComponent(BAIDU_API_KEY)}` +
    `&client_secret=${encodeURIComponent(BAIDU_SECRET_KEY)}`
  const resp = await fetch(url, { method: 'POST' })
  const data = await resp.json()
  if (!data.access_token) throw new Error(`Baidu token failed: ${JSON.stringify(data)}`)
  tokenCache = {
    token: data.access_token,
    // 提前 5 分钟过期，避免边界失效
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  }
  return tokenCache.token
}

// ---------- 百度关键词 → 场景 key 映射 ----------
const SCENE_RULES = [
  { scene: 'subway', desc: '地铁站', keys: ['地铁', '站台', '列车', 'train', 'subway', 'platform'] },
  { scene: 'coffee_shop', desc: '咖啡店', keys: ['咖啡', 'coffee', 'cafe', 'latte', 'cup'] },
  { scene: 'office', desc: '办公室', keys: ['办公', '电脑', '键盘', '工位', 'office', 'desk', 'computer', 'keyboard'] },
  { scene: 'restaurant', desc: '餐厅', keys: ['餐厅', '食物', '美食', '饭', '菜', 'restaurant', 'food', 'meal'] },
  { scene: 'home', desc: '家里', keys: ['沙发', '床', '客厅', '家居', 'sofa', 'bed', 'living room'] },
]

function mapScene(keywords) {
  for (const kw of keywords) {
    const lower = String(kw).toLowerCase()
    for (const rule of SCENE_RULES) {
      if (rule.keys.some(k => lower.includes(k.toLowerCase()))) {
        return { scene: rule.scene, description: rule.desc }
      }
    }
  }
  return { scene: 'unknown', description: keywords[0] || '未知场景' }
}

// ---------- 场景识别 ----------
async function handleScene(body) {
  const image = body?.image
  if (!image) return { error: 'missing image' }

  const token = await getBaiduToken()
  const resp = await fetch(
    `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${encodeURIComponent(image)}&baike_num=0`,
    }
  )
  const data = await resp.json()
  if (data.error_code) throw new Error(`Baidu vision error ${data.error_code}: ${data.error_msg}`)

  const result = data.result || []
  if (!result.length) return { scene: 'unknown', description: '没认出来', confidence: 0 }

  const keywords = result.map(r => r.keyword).filter(Boolean)
  const mapped = mapScene(keywords)
  return {
    scene: mapped.scene,
    description: mapped.description,
    confidence: result[0].score || 0,
    keywords: keywords.slice(0, 5),
  }
}

// ---------- AI 英语生成 ----------
const TEMPLATES = {
  subway: ['This is a subway station.', 'Which line do you take?', "It's crowded today."],
  coffee_shop: ['I want a latte, please.', 'What time do you open?', "It's cold today."],
  office: ['Good morning!', 'How was your weekend?', 'I have a meeting at 10.'],
  restaurant: ['What would you like?', "I'm hungry.", 'The food is good.'],
  home: ["I'm at home now.", "I'm watching TV.", 'Good night!'],
  unknown: ['Hello! What is this?', 'Can you tell me?', 'Nice to see you!'],
}

function buildPrompt(scene, description, userReply) {
  return `You are a friendly English teacher for complete beginners (CEFR A1).
Scene: "${scene}" (${description || 'unknown'}).
Generate exactly 3 short English sentences about this scene, suitable to say out loud.
Rules: each sentence 10 words or fewer; only very common words; no numbering; no Chinese.
${userReply ? `The learner just said: "${userReply}". Reply naturally and keep the conversation going.` : ''}
Return only the 3 sentences, one per line.`
}

async function handleChat(body) {
  const scene = body?.scene || 'unknown'
  const description = body?.description || ''
  const userReply = body?.userReply || ''

  const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [{ role: 'user', content: buildPrompt(scene, description, userReply) }],
      max_tokens: 200,
      temperature: 0.7,
    }),
  })
  const data = await resp.json()

  if (data.error) {
    // 配额/限流等问题时降级到内置模板，保证前端流程不断
    return { sentences: TEMPLATES[scene] || TEMPLATES.unknown, fallback: true, reason: data.error.code || 'api_error' }
  }

  const text = data.choices?.[0]?.message?.content || ''
  const sentences = text
    .split('\n')
    .map(s => s.replace(/^[\d.\-*)\s]+/, '').trim())
    .filter(s => s && /[a-zA-Z]/.test(s))
    .slice(0, 3)

  if (!sentences.length) {
    return { sentences: TEMPLATES[scene] || TEMPLATES.unknown, fallback: true, reason: 'empty_response' }
  }
  return { sentences }
}

// ---------- 通用工具 ----------
function sendJson(res, code, obj) {
  const payload = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
      if (raw.length > 12 * 1024 * 1024) reject(new Error('body too large'))
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

async function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (pathname === '/') pathname = '/index.html'
  const filePath = path.join(DIST_DIR, pathname)

  // 防目录穿越
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  try {
    const info = await stat(filePath)
    if (info.isDirectory()) throw new Error('is dir')
    const content = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' })
    res.end(content)
  } catch {
    // SPA 回退
    try {
      const html = await readFile(path.join(DIST_DIR, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch {
      res.writeHead(404)
      res.end('Not Found')
    }
  }
}

// ---------- 服务入口 ----------
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x')

  if (pathname.startsWith('/api/')) {
    try {
      const body = req.method === 'POST' ? await readBody(req) : {}
      if (pathname === '/api/scene') {
        const result = await handleScene(body)
        return sendJson(res, 200, result)
      }
      if (pathname === '/api/chat') {
        const result = await handleChat(body)
        return sendJson(res, 200, result)
      }
      if (pathname === '/api/health') {
        return sendJson(res, 200, { ok: true })
      }
      return sendJson(res, 404, { error: 'not found' })
    } catch (err) {
      console.error('[api error]', pathname, err.message)
      return sendJson(res, 500, { error: err.message })
    }
  }

  await serveStatic(req, res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`server listening on http://0.0.0.0:${PORT}`)
})
