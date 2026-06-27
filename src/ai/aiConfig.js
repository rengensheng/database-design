// aiConfig.js — AI 配置管理

const CONFIG_KEY = 'dbforge_ai_config';

const DEFAULT_CONFIG = {
  provider: 'deepseek',
  baseURL: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.2,
};

export function getAIConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_CONFIG, ...saved };
  } catch (e) {
    console.error('Failed to load AI config:', e);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAIConfig(config) {
  try {
    const current = getAIConfig();
    const next = { ...current, ...config };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    console.error('Failed to save AI config:', e);
    return null;
  }
}

export function isAIConfigured() {
  const config = getAIConfig();
  return Boolean(config.apiKey && config.baseURL && config.model);
}
