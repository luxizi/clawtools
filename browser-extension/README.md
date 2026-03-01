# OpenClaw Browser Extension

Chrome 浏览器扩展，允许 OpenClaw Gateway 通过 Chrome DevTools Protocol (CDP) 控制浏览器标签页。

## 功能特性

- 🔌 **一键附加** - 点击扩展图标附加/分离当前标签页
- 🔐 **Token 认证** - 安全的 Gateway Token 认证
- ⚙️ **可配置** - 支持自定义 Relay 端口和 Token
- 🔄 **自动重连** - 页面刷新、扩展重启后自动恢复
- 📊 **状态徽章** - 直观的连接状态显示
- 🧩 **多标签支持** - 同时控制多个标签页

## 安装

### 开发者模式加载

1. 打开 Chrome → `chrome://extensions`
2. 启用右上角 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**
4. 选择 `browser-extension` 目录
5. 将扩展图标固定到工具栏（推荐）

### 从 Chrome Web Store 安装

（暂未发布）

## 配置

### 首次配置

安装后首次点击扩展图标会自动打开选项页面：

1. **Relay Port** - 本地 Relay 服务器端口（默认: 18792）
2. **Gateway Token** - Gateway 认证令牌
3. **Auto-reconnect** - 启用自动重连功能

### 获取配置信息

从 OpenClaw Gateway 配置中获取：

```json
// Gateway openclaw.json
{
  "gateway": {
    "browser": {
      "relay": {
        "port": 18792
      }
    }
  },
  "auth": {
    "mode": "token",
    "token": "your-gateway-token"
  }
}
```

## 使用

### 附加标签页

1. 打开要自动化的网页
2. 点击扩展图标（或按快捷键）
3. 图标显示 **"ON"** 表示已附加

### 分离标签页

再次点击扩展图标即可分离。

### 状态说明

| 徽章 | 状态 |
|------|------|
| 无 | 未连接 |
| **ON** (橙色) | 已附加，可以自动化 |
| **…** (黄色) | 连接中 |
| **!** (红色) | 连接错误 |

### 自动重连

启用自动重连后，扩展会在以下情况自动恢复：
- 页面刷新
- URL 变更
- 扩展重新加载
- 连接中断

## 工作原理

```
[OpenClaw Gateway] ←→ [Browser Relay] ←→ [Chrome Extension]
                                           ↓
                                      [CDP Protocol]
                                           ↓
                                    [Target Tab]
```

1. 扩展通过 WebSocket 连接到本地 Relay 服务器
2. Relay 将 CDP 命令转发给扩展
3. 扩展使用 Chrome Debugger API 控制标签页
4. CDP 事件通过 Relay 返回给 Gateway

## 故障排查

### 扩展显示 "relay not running"

检查清单：
- [ ] Gateway 是否已启动？
- [ ] Browser Relay 是否已启用？
- [ ] 端口配置是否匹配？

```bash
# 检查 Relay 端口
lsof -i :18792

# 检查 Gateway 状态
openclaw status
```

### Token 被拒绝

- [ ] 检查 Token 是否正确输入（无空格）
- [ ] 确认 Gateway 使用 Token 认证模式
- [ ] 重新生成 Token 并更新

### 标签页无法控制

- [ ] 确保标签页已附加（显示 ON 徽章）
- [ ] 某些页面（如 Chrome 商店）无法调试
- [ ] 检查扩展权限是否完整

### 自动重连不工作

- [ ] 确认在选项中启用了自动重连
- [ ] 检查扩展是否有后台运行权限
- [ ] 查看 Chrome 扩展日志：`chrome://extensions` → 详情 → 检查视图

## 权限说明

扩展需要以下权限：

| 权限 | 用途 |
|------|------|
| `debugger` | 使用 Chrome DevTools Protocol |
| `tabs` | 管理浏览器标签页 |
| `activeTab` | 访问当前标签页 |
| `storage` | 保存配置 |

## 开发

### 文件结构

```
browser-extension/
├── manifest.json      # 扩展清单
├── background.js      # 服务工作脚本
├── options.html       # 选项页面
├── options.js         # 选项脚本
├── icons/             # 图标资源
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # 本文件
```

### 调试

1. 打开 `chrome://extensions`
2. 找到 OpenClaw Browser Relay
3. 点击 **"检查视图: service worker"**
4. 查看 Console 日志

### 重新加载

修改代码后，点击扩展卡片上的 **刷新** 图标重新加载。

## 兼容性

- Chrome 88+ (Manifest V3)
- Edge 88+ (基于 Chromium)
- 其他基于 Chromium 的浏览器

## 安全注意事项

1. **Token 保护** - Gateway Token 是敏感信息，不要分享给他人
2. **本地连接** - Relay 连接仅在本地（127.0.0.1），不会暴露到网络
3. **权限最小化** - 扩展仅请求必要的权限
4. **调试权限** - `debugger` 权限可以控制浏览器，仅从可信来源安装

## 相关项目

- [OpenClaw](https://github.com/openclaw/openclaw) - 主项目
- [Node Tunnel](../node-tunnel) - SSH 隧道工具
- [ClawTools](../..) - 工具集合
