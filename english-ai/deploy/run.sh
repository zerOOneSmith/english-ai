#!/bin/sh
set -eu

# 前台启动 Node 服务（托管 dist 静态文件 + 提供 /api 接口）
exec node server/index.js
