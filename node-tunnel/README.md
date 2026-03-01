# OpenClaw Node Tunnel

通过 SSH 隧道将本地 OpenClaw 节点安全连接到远程 Gateway。

## 功能特性

- 🔐 **SSH 隧道** - 安全的加密连接
- 🚀 **一键启动** - 同时管理隧道和节点
- ⚙️ **交互式配置** - 向导式配置
- 🔄 **自动诊断** - 启动时自动检查配置问题
- 🖥️ **开机自启** - macOS LaunchAgent 支持
- 📊 **状态监控** - 实时查看运行状态
- 📝 **日志管理** - 独立的隧道和节点日志

## 系统要求

- macOS (主要支持)
- OpenClaw CLI 已安装
- SSH 访问 Gateway 服务器的权限
- jq (可选，用于配置解析)

## 安装

```bash
./install.sh
```

## 配置

### 首次配置

运行配置向导：

```bash
openclaw-tunnel config
```

你需要提供以下信息：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| Gateway 主机 | Gateway 服务器地址 | `1.2.3.4` 或 `gateway.example.com` |
| Gateway 端口 | Gateway 监听端口 | `18789` |
| 本地端口 | 本地 SSH 隧道端口 | `18790` |
| 节点名称 | 节点在 Gateway 中的显示名称 | `MyMacBook` |
| SSH 用户名 | 连接 Gateway 的 SSH 用户名 | `root` |
| Gateway Token | Gateway 认证令牌 | (从 Gateway 配置获取) |

### 手动编辑配置

配置文件位置：`~/.openclaw/tools/tunnel/config.json`

```json
{
  "gateway_host": "YOUR_GATEWAY_HOST",
  "gateway_port": "18789",
  "local_port": "18790",
  "node_name": "YOUR_NODE_NAME",
  "gateway_token": "YOUR_GATEWAY_TOKEN",
  "ssh_user": "YOUR_SSH_USER"
}
```

## 使用

### 启动服务

```bash
openclaw-tunnel start
```

这将：
1. 启动 SSH 隧道
2. 启动 OpenClaw 节点
3. 自动运行诊断检查

### 查看状态

```bash
openclaw-tunnel status
```

### 停止服务

```bash
openclaw-tunnel stop
```

### 重启服务

```bash
openclaw-tunnel restart
```

### 运行诊断

```bash
openclaw-tunnel diagnose
```

诊断会检查：
- OpenClaw CLI 是否安装
- 本地节点配置是否正确
- SSH 隧道是否正常运行
- 节点进程是否已连接
- Gateway 配置建议

### 查看日志

```bash
# 查看所有日志
openclaw-tunnel logs

# 仅查看隧道日志
openclaw-tunnel logs tunnel

# 仅查看节点日志
openclaw-tunnel logs node
```

### 开机自启

```bash
# 安装开机自启
openclaw-tunnel install-autostart

# 卸载开机自启
openclaw-tunnel uninstall-autostart
```

## 架构说明

```
[远程 Gateway]                [本地 MacBook]
YOUR_GATEWAY:18789  <---SSH--->  127.0.0.1:18790  <---WS--->  OpenClaw Node
     (公网)                      (隧道映射)                    (本地)
```

## 故障排查

### SSH 连接失败

```bash
# 测试 SSH 连接
ssh YOUR_SSH_USER@YOUR_GATEWAY_HOST "echo 'Connection OK'"

# 查看隧道日志
openclaw-tunnel logs tunnel
```

### 节点连接失败

```bash
# 检查隧道状态
lsof -i :18790

# 查看节点日志
openclaw-tunnel logs node

# 验证 Token
grep gateway_token ~/.openclaw/tools/tunnel/config.json
```

### 端口冲突

```bash
# 检查端口占用
lsof -i :18790

# 更改端口
openclaw-tunnel config  # 输入新端口
```

## 文件位置

| 文件 | 位置 |
|------|------|
| 工具脚本 | `~/.openclaw/tools/openclaw-tunnel` |
| 配置文件 | `~/.openclaw/tools/tunnel/config.json` |
| 日志目录 | `~/.openclaw/tools/tunnel/logs/` |
| PID 文件 | `~/.openclaw/tools/tunnel/pids/` |
| LaunchAgent | `~/Library/LaunchAgents/ai.openclaw.tunnel.plist` |

## 命令参考

| 命令 | 说明 |
|------|------|
| `openclaw-tunnel config` | 交互式配置 |
| `openclaw-tunnel start` | 启动隧道和节点（自动诊断） |
| `openclaw-tunnel stop` | 停止隧道和节点 |
| `openclaw-tunnel restart` | 重启服务 |
| `openclaw-tunnel status` | 查看状态 |
| `openclaw-tunnel diagnose` | 运行诊断检查 |
| `openclaw-tunnel logs [type]` | 查看日志 |
| `openclaw-tunnel install-autostart` | 安装开机自启 |
| `openclaw-tunnel uninstall-autostart` | 卸载开机自启 |
| `openclaw-tunnel help` | 显示帮助 |

## 安全建议

1. **使用 SSH 密钥** - 配置 SSH 密钥认证，避免密码登录
2. **限制 Gateway 监听** - Gateway 配置为仅监听 127.0.0.1
3. **使用 Token 认证** - 设置强 Token，定期更换
4. **防火墙设置** - 仅开放必要的端口

## 相关项目

- [OpenClaw](https://github.com/openclaw/openclaw) - 主项目
- [ClawTools](../..) - 工具集合
