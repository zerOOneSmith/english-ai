// 一键生成线上部署包：从当前项目取源文件，避免手工复制导致源码不同步
// 用法: npm run deploy:prepare
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(root, '..', 'english-ai-deploy')

// 需要进入部署包的内容（node_modules / dist / .env 一律不带）
const COPY_ITEMS = [
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.js',
  'src',
  'server',
  'public',
]

const ADAPTER_ITEMS = ['build.sh', 'run.sh', 'execution-config.example.json']

async function readIfExists(file) {
  try {
    return await readFile(file, 'utf8')
  } catch {
    return null
  }
}

// 保留用户已填好的密钥配置，避免每次生成都要重填
const savedConfig = await readIfExists(path.join(outDir, 'execution-config.json'))

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

for (const item of COPY_ITEMS) {
  await cp(path.join(root, item), path.join(outDir, item), { recursive: true })
}

for (const item of ADAPTER_ITEMS) {
  await cp(path.join(root, 'deploy', item), path.join(outDir, item))
}

if (savedConfig) {
  await writeFile(path.join(outDir, 'execution-config.json'), savedConfig)
}

console.log(`部署包已生成: ${outDir}`)
console.log(savedConfig ? '已保留原有的 execution-config.json' : '下一步: 复制 execution-config.example.json 为 execution-config.json 并填入密钥')
