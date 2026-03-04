/**
 * LLM-based Memory Classification
 * Uses LLM to determine if a message is worth remembering and categorize it
 */

export interface LLMClassificationConfig {
  enabled: boolean;
  provider: "kimi" | "ollama";
  model?: string;
  apiKey?: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
  fallbackToRules?: boolean;
}

export interface ClassificationResult {
  worthRemembering: boolean;
  category: "preference" | "fact" | "decision" | "entity" | "other";
  reason: string;
  confidence?: number;
}

const CLASSIFICATION_PROMPT = `/no_think
你是记忆分类器，判断消息是否值得长期记忆。

示例:
消息: "记住我的邮箱是 test@example.com" -> {"worth_remembering": true, "category": "entity", "reason": "联系方式"}
消息: "我喜欢用 vim 编辑代码" -> {"worth_remembering": true, "category": "preference", "reason": "工具偏好"}
消息: "以后 API 报错先查官方文档" -> {"worth_remembering": true, "category": "decision", "reason": "工作原则"}
消息: "服务器 IP 是 192.168.1.100，端口 8080" -> {"worth_remembering": true, "category": "fact", "reason": "配置信息"}
消息: "遇到 jiti 缓存问题必须 rm -rf 再重启" -> {"worth_remembering": true, "category": "fact", "reason": "踩坑经验"}
消息: "我叫 Fred，时区是 GMT+8" -> {"worth_remembering": true, "category": "entity", "reason": "用户身份"}
消息: "你好" -> {"worth_remembering": false, "category": "other", "reason": "日常问候"}
消息: "帮我查一下天气" -> {"worth_remembering": false, "category": "other", "reason": "临时请求"}

消息: "{text}"
只输出 JSON:`;

/**
 * Call Kimi K2.5 API for classification
 */
async function classifyWithKimi(
  text: string,
  config: LLMClassificationConfig
): Promise<ClassificationResult | null> {
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey || "",
    "anthropic-version": "2023-06-01",
  };

  const prompt = CLASSIFICATION_PROMPT.replace("{text}", text);
  const data = {
    model: config.model || "kimi-k2.5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  };

  const maxRetries = config.maxRetries ?? 2;
  const timeout = config.timeout ?? 45000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${config.baseURL}/v1/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Extract text from response (skip thinking, get text)
      if (result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === "text" && item.text) {
            try {
              const parsed = JSON.parse(item.text);
              return {
                worthRemembering: parsed.worth_remembering ?? false,
                category: parsed.category || "other",
                reason: parsed.reason || "",
              };
            } catch (e) {
              // Try to extract JSON from text
              const jsonMatch = item.text.match(/\{[^}]+\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                  worthRemembering: parsed.worth_remembering ?? false,
                  category: parsed.category || "other",
                  reason: parsed.reason || "",
                };
              }
            }
          }
        }
      }

      return null;
    } catch (error: any) {
      if (attempt < maxRetries && error.name === "AbortError") {
        // Timeout, retry
        continue;
      }
      // Other errors or max retries reached
      return null;
    }
  }

  return null;
}

/**
 * Call Ollama API for classification.
 * Default baseURL points to BrainB (172.31.0.3:11434).
 */
async function classifyWithOllama(
  text: string,
  config: LLMClassificationConfig
): Promise<ClassificationResult | null> {
  const baseURL = config.baseURL || "http://localhost:11434";
  const model = config.model || "qwen3.5:2b";

  const prompt = CLASSIFICATION_PROMPT.replace("{text}", text);
  const data = {
    model,
    prompt,
    stream: false,
    think: false,   // Disable thinking mode for speed (Qwen3.5 default: on)
  };

  const maxRetries = config.maxRetries ?? 2;
  const timeout = config.timeout ?? 45000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseURL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const responseText = result.response || "";

      try {
        const parsed = JSON.parse(responseText);
        return {
          worthRemembering: parsed.worth_remembering ?? false,
          category: parsed.category || "other",
          reason: parsed.reason || "",
        };
      } catch (e) {
        // Try to extract JSON from response text (model may wrap it in markdown)
        const jsonMatch = responseText.match(/\{[\s\S]*?"worth_remembering"[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              worthRemembering: parsed.worth_remembering ?? false,
              category: parsed.category || "other",
              reason: parsed.reason || "",
            };
          } catch { /* fall through */ }
        }
        return null;
      }
    } catch (error: any) {
      if (attempt < maxRetries && error.name === "AbortError") {
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Classify a message using LLM
 * Returns null if classification fails (triggers fallback to rules)
 */
export async function classifyWithLLM(
  text: string,
  config: LLMClassificationConfig
): Promise<ClassificationResult | null> {
  if (!config.enabled) {
    return null;
  }

  // Skip very short or very long messages
  if (text.length < 4 || text.length > 500) {
    return null;
  }

  try {
    if (config.provider === "kimi") {
      return await classifyWithKimi(text, config);
    } else if (config.provider === "ollama") {
      return await classifyWithOllama(text, config);
    }
    return null;
  } catch (error) {
    // Silently fail and return null to trigger fallback
    return null;
  }
}
