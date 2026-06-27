// dict.js — 数据字典生成（Markdown格式）

import { store } from './store.js';

export function generateDataDictionary(state = store.state) {
  const lines = [];
  const tables = state.tables || [];

  lines.push(`# ${state.projectName || '数据库设计'} — 数据字典`);
  lines.push('');
  lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`> 表数量: ${tables.length} | 版本: v${state.version || 1}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Table of contents
  lines.push('## 目录');
  lines.push('');
  tables.forEach((t, i) => {
    lines.push(`${i + 1}. [${t.name}](#${t.name})`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  tables.forEach(table => {
    lines.push(`## ${table.name}`);
    lines.push('');

    // Column table
    lines.push('| 字段名 | 数据类型 | 长度 | 主键 | 非空 | 默认值 | CHECK约束 | 注释 |');
    lines.push('|--------|----------|------|------|------|--------|-----------|------|');

    table.columns.forEach(col => {
      const pk = col.isPrimary ? '✅ PK' : '';
      const nn = col.notNull ? '✅' : '';
      const check = col.check || '';
      const comment = col.comment || '';
      lines.push(`| \`${col.name}\` | ${col.type} | ${col.length || '-'} | ${pk} | ${nn} | ${col.default || '-'} | ${check} | ${comment} |`);
    });

    lines.push('');

    // Indexes
    if (table.indexes.length > 0) {
      lines.push('### 索引');
      lines.push('');
      lines.push('| 索引名 | 类型 | 字段 |');
      lines.push('|--------|------|------|');
      table.indexes.forEach(idx => {
        const colNames = idx.columns.map(cId => {
          const c = table.columns.find(c => c.id === cId);
          return c ? c.name : '?';
        }).join(', ');
        lines.push(`| \`${idx.name}\` | ${idx.type} | ${colNames} |`);
      });
      lines.push('');
    }

    // Foreign Keys
    if (table.foreignKeys.length > 0) {
      lines.push('### 外键关系');
      lines.push('');
      lines.push('| 字段 | 引用表 | 引用字段 | ON DELETE | ON UPDATE |');
      lines.push('|------|--------|----------|-----------|-----------|');
      table.foreignKeys.forEach(fk => {
        const fromCol = table.columns.find(c => c.id === fk.fromColumn);
        const toTable = tables.find(t => t.id === fk.toTable);
        const toCol = toTable?.columns.find(c => c.id === fk.toColumn);
        lines.push(`| \`${fromCol?.name || '?'}\` | \`${toTable?.name || '?'}\` | \`${toCol?.name || '?'}\` | ${fk.onDelete} | ${fk.onUpdate} |`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}
