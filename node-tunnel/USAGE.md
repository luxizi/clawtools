# OpenClaw Node Tunnel - 使用手册

完整的命令参考和高级用法。

## 命令详解

### config

交互式配置向导。

```bash
openclaw-tunnel config
```

按提示输入各项配置，直接回车使用当前值（方括号中显示）。

### start

启动 SSH 隧道和 OpenClaw 节点，然后自动运行诊断。

```bash
openclaw-tunnel start
```

流程：
1. 检查隧道是否已在运行
2. 启动 SSH 隧道（后台）
3. 等待 2 秒
4. 启动 OpenClaw 节点
5. 显示状态
6. 运行自动诊断

### stop

停止 OpenClaw 节点和 SSH 隧道。

```bash
openclaw-tunnel stop
```

流程：
1. 停止节点进程
2. 等待 1 秒
3. 停止 SSH 隧道
4. 显示状态

### restart

重启所有服务。

```bash
openclaw-tunnel restart
```

等价于：`stop` → 等待 2 秒 → `start`

### status

显示当前运行状态和配置信息。

```bash
openclaw-tunnel status
```

输出示例：
```
ℹ OpenClaw 节点隧道状态

配置信息:
  Gateway: 1.2.3.4:18789
  本地端口: 18790
  节点名称: MyMacBook

运行状态:
  SSH 隧道: 运行中 (PID: 12345)
  OpenClaw 节点: 运行中 (PID: 12346)
```

### diagnose

运行完整的诊断检查。

```bash
openclaw-tunnel diagnose
```

检查项目：
1. OpenClaw CLI 安装
2. 本地节点配置
3. SSH 隧道状态
4. 节点进程状态
5. 功能测试
6. Gateway 配置建议

### logs

查看日志文件。

```bash
# 查看所有日志（隧道 + 节点）
openclaw-tunnel logs
openclaw-tunnel logs all

# 仅查看隧道日志
openclaw-tunnel logs tunnel

# 仅查看节点日志
openclaw-tunnel logs node
```

按 `Ctrl+C` 退出日志查看。

### 单独控制命令

#### start-tunnel

仅启动 SSH 隧道。

```bash
openclaw-tunnel start-tunnel
```

#### stop-tunnel

仅停止 SSH 隧道。

```bash
openclaw-tunnel stop-tunnel
```

#### start-node

仅启动 OpenClaw 节点。

```bash
openclaw-tunnel start-node
```

注意：节点需要隧道先运行，否则会报错。

#### stop-node

仅停止 OpenClaw 节点。

```bash
openclaw-tunnel stop-node
```

### 开机自启

#### install-autostart

安装 macOS LaunchAgent，实现开机自动启动。

```bash
openclaw-tunnel install-autostart
```

这会创建 `~/Library/LaunchAgents/ai.openclaw.tunnel.plist`。

特性：
- 开机自动启动隧道和节点
- 进程崩溃自动重启（KeepAlive）
- 独立的启动日志

#### uninstall-autostart

卸载开机自启服务。

```bash
openclaw-tunnel uninstall-autostart
```

## 高级用法

### 自定义日志目录

日志默认存储在 `~/.openclaw/tools/tunnel/logs/`。

如需更改，可修改脚本中的 `LOG_DIR` 变量，或创建符号链接：

```bash
mkdir -p /path/to/custom/logs
ln -sf /path/to/custom/logs ~/.openclaw/tools/tunnel/logs
```

### 多节点配置

如需连接多个 Gateway，可创建多个配置：

```bash
# 复制脚本
cp ~/.openclaw/tools/openclaw-tunnel ~/.openclaw/tools/openclaw-tunnel-prod

# 修改脚本中的 CONFIG_DIR
# 将 CONFIG_DIR="${HOME}/.openclaw/tools/tunnel"
# 改为 CONFIG_DIR="${HOME}/.openclaw/tools/tunnel-prod"

# 分别配置和启动
openclaw-tunnel-prod config
openclaw-tunnel-prod start
```

### 与 systemd 集成（Linux）

虽然主要为 macOS 设计，但也可以在 Linux 上使用。

创建 systemd 服务文件 `~/.config/systemd/user/openclaw-tunnel.service`：

```ini
[Unit]
Description=OpenClaw Node Tunnel
After=network.target

[Service]
Type=forking
ExecStart=%h/.openclaw/tools/openclaw-tunnel start
ExecStop=%h/.openclaw/tools/openclaw-tunnel stop
Restart=on-failure

[Install]
WantedBy=default.target
```

启用服务：

```bash
systemctl --user daemon-reload
systemctl --user enable openclaw-tunnel
systemctl --user start openclaw-tunnel
```

### 调试模式

如需查看更多调试信息，可在启动前设置环境变量：

```bash
export DEBUG=1
openclaw-tunnel start
```

或手动查看详细日志：

```bash
# 隧道详细日志
ssh -v -N -L 18790:127.0.0.1:18789 user@host

# 节点详细日志
openclaw node run --host 127.0.0.1 --port 18790 --display-name "Node" -v
```

## 环境变量

脚本使用以下环境变量：

| 变量 | 说明 | 优先级 |
|------|------|--------|
| `HOME` | 用户主目录 | 必需 |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway Token（启动节点时） | 自动设置 |

## 配置文件格式

`~/.openclaw/tools/tunnel/config.json`：

```json
{
  "gateway_host": "1.2.3.4",
  "gateway_port": "18789",
  "local_port": "18790",
  "node_name": "MyMacBook",
  "gateway_token": "your-token-here",
  "ssh_user": "root"
}
```

所有字段都是必需的。

## 故障排查清单

### 问题：隧道启动失败

检查清单：
- [ ] SSH 密钥是否配置？`ssh user@host` 测试
- [ ] Gateway 端口是否开放？`nc -zv host port`
- [ ] 本地端口是否被占用？`lsof -i :18790`
- [ ] 查看隧道日志：`openclaw-tunnel logs tunnel`

### 问题：节点连接失败

检查清单：
- [ ] 隧道是否运行？`openclaw-tunnel status`
- [ ] Token 是否正确？`grep token ~/.openclaw/tools/tunnel/config.json`
- [ ] Gateway 模式是否为 remote？检查 `~/.openclaw/openclaw.json`
- [ ] 查看节点日志：`openclaw-tunnel logs node`

### 问题：开机自启不工作

检查清单：
- [ ] LaunchAgent 是否存在？`ls ~/Library/LaunchAgents/ai.openclaw.tunnel.plist`
- [ ] 是否已加载？`launchctl list | grep openclaw`
- [ ] 查看启动日志：`cat ~/.openclaw/tools/tunnel/logs/launchd-error.log`
- [ ] 脚本路径是否正确？检查 plist 文件中的 ProgramArguments

## 更新

更新到最新版本：

```bash
# 备份配置
cp ~/.openclaw/tools/tunnel/config.json ~/tunnel-config-backup.json

# 下载新版本（替换为实际路径）
cp /path/to/new/openclaw-tunnel ~/.openclaw/tools/
chmod +x ~/.openclaw/tools/openclaw-tunnel

# 恢复配置
cp ~/tunnel-config-backup.json ~/.openclaw/tools/tunnel/config.json
```

## 安全注意事项

1. **配置文件权限**：config.json 包含敏感 Token，确保权限正确：
   ```bash
   chmod 600 ~/.openclaw/tools/tunnel/config.json
   ```

2. **SSH 密钥**：使用密钥认证而非密码：
   ```bash
   ssh-copy-id user@host
   ```

3. **Token 管理**：定期更换 Gateway Token，避免硬编码在脚本中。

4. **日志清理**：日志可能包含敏感信息，定期清理：
   ```bash
   openclaw-tunnel stop
   rm ~/.openclaw/tools/tunnel/logs/*.log
   openclaw-tunnel start
   ```
