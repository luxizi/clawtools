# ClawTools - OpenClaw 实用工具集

一个包含 OpenClaw 相关实用工具的集合项目。

## 项目结构

```
clawtools/
├── node-tunnel/          # SSH 隧道管理工具
│   ├── openclaw-tunnel   # 主脚本
│   ├── install.sh        # 安装脚本
│   ├── README.md         # 使用说明
│   └── USAGE.md          # 详细文档
├── browser-extension/    # Chrome 浏览器扩展
│   ├── background.js     # 背景脚本
│   ├── manifest.json     # 扩展清单
│   ├── options.html      # 选项页面
│   ├── options.js        # 选项脚本
│   ├── icons/            # 图标资源
│   └── README.md         # 扩展说明
└── README.md             # 本文件
```

## 工具说明

### 1. Node Tunnel (`node-tunnel/`)

通过 SSH 隧道将本地 OpenClaw 节点安全连接到远程 Gateway。

**特性:**
- 一键启动/停止 SSH 隧道和 OpenClaw 节点
- 交互式配置向导
- macOS LaunchAgent 开机自启支持
- 自动诊断检查
- 自动重连功能
- 详细的日志管理

**安装:**
```bash
cd node-tunnel
./install.sh
```

**使用方法:**
```bash
# 配置
openclaw-tunnel config

# 启动服务
openclaw-tunnel start

# 查看状态
openclaw-tunnel status

# 安装开机自启
openclaw-tunnel install-autostart
```

### 2. Browser Extension (`browser-extension/`)

OpenClaw 浏览器中继扩展，允许 OpenClaw Gateway 通过 Chrome DevTools Protocol 控制浏览器标签页。

**特性:**
- 点击扩展图标附加/分离当前标签页
- 支持配置 Relay 端口和 Gateway Token
- 自动重连功能（页面刷新、扩展重启后自动恢复）
- 状态徽章显示连接状态

**安装:**
1. 打开 Chrome → `chrome://extensions`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `browser-extension` 目录

**配置:**
1. 点击扩展图标 → 选项
2. 设置 Relay 端口（默认 18792）
3. 输入 Gateway Token
4. 可选：启用自动重连

## 配置说明

### 敏感信息占位符

在使用前，你需要替换以下占位符为实际值：

| 占位符 | 说明 | 位置 |
|--------|------|------|
| `YOUR_GATEWAY_HOST` | Gateway 服务器地址 | `node-tunnel/openclaw-tunnel` |
| `YOUR_GATEWAY_PORT` | Gateway 端口 | `node-tunnel/openclaw-tunnel` |
| `YOUR_LOCAL_PORT` | 本地隧道端口 | `node-tunnel/openclaw-tunnel` |
| `YOUR_NODE_NAME` | 节点显示名称 | `node-tunnel/openclaw-tunnel` |
| `YOUR_SSH_USER` | SSH 用户名 | `node-tunnel/openclaw-tunnel` |
| `YOUR_GATEWAY_TOKEN` | Gateway 认证 Token | `node-tunnel/openclaw-tunnel`, 扩展选项 |

### 获取配置值

1. **Gateway Host**: 你的 OpenClaw Gateway 服务器 IP 或域名
2. **Gateway Port**: Gateway 监听端口（默认 18789）
3. **Local Port**: 本地 SSH 隧道映射端口（默认 18790）
4. **Node Name**: 节点在 Gateway 中的显示名称
5. **SSH User**: 连接 Gateway 的 SSH 用户名
6. **Gateway Token**: Gateway 的认证令牌

## 系统要求

- macOS（Node Tunnel 需要）
- Chrome 浏览器（Browser Extension 需要）
- OpenClaw CLI 已安装
- SSH 访问 Gateway 服务器的权限

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 PR！

## 相关项目

- [OpenClaw](https://github.com/openclaw/openclaw) - 主项目
