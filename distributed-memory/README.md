# Distributed Async Memory System

分布式异步记忆分类系统 - 用于 OpenClaw 的内存管理插件，支持边缘采集+远程推理架构。

## 核心特性

- **异步非阻塞处理**: `agent_end` 钩子采用 fire-and-forget 模式，避免影响用户对话体验
- **分布式推理卸载**: 将 LLM 分类任务从边缘设备卸载到专用推理节点
- **智能过滤与去重**: 噪音过滤 + 语义向量去重，防止无效数据入库

## 架构

```
┌─────────────────┐      HTTP API       ┌──────────────────┐
│   Edge Node     │  ═════════════════► │ Inference Node   │
│  (OpenClaw +    │    Ollama API       │   (Ollama)       │
│   Plugin)       │                     │                  │
└─────────────────┘                     └──────────────────┘
         │                                       │
         ▼                                       ▼
┌─────────────────┐                     ┌──────────────────┐
│   LanceDB       │                     │   qwen3.5:2b     │
│  (Local Store)  │                     │   (LLM Model)    │
└─────────────────┘                     └──────────────────┘
```

## 文件结构

```
distributed-memory/
├── index.ts              # 插件入口，实现异步 agent_end 钩子
├── openclaw.plugin.json  # 插件元数据
├── package.json          # 依赖配置
├── README.md             # 本文件
├── ARCHITECTURE.md       # 详细架构说明
├── USAGE.md              # 使用指南
├── config.example.json   # 配置示例
└── src/
    ├── store.ts          # LanceDB 存储操作
    ├── llm-classifier.ts # LLM 分类逻辑
    ├── noise-filter.ts   # 噪音过滤器
    ├── retriever.ts      # 检索器
    └── embedder.ts       # 向量嵌入
```

## 快速开始

1. **安装依赖**
   ```bash
   cd ~/.openclaw/plugins
   git clone <repo-url>/distributed-memory.git
   cd distributed-memory
   npm install
   ```

2. **配置 Ollama**
   ```bash
   # 在推理节点上启动 Ollama
   ollama run qwen3.5:2b
   
   # 确保监听 0.0.0.0:11434
   export OLLAMA_HOST=0.0.0.0:11434
   ```

3. **配置插件**
   复制 `config.example.json` 到 OpenClaw 配置目录，并修改 `baseURL` 指向你的 Ollama 实例。

4. **重启 Gateway**
   ```bash
   rm -rf ~/.openclaw/.jiti  # 清除缓存
   openclaw gateway restart
   ```

## 详细文档

- [ARCHITECTURE.md](ARCHITECTURE.md) - 系统架构详解
- [USAGE.md](USAGE.md) - 使用指南和配置示例

## License

MIT License - 详见 LICENSE 文件
