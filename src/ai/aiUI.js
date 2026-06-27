// aiUI.js — AI 功能 UI 层

import { showModal } from '../modal.js';
import { showToast } from '../toast.js';
import { store } from '../store.js';
import { uid, getDomainColor } from '../utils.js';
import { AIService, getAIConfig, saveAIConfig, isAIConfigured } from './index.js';

const STREAM_PLACEHOLDER = 'AI 正在思考，请稍候…';
let aiModalOpen = false;

function withAICheck(action) {
  if (!isAIConfigured()) {
    showAIConfigModal(action);
    return;
  }
  action();
}

function makeStreamModal({ title, promptLabel, placeholder, submitLabel, onGenerate, onApply }) {
  if (aiModalOpen) return { overlay: null, close: () => {} };
  aiModalOpen = true;

  const { overlay, close: baseClose } = showModal({
    title,
    size: 'lg',
    body: `
      <div class="form-section">
        <div class="form-label">${promptLabel}</div>
        <textarea class="form-textarea-large" id="ai-prompt" placeholder="${placeholder}"></textarea>
      </div>
      <div class="form-section">
        <div class="form-label">AI 输出</div>
        <pre class="sql-preview" id="ai-output" style="min-height:120px;max-height:240px;overflow:auto">${STREAM_PLACEHOLDER}</pre>
      </div>
      <div id="ai-preview-area"></div>
    `,
    footer: `
      <button class="btn" id="ai-close">关闭</button>
      <button class="btn" id="ai-generate" disabled><i data-lucide="sparkles"></i>${submitLabel}</button>
      <button class="btn primary" id="ai-apply" disabled>应用到画布</button>
    `,
  });

  const close = () => {
    aiModalOpen = false;
    baseClose();
  };

  const promptEl = document.getElementById('ai-prompt');
  const outputEl = document.getElementById('ai-output');
  const previewArea = document.getElementById('ai-preview-area');
  const generateBtn = document.getElementById('ai-generate');
  const applyBtn = document.getElementById('ai-apply');
  const closeBtn = document.getElementById('ai-close');

  let lastResult = null;

  const updateGenerateBtn = () => {
    generateBtn.disabled = !promptEl.value.trim();
  };
  promptEl.addEventListener('input', updateGenerateBtn);
  updateGenerateBtn();

  closeBtn.addEventListener('click', close);

  generateBtn.addEventListener('click', async () => {
    const prompt = promptEl.value.trim();
    if (!prompt) return;

    outputEl.textContent = STREAM_PLACEHOLDER;
    previewArea.innerHTML = '';
    generateBtn.disabled = true;
    applyBtn.disabled = true;
    lastResult = null;

    try {
      lastResult = await onGenerate(prompt, (delta, full) => {
        outputEl.textContent = full || STREAM_PLACEHOLDER;
        outputEl.scrollTop = outputEl.scrollHeight;
      });
      renderPreview(lastResult);
      applyBtn.disabled = false;
      showToast('AI 生成完成，请确认后应用', 'success');
    } catch (err) {
      outputEl.textContent = `错误：${err.message}`;
      showToast(err.message, 'error');
    } finally {
      generateBtn.disabled = false;
    }
  });

  let applying = false;
  applyBtn.addEventListener('click', () => {
    if (!lastResult || applying) return;
    applying = true;
    applyBtn.disabled = true;
    generateBtn.disabled = true;
    onApply(lastResult);
    close();
  });
  function renderPreview(result) {
    const tables = result?.tables || [];
    const fks = result?.foreignKeys || [];
    previewArea.innerHTML = `
      <div class="form-label">预览</div>
      <div style="font-size:12px;color:var(--text-secondary);background:var(--bg-primary);border:1px solid var(--border-default);border-radius:2px;padding:10px;max-height:200px;overflow:auto">
        <div style="margin-bottom:6px">表：${tables.map(t => `<span style="color:var(--accent-orange)">${t.name}</span>`).join(', ')}</div>
        <div>外键：${fks.length} 条</div>
      </div>
    `;
  }

  return { overlay, close };
}

export function showAIConfigModal(onSaved = null) {
  const config = getAIConfig();
  const { close } = showModal({
    title: 'AI 设置 — DeepSeek',
    body: `
      <div class="form-section">
        <div class="form-label">API Key</div>
        <input type="password" class="form-input" id="ai-api-key" value="${config.apiKey}" placeholder="sk-xxxxxxxxxxxxxxxx">
      </div>
      <div class="form-section">
        <div class="form-label">Base URL</div>
        <input type="text" class="form-input" id="ai-base-url" value="${config.baseURL}" placeholder="https://api.deepseek.com">
      </div>
      <div class="form-section">
        <div class="form-label">模型</div>
        <input type="text" class="form-input" id="ai-model" value="${config.model}" placeholder="deepseek-chat">
      </div>
      <div class="form-section">
        <div class="form-label">Temperature (${config.temperature})</div>
        <input type="range" class="form-input" id="ai-temperature" min="0" max="1" step="0.1" value="${config.temperature}">
      </div>
      <div style="font-size:11px;color:var(--text-muted)">默认使用 DeepSeek，API Key 仅保存在浏览器本地。</div>
    `,
    footer: `
      <button class="btn" id="ai-config-close">取消</button>
      <button class="btn primary" id="ai-config-save">保存</button>
    `,
  });

  const keyEl = document.getElementById('ai-api-key');
  const urlEl = document.getElementById('ai-base-url');
  const modelEl = document.getElementById('ai-model');
  const tempEl = document.getElementById('ai-temperature');

  tempEl.addEventListener('input', () => {
    tempEl.previousElementSibling.textContent = `Temperature (${tempEl.value})`;
  });

  document.getElementById('ai-config-close').addEventListener('click', close);
  document.getElementById('ai-config-save').addEventListener('click', () => {
    saveAIConfig({
      apiKey: keyEl.value.trim(),
      baseURL: urlEl.value.trim() || 'https://api.deepseek.com',
      model: modelEl.value.trim() || 'deepseek-chat',
      temperature: parseFloat(tempEl.value),
    });
    showToast('AI 配置已保存', 'success');
    close();
    if (onSaved) onSaved();
  });
}

export function showAICreateTableModal() {
  withAICheck(() => {
    const existingTables = store.getTables();
    makeStreamModal({
      title: 'AI 建表',
      promptLabel: '描述你需要的表结构',
      placeholder: '例如：设计一个电商订单系统，包含用户、商品、订单、订单明细四张表…',
      submitLabel: '生成表结构',
      onGenerate: async (prompt, onStream) => {
        const service = new AIService();
        return service.createTables(prompt, existingTables, onStream);
      },
      onApply: applyCreateTableResult,
    });
  });
}

export function showAIModifyTableModal(tableId) {
  withAICheck(() => {
    const table = store.getTable(tableId);
    if (!table) return;

    makeStreamModal({
      title: `AI 改表 — ${table.name}`,
      promptLabel: '描述你想要的修改',
      placeholder: '例如：给订单表增加 status、paid_at、remark 字段，并给 user_id 添加索引…',
      submitLabel: '生成修改',
      onGenerate: async (prompt, onStream) => {
        const service = new AIService();
        return service.modifyTable(table, prompt, onStream);
      },
      onApply: (result) => applyModifyTableResult(tableId, result),
    });
  });
}

export function showAIModifyColumnModal(tableId, columnId) {
  withAICheck(() => {
    const table = store.getTable(tableId);
    const column = store.getColumn(tableId, columnId);
    if (!table || !column) return;

    makeStreamModal({
      title: `AI 改字段 — ${table.name}.${column.name}`,
      promptLabel: '描述你想要的字段修改',
      placeholder: '例如：这个字段应该改成枚举类型，可选值为 pending、paid、shipped、completed…',
      submitLabel: '生成优化',
      onGenerate: async (prompt, onStream) => {
        const service = new AIService();
        return service.modifyColumn(table, column, prompt, onStream);
      },
      onApply: (result) => applyModifyColumnResult(tableId, columnId, result),
    });
  });
}

export function runAIAutoConnect() {
  withAICheck(async () => {
    const tables = store.getTables();
    if (tables.length < 2) {
      showToast('至少需要两张表才能自动连线', 'warning');
      return;
    }

    showToast('AI 正在分析外键关系…', 'info');
    try {
      const service = new AIService();
      const result = await service.autoConnect(tables);
      const count = applyAutoConnectResult(result);
      showToast(`已自动建立 ${count} 条外键连线`, count > 0 ? 'success' : 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
function applyCreateTableResult(result) {
  if (!result || !Array.isArray(result.tables)) {
    showToast('AI 返回数据格式不正确', 'error');
    return;
  }
  const existingNames = new Set(store.getTables().map(t => t.name));
  const domainMap = new Map(store.getDomains().map(d => [d.name, d.id]));
  let created = 0;
  let skipped = 0;

  result.tables.forEach((t) => {
    if (!t.name || existingNames.has(t.name)) {
      skipped++;
      return;
    }
    existingNames.add(t.name);

    let domainId = null;
    if (t.domain && !domainMap.has(t.domain)) {
      const color = getDomainColor(domainMap.size, document.documentElement.dataset.theme === 'dark');
      const d = store.addDomain(t.domain, color);
      domainMap.set(t.domain, d.id);
    }
    if (t.domain) domainId = domainMap.get(t.domain);

    const columns = normalizeColumns(t.columns);
    store.addTable({
      name: t.name,
      domainId,
      x: 80 + (created % 4) * 300,
      y: 80 + Math.floor(created / 4) * 280,
      columns,
      indexes: resolveIndexes(t.indexes, columns),
    });
    created++;
  });

  applyForeignKeys(result.foreignKeys || []);
  store.save();

  if (created === 0) {
    showToast('所有表已存在，未创建新表', 'warning');
  } else {
    const msg = skipped > 0 ? `已创建 ${created} 张表，跳过 ${skipped} 张重复/无名称` : `已创建 ${created} 张表`;
    showToast(msg, 'success');
  }
}
function applyModifyTableResult(tableId, result) {
  if (!result || !Array.isArray(result.tables) || result.tables.length === 0) {
    showToast('AI 返回数据格式不正确', 'error');
    return;
  }

  const table = store.getTable(tableId);
  const data = result.tables[0];
  const existingColumns = new Map(table.columns.map(c => [c.name, c]));

  const mergedColumns = (data.columns || []).map(c => {
    const existing = existingColumns.get(c.name);
    const normalized = normalizeColumn(c);
    if (existing) {
      normalized.id = existing.id;
      existingColumns.delete(c.name);
    }
    return normalized;
  });

  // Preserve any existing columns that AI didn't mention, to avoid accidental data loss
  existingColumns.forEach(c => mergedColumns.push(c));

  store.updateTable(tableId, {
    columns: mergedColumns,
    indexes: mergeIndexes(table.indexes, data.indexes || [], mergedColumns),
  });
  store.save();
  showToast('表结构已更新', 'success');
}

function resolveIndexes(indexes, columns) {
  if (!Array.isArray(indexes)) return [];
  const colByName = new Map(columns.map(c => [c.name, c.id]));
  return indexes.map(idx => ({
    id: idx.id || uid('i'),
    name: idx.name || `idx_${(idx.columns || []).join('_') || 'auto'}`,
    type: ['普通索引', '唯一索引', '全文索引'].includes(idx.type) ? idx.type : '普通索引',
    columns: (idx.columns || []).map(name => colByName.get(name)).filter(Boolean),
  })).filter(idx => idx.columns.length > 0);
}

function mergeIndexes(existingIndexes, newIndexes, columns) {
  const colByName = new Map(columns.map(c => [c.name, c.id]));
  const merged = existingIndexes.map(idx => ({
    ...idx,
    columns: idx.columns.map(cid => {
      const col = columns.find(c => c.id === cid);
      return col ? col.id : cid;
    }).filter(Boolean),
  }));

  newIndexes.forEach(idx => {
    const colIds = (idx.columns || []).map(name => colByName.get(name)).filter(Boolean);
    if (colIds.length === 0) return;
    const name = idx.name || `idx_${idx.columns.join('_')}`;
    const type = ['普通索引', '唯一索引', '全文索引'].includes(idx.type) ? idx.type : '普通索引';
    const exists = merged.some(i => i.name === name);
    if (!exists) merged.push({ id: uid('i'), name, type, columns: colIds });
  });

  return merged.filter(idx => idx.columns.length > 0);
}

function applyModifyColumnResult(tableId, columnId, result) {
  const colData = extractColumnFromResult(result);
  if (!colData) {
    showToast('AI 返回字段格式不正确', 'error');
    return;
  }

  store.updateColumn(tableId, columnId, normalizeColumn(colData));
  store.save();
  showToast('字段已优化', 'success');
}

function extractColumnFromResult(result) {
  if (!result) return null;
  if (result.column && typeof result.column === 'object') return result.column;
  if (Array.isArray(result.tables?.[0]?.columns)) return result.tables[0].columns[0];
  if (typeof result === 'object' && result.name) return result;
  return null;
}

function applyAutoConnectResult(result) {
  return applyForeignKeys(result.foreignKeys || []);
}

function applyForeignKeys(foreignKeys) {
  let count = 0;
  const tables = store.getTables();
  const tableByName = new Map(tables.map(t => [t.name, t]));

  foreignKeys.forEach(fk => {
    const fromTable = tableByName.get(fk.fromTable);
    const toTable = tableByName.get(fk.toTable);
    if (!fromTable || !toTable) return;

    const fromCol = fromTable.columns.find(c => c.name === fk.fromColumn);
    const toCol = toTable.columns.find(c => c.name === fk.toColumn);
    if (!fromCol || !toCol) return;

    const exists = fromTable.foreignKeys.some(
      f => f.fromColumn === fromCol.id && f.toTable === toTable.id && f.toColumn === toCol.id
    );
    if (exists) return;

    store.addForeignKey(fromTable.id, {
      fromColumn: fromCol.id,
      toTable: toTable.id,
      toColumn: toCol.id,
      onDelete: fk.onDelete || 'RESTRICT',
      onUpdate: fk.onUpdate || 'RESTRICT',
    });
    count++;
  });

  store.save();
  return count;
}

function normalizeColumns(columns) {
  if (!Array.isArray(columns)) return [];
  return columns.map(normalizeColumn);
}

function normalizeColumn(c) {
  return {
    id: c.id || uid('c'),
    name: c.name || 'unnamed',
    type: c.type || 'varchar',
    length: c.length ?? '',
    notNull: Boolean(c.notNull),
    default: c.default ?? '',
    comment: c.comment ?? '',
    isPrimary: Boolean(c.isPrimary),
    check: c.check ?? '',
  };
}