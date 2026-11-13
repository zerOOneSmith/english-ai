// 服务端配置：全部从环境变量读取，代码中不保存任何密钥
// 本地开发：在项目根目录创建 .env（参考 .env.example），npm run server 会自动加载

export const BAIDU_API_KEY = process.env.BAIDU_API_KEY || ''
export const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || ''
export const QWEN_API_KEY = process.env.QWEN_API_KEY || ''
export const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-turbo'
export const PORT = Number(process.env.PORT || 8787)

// 启动前检查必需的环境变量
export const missingEnv = ['BAIDU_API_KEY', 'BAIDU_SECRET_KEY', 'QWEN_API_KEY'].filter(
  key => !process.env[key]
)
