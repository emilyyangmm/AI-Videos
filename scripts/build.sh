#!/bin/bash
set -Eeuo pipefail

# 1. 确保在正确的目录下
cd "$(pwd)"

echo "Installing dependencies..."
# 去掉那些死板的参数，让 pnpm 自由安装所需的包
pnpm install

echo "Building the Next.js project..."
# 使用标准的 build 命令
pnpm run build

echo "Build completed successfully!"
