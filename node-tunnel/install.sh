#!/usr/bin/env bash
#
# OpenClaw Node Tunnel 安装脚本
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_info "OpenClaw Node Tunnel 安装程序"
echo ""

# 检查系统
if [[ "$OSTYPE" != "darwin"* ]]; then
    log_warning "此工具主要为 macOS 设计，当前系统: $OSTYPE"
    read -p "是否继续安装? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 检查依赖
log_info "检查依赖..."

if ! command -v jq >/dev/null 2>&1; then
    log_warning "未找到 jq，建议安装: brew install jq"
fi

if ! command -v lsof >/dev/null 2>&1; then
    log_warning "未找到 lsof"
fi

# 创建目录
INSTALL_DIR="${HOME}/.openclaw/tools"
mkdir -p "${INSTALL_DIR}"

# 获取脚本路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 复制脚本
cp "${SCRIPT_DIR}/openclaw-tunnel" "${INSTALL_DIR}/"
chmod +x "${INSTALL_DIR}/openclaw-tunnel"

log_success "工具已安装到: ${INSTALL_DIR}/openclaw-tunnel"

# 检查 PATH
if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
    log_info "将 ${INSTALL_DIR} 添加到 PATH"
    
    SHELL_RC=""
    if [[ -n "${ZSH_VERSION:-}" ]] || [[ "$SHELL" == */zsh ]]; then
        SHELL_RC="${HOME}/.zshrc"
    elif [[ -n "${BASH_VERSION:-}" ]] || [[ "$SHELL" == */bash ]]; then
        SHELL_RC="${HOME}/.bashrc"
    fi
    
    if [[ -n "$SHELL_RC" ]]; then
        echo 'export PATH="$HOME/.openclaw/tools:$PATH"' >> "$SHELL_RC"
        log_success "已添加到 ${SHELL_RC}"
        log_info "请运行: source ${SHELL_RC}"
    fi
else
    log_success "${INSTALL_DIR} 已在 PATH 中"
fi

echo ""
log_success "安装完成!"
echo ""
echo "下一步:"
echo "  1. 运行: openclaw-tunnel config"
echo "  2. 按照提示配置你的 Gateway 信息"
echo "  3. 运行: openclaw-tunnel start"
echo ""
echo "查看帮助: openclaw-tunnel help"
