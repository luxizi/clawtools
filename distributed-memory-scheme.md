# 分布式异步记忆分类系统设计方案 (Distributed Async Memory System)

## 1. 架构概述
本方案采用“边缘采集 + 远程推理”的架构，解决低配服务器（如 BrainB）在处理复杂 LLM 分类任务时产生的响应延迟和资源不足问题。

### 核心组件
*   **采集端 (BrainB - 172.31.0.3)**: 运行 OpenClaw Gateway 和 `memory-lancedb-pro` 插件。
*   **推理端 (Local - 172.31.0.2)**: 运行 Ollama 服务，提供 `qwen3.5:2b` 推理能力。
*   **通信协议**: 基于 HTTP 的 Ollama API 接口。

## 2. 关键特性

### A. 异步非阻塞流程 (Async Fire-and-Forget)
为了不影响用户的对话体验，`memory-lancedb-pro` 插件的 `agent_end` 钩子被重构为异步模式：
1.  Agent 生成响应后，立即触发 `agent_end`。
2.  插件在后台开启一个脱离主流程的 Promise。
3.  插件立刻向 Gateway 返回，Gateway 随即完成响应。
4.  分类、向量化和入库操作在后台静默完成。

### B. 推理负载卸载 (Inference Offloading)
*   **BrainB**: 仅配置 2 核 CPU，无法流畅运行 2B 以上模型。
*   **Local**: 拥有 4 核 CPU 及充足内存，作为专用推理节点。
*   **配置**: 插件 `baseURL` 指向 `http://172.31.0.2:11434`。

### C. 智能过滤与去重
*   **噪音过滤**: 通过 `noise-filter.ts` 拦截包含“测试/test”等关键词的无效信息。
*   **语义去重**: 入库前利用 LanceDB 进行相似度检索（Threshold=1），防止重复存储相同元数据或对话块。

## 3. 部署与维护规范

### 插件修改生效流程 (Rule 20)
由于 `jiti` 缓存机制，修改 `.ts` 插件代码后必须执行以下步骤：
1.  删除缓存：`rm -rf ~/.openclaw/.jiti`
2.  重启服务：`openclaw gateway restart`

### 模型管理
*   **核心模型**: `qwen3.5:2b` (SHA: `324d162be6ca`)，平衡了分类准确率与本地推理速度。
*   **清理建议**: 定期清理 `/root/.ollama/models/blobs/` 下的冗余层文件。

## 4. 下一步计划：本机 (172.31.0.2) 升级
1.  **协议集成**: 系统全面接入 `openprose` 和 `lobster` 协议，增强多智能体协同能力。
2.  **插件迁移**: 将 BrainB 的成熟配置同步至本机，实现“推理+网关”一体化的高性能节点。
3.  **存储迁移**: 将 BrainB 的 LanceDB 历史记忆导出并合并至本机存储。
