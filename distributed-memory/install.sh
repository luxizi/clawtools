#!/bin/bash
#
# Distributed Memory System - Installation Script
# 分布式异步记忆系统安装脚本
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}  Distributed Memory System Setup  ${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo -e "${YELLOW}Warning: Running as root. Consider using a regular user.${NC}"
fi

# Check Node.js version
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js version is too old. Please upgrade to 18+.${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js $(node -v) detected.${NC}"

# Check Ollama
echo ""
echo -e "${YELLOW}Checking Ollama...${NC}"
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}Ollama detected: $(ollama --version)${NC}"
    
    # Check if qwen3.5:2b exists
    if ollama list | grep -q "qwen3.5"; then
        echo -e "${GREEN}Model qwen3.5 detected.${NC}"
    else
        echo -e "${YELLOW}Warning: qwen3.5 model not found. Pull it with: ollama pull qwen3.5:2b${NC}"
    fi
else
    echo -e "${YELLOW}Warning: Ollama not detected. Please install it for local inference.${NC}"
    echo "Install: curl -fsSL https://ollama.com/install.sh | sh"
fi

# Check OpenClaw
echo ""
echo -e "${YELLOW}Checking OpenClaw...${NC}"
if ! command -v openclaw &> /dev/null; then
    echo -e "${YELLOW}OpenClaw not found globally. Checking local installation...${NC}"
    if [ -f "./node_modules/.bin/openclaw" ]; then
        echo -e "${GREEN}Local OpenClaw detected.${NC}"
    else
        echo -e "${YELLOW}Warning: OpenClaw not detected. Install with: npm install -g @openclaw/gateway${NC}"
    fi
else
    echo -e "${GREEN}OpenClaw detected: $(openclaw --version)${NC}"
fi

# Check if we're in the right directory
echo ""
echo -e "${YELLOW}Checking project structure...${NC}"
if [ -f "package.json" ] && [ -f "index.ts" ]; then
    echo -e "${GREEN}Project files detected.${NC}"
else
    echo -e "${RED}Error: Project files not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Offer to install dependencies
echo ""
echo -e "${YELLOW}Ready to install dependencies?${NC}"
read -p "Run npm install? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Dependencies installed successfully.${NC}"
    else
        echo -e "${RED}Failed to install dependencies.${NC}"
        exit 1
    fi
fi

# Create data directory
echo ""
echo -e "${YELLOW}Creating data directory...${NC}"
mkdir -p ./data
echo -e "${GREEN}Data directory ready.${NC}"

# Configuration guide
echo ""
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}     Installation Complete!         ${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Copy the configuration example:"
echo "   cp config.example.json ~/.openclaw/config.d/memory-lancedb-pro.json"
echo ""
echo "2. Edit the configuration with your settings:"
echo "   - Set baseURL to your Ollama instance"
echo "   - Adjust noiseFilter keywords if needed"
echo ""
echo "3. Clear the TypeScript cache:"
echo "   rm -rf ~/.openclaw/.jiti"
echo ""
echo "4. Restart OpenClaw Gateway:"
echo "   openclaw gateway restart"
echo ""
echo "For detailed documentation, see:"
echo "  - README.md - Overview and quick start"
echo "  - ARCHITECTURE.md - System design"
echo "  - USAGE.md - Detailed usage guide"
echo ""
echo -e "${GREEN}Good luck!${NC}"
