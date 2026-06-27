// aiService.js — AI 业务服务层

import { DeepSeekClient } from './deepseekClient.js';
import {
  buildCreateTablePrompt,
  buildModifyTablePrompt,
  buildModifyColumnPrompt,
  buildAutoConnectPrompt,
} from './promptBuilder.js';

function extractJSON(text) {
  const cleaned = text.trim();
  const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function safeParseJSON(text) {
  const json = extractJSON(text);
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error(`AI 返回内容解析失败: ${e.message}`);
  }
}

export class AIService {
  constructor(config = null) {
    this.client = new DeepSeekClient(config);
  }

  async createTables(description, existingTables = [], onStream = null) {
    const messages = buildCreateTablePrompt(description, existingTables);
    const content = await this.client.chat(messages, { stream: Boolean(onStream), onStream });
    return safeParseJSON(content);
  }

  async modifyTable(table, requirement, onStream = null) {
    const messages = buildModifyTablePrompt(table, requirement);
    const content = await this.client.chat(messages, { stream: Boolean(onStream), onStream });
    return safeParseJSON(content);
  }

  async modifyColumn(table, column, requirement, onStream = null) {
    const messages = buildModifyColumnPrompt(table, column, requirement);
    const content = await this.client.chat(messages, { stream: Boolean(onStream), onStream });
    return safeParseJSON(content);
  }

  async autoConnect(tables, onStream = null) {
    const messages = buildAutoConnectPrompt(tables);
    const content = await this.client.chat(messages, { stream: Boolean(onStream), onStream });
    return safeParseJSON(content);
  }
}
