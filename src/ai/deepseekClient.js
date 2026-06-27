// deepseekClient.js — DeepSeek API 客户端（兼容 OpenAI 格式）

import { getAIConfig } from './aiConfig.js';

export class DeepSeekClient {
  constructor(config = null) {
    this.config = config || getAIConfig();
  }

  async chat(messages, options = {}) {
    const { stream = false, onStream } = options;
    const res = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature ?? 0.2,
        stream,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AI 请求失败 (${res.status}): ${text}`);
    }

    if (stream) {
      return this._readStream(res, onStream);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async _readStream(res, onStream) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const chunk = JSON.parse(trimmed.slice(6));
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            if (onStream) onStream(delta, fullContent);
          }
        } catch (e) {
          // ignore malformed stream chunk
        }
      }
    }

    return fullContent;
  }
}
