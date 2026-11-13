#!/bin/sh
set -eu

# 远端构建：安装依赖 -> 构建前端 -> 把 Node 服务塞进 dist
export NPM_CONFIG_REGISTRY='https://registry.npmmirror.com/'
npm ci --registry='https://registry.npmmirror.com/'
npm run build

mkdir -p dist
cp -R server dist/server
cp run.sh dist/run.sh
chmod 755 dist/run.sh
