# 24hour Chrome Relay

**7×24 小时无人值守浏览器自动化扩展**

这是 OpenClaw Browser Relay 的增强版本，专为长时间稳定运行设计。核心特性是 **WebSocket 断线自动重连机制**，能够实现真正的 7×24 小时代替人工操作，无需人工干预。

## ✨ 核心优势

| 特性 | 说明 |
|------|------|
| 🔄 **WebSocket 断线自动重连** | 网络波动、Gateway 重启后自动恢复连接 |
| 🔄 **页面刷新自动重连** | 页面刷新、URL 变更后自动重新附加 |
| 🔄 **扩展重启自动恢复** | Chrome 扩展重启后自动恢复之前的标签页状态 |
| ⏰ **7×24 小时稳定运行** | 无需人工值守，完全自动化 |
| 🔌 **一键附加** | 点击扩展图标附加/分离当前标签页 |
| 🔐 **Token 认证** | 安全的 Gateway Token 认证 |
| 📊 **状态徽章** | 直观的连接状态显示 |

## 🎯 适用场景

- **长时间数据采集任务** - 持续数小时甚至数天的数据爬取
- **自动化监控和巡检** - 定时检查网页状态、价格变动等
- **无人值守的浏览器自动化流程** - RPA 流程自动化
- **持续运行的测试任务** - 长时间稳定性测试

## 📦 安装

### 开发者模式加载

1. 打开 Chrome → `chrome://extensions`
2. 启用右上角 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**
4. 选择 `24hour-chrome-relay` 目录
5. 将扩展图标固定到工具栏（推荐）

### 从 Chrome Web Store 安装

（暂未发布）

## ⚙️ 配置

### 首次配置

安装后首次点击扩展图标会自动打开选项页面：

1. **Relay Port** - 本地 Relay 服务器端口（默认: 18792）
2. **Gateway Token** - Gateway 认证令牌
3. **Auto-reconnect** - **启用自动重连（关键！）**

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

## 🚀 使用

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

## 🔧 自动重连机制详解

这是本扩展的核心特性，确保 7×24 小时稳定运行：

### 1. WebSocket 断线自动重连

```
场景: Gateway 重启 / 网络波动 / Relay 服务重启
行为: 扩展检测到 WebSocket 断开后，自动尝试重新连接
结果: 无需人工干预，自动恢复控制
```

### 2. 页面刷新自动重连

```
场景: 页面手动刷新 / URL 变更 / 页面重定向
行为: 扩展检测到标签页导航后，自动重新附加 DevTools
结果: 自动化流程不中断，持续运行
```

### 3. 扩展重启自动恢复

```
场景: Chrome 重启 / 扩展重新加载 / 浏览器崩溃恢复
行为: 扩展记住之前附加的标签页，自动重新连接
结果: 从上次状态恢复，继续自动化任务
```

## 🛠️ 工作原理

```
[OpenClaw Gateway] ←→ [Browser Relay] ←→ [24hour Chrome Relay]
                                           ↓
                                      [CDP Protocol]
                                           ↓
                                    [Target Tab]
```

1. 扩展通过 WebSocket 连接到本地 Relay 服务器
2. Relay 将 CDP 命令转发给扩展
3. 扩展使用 Chrome Debugger API 控制标签页
4. **WebSocket 断线时自动重连，确保连接不中断**
5. CDP 事件通过 Relay 返回给 Gateway

## 🐛 故障排查

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

### 自动重连不工作

- [ ] **确认在选项中启用了自动重连**（关键！）
- [ ] 检查扩展是否有后台运行权限
- [ ] 查看 Chrome 扩展日志：`chrome://extensions` → 详情 → 检查视图

### Token 被拒绝

- [ ] 检查 Token 是否正确输入（无空格）
- [ ] 确认 Gateway 使用 Token 认证模式
- [ ] 重新生成 Token 并更新

### 标签页无法控制

- [ ] 确保标签页已附加（显示 ON 徽章）
- [ ] 某些页面（如 Chrome 商店）无法调试
- [ ] 检查扩展权限是否完整

## 🔒 权限说明

扩展需要以下权限：

| 权限 | 用途 |
|------|------|
| `debugger` | 使用 Chrome DevTools Protocol |
| `tabs` | 管理浏览器标签页（监听导航事件用于自动重连） |
| `activeTab` | 访问当前标签页 |
| `storage` | 保存配置和自动重连状态 |

## 📁 文件结构

```
24hour-chrome-relay/
├── manifest.json      # 扩展清单
├── background.js      # 服务工作脚本（含自动重连逻辑）
├── options.html       # 选项页面
├── options.js         # 选项脚本
├── icons/             # 图标资源
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # 本文件
```

### 核心代码位置

自动重连逻辑位于 `background.js`：

- `scheduleAutoReconnect()` - WebSocket 断线重连
- `onRelayClosed()` - 连接断开处理
- `chrome.tabs.onUpdated` - 页面导航监听
- `onDebuggerDetach()` - DevTools 分离处理

## 🔍 调试

1. 打开 `chrome://extensions`
2. 找到 **24hour Chrome Relay**
3. 点击 **"检查视图: service worker"**
4. 查看 Console 日志，搜索 `[Auto-reconnect]` 查看自动重连日志

### 重新加载

修改代码后，点击扩展卡片上的 **刷新** 图标重新加载。

## 💻 兼容性

- Chrome 88+ (Manifest V3)
- Edge 88+ (基于 Chromium)
- 其他基于 Chromium 的浏览器

## ⚠️ 安全注意事项

1. **Token 保护** - Gateway Token 是敏感信息，不要分享给他人
2. **本地连接** - Relay 连接仅在本地（127.0.0.1），不会暴露到网络
3. **权限最小化** - 扩展仅请求必要的权限
4. **调试权限** - `debugger` 权限可以控制浏览器，仅从可信来源安装

## 📚 相关项目

- [OpenClaw](https://github.com/openclaw/openclaw) - 主项目
- [Node Tunnel](../node-tunnel) - SSH 隧道工具
- [ClawTools](../..) - 工具集合

## 📝 更新日志

### v0.1.0 (2026-03-01)

- 初始版本
- 实现 WebSocket 断线自动重连
- 实现页面刷新自动重连
- 实现扩展重启自动恢复
- 支持 7×24 小时无人值守运行
