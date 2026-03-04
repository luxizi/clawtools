# 使用指南 (Usage Guide)

## 安装步骤

### 1. 准备环境

**边缘节点 (Edge Node)**:
```bash
# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 OpenClaw
npm install -g @openclaw/gateway
```

**推理节点 (Inference Provider)**:
```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 拉取模型
ollama pull qwen3.5:2b

# 配置监听地址
export OLLAMA_HOST=0.0.0.0:11434
ollama serve
```

### 2. 安装插件

```bash
cd ~/.openclaw/plugins

# 克隆仓库
git clone https://github.com/luxizi/clawtools.git
cp -r clawtools/distributed-memory ./

# 安装依赖
cd distributed-memory
npm install
```

### 3. 配置 OpenClaw

编辑 `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "memory-lancedb-pro": {
      "enabled": true,
      "dbPath": "./data/memory.lancedb",
      "llmClassification": {
        "provider": "ollama",
        "baseURL": "http://YOUR_INFERENCE_IP:11434/v1",
        "model": "qwen3.5:2b"
      }
    }
  }
}
```

### 4. 启动服务

```bash
# 清除缓存（重要！）
rm -rf ~/.openclaw/.jiti

# 重启 Gateway
openclaw gateway restart
```

## 配置详解

### 完整配置示例

```json
{
  "dbPath": "./data/memory.lancedb",
  "llmClassification": {
    "provider": "ollama",
    "apiKey": "optional-api-key",
    "baseURL": "http://localhost:11434/v1",
    "model": "qwen3.5:2b"
  },
  "embedding": {
    "provider": "local",
    "model": "all-MiniLM-L6-v2"
  },
  "noiseFilter": {
    "keywords": ["测试", "test", "ignore"],
    "minLength": 5
  },
  "dedup": {
    "threshold": 1.0,
    "checkLastN": 100
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `dbPath` | string | 是 | - | LanceDB 存储路径 |
| `llmClassification.provider` | string | 是 | - | 提供商: ollama/openai |
| `llmClassification.baseURL` | string | 是 | - | API 基础 URL |
| `llmClassification.model` | string | 是 | - | 模型名称 |
| `noiseFilter.keywords` | array | 否 | ["测试","test"] | 过滤关键词 |
| `dedup.threshold` | number | 否 | 1.0 | 去重阈值 |

## 验证安装

### 1. 检查插件加载
```bash
openclaw gateway logs | grep "memory-lancedb-pro"
```

应看到类似输出：
```
[MemoryPro] Plugin initialized successfully
[MemoryPro] Connected to Ollama at http://xxx:11434
```

### 2. 测试分类功能
发送一条测试消息：
```
请记住我的邮箱是 test@example.com
```

检查日志：
```bash
tail -f ~/.openclaw/logs/openclaw.log | grep "MemoryPro"
```

应看到：
```
[MemoryPro] Capturing memory: 请记住我的邮箱是...
[MemoryPro] Stored to LanceDB with ID: xxx
```

### 3. 验证存储
```bash
# 使用 LanceDB CLI 查看
lancedb query ./data/memory.lancedb "SELECT * FROM memories LIMIT 5"
```

## 常见问题

### Q1: 插件修改后不生效
**A**: 必须清除 jiti 缓存：
```bash
rm -rf ~/.openclaw/.jiti
openclaw gateway restart
```

### Q2: Ollama 连接失败
**A**: 检查以下几点：
1. Ollama 是否监听 0.0.0.0: `export OLLAMA_HOST=0.0.0.0`
2. 防火墙是否开放 11434 端口
3. baseURL 是否正确（需包含 `/v1` 后缀）

### Q3: 所有消息都被过滤
**A**: 检查 `noise-filter.ts` 中的关键词列表，可能是触发了敏感词过滤。

### Q4: 重复消息被多次存储
**A**: 去重阈值可能过高，尝试降低 `dedup.threshold` 到 0.95。

## 维护命令

### 备份记忆库
```bash
# 备份 LanceDB 目录
tar czvf memory-backup-$(date +%Y%m%d).tar.gz ~/.openclaw/data/memory.lancedb
```

### 清理旧数据
```bash
# 删除 30 天前的记录
lancedb query ./data/memory.lancedb \
  "DELETE FROM memories WHERE timestamp < datetime('now', '-30 days')"
```

### 导出记忆
```bash
# 导出为 JSON
lancedb query ./data/memory.lancedb "SELECT * FROM memories" --format json > memories.json
```

## 性能调优

### 高并发场景
1. 使用 Ollama 的并发模式：
   ```bash
   OLLAMA_NUM_PARALLEL=4 ollama serve
   ```

2. 启用 LanceDB 缓存：
   ```json
   {
     "dbPath": "./data/memory.lancedb",
     "cacheSize": "512MB"
   }
   ```

### 资源限制
对于低配服务器，建议：
- 使用更小的模型：`qwen3.5:0.8b`
- 限制并发：`OLLAMA_NUM_PARALLEL=1`
- 减少去重检查范围：`checkLastN: 50`
