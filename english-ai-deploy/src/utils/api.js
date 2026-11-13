// 前端 API 封装：只调用自己的 /api 接口，密钥全部在后端
// 本地开发由 Vite 代理，线上由 Node 服务同源提供

/**
 * 场景识别
 * @param {string} imageBase64 图片 base64（不含 data:image 前缀）
 * @returns {Promise<{scene:string, description:string, confidence:number, keywords?:string[]}>}
 */
export async function recognizeScene(imageBase64) {
  const resp = await fetch('/api/scene', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64 }),
  })
  if (!resp.ok) throw new Error(`场景识别失败(${resp.status})`)
  return resp.json()
}

const TEMPLATES = {
  subway: ['This is a subway station.', 'Which line do you take?', "It's crowded today."],
  coffee_shop: ['I want a latte, please.', 'What time do you open?', "It's cold today."],
  office: ['Good morning!', 'How was your weekend?', 'I have a meeting at 10.'],
  restaurant: ['What would you like?', "I'm hungry.", 'The food is good.'],
  home: ["I'm at home now.", "I'm watching TV.", 'Good night!'],
  unknown: ['Hello! What is this?', 'Can you tell me?', 'Nice to see you!'],
}

/**
 * 生成英语对话句子
 * @param {string} scene 场景 key
 * @param {object} [opts]
 * @param {string} [opts.description] 场景中文描述
 * @param {string} [opts.userReply] 用户刚说的话
 * @returns {Promise<string[]>}
 */
export async function generateEnglish(scene, opts = {}) {
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene,
        description: opts.description || '',
        userReply: opts.userReply || '',
      }),
    })
    if (!resp.ok) throw new Error(`AI生成失败(${resp.status})`)
    const data = await resp.json()
    if (Array.isArray(data.sentences) && data.sentences.length) return data.sentences
    throw new Error('empty sentences')
  } catch (err) {
    console.warn('[generateEnglish] fallback to template:', err.message)
    return TEMPLATES[scene] || TEMPLATES.unknown
  }
}
