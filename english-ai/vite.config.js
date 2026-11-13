import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    // '::' 同时监听 IPv6/IPv4，确保 localhost 和 127.0.0.1 都能访问
    host: '::',
    port: 5173,
    // 本地开发时 /api 代理到 Node 服务（由 server/index.js 提供）
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  }
})
