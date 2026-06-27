// diff.js — 版本比对

import { generateIncrementalSQL } from './sql.js';

export function compareModels(oldState, newState) {
  const diffs = [];

  const oldTables = new Map((oldState.tables || []).map(t => [t.name, t]));
  const newTables = new Map((newState.tables || []).map(t => [t.name, t]));

  // Deleted tables
  for (const [name] of oldTables) {
    if (!newTables.has(name)) {
      diffs.push({ type: 'delete', scope: 'table', table: name, detail: `删除表: ${name}` });
    }
  }

  // Added tables
  for (const [name] of newTables) {
    if (!oldTables.has(name)) {
      diffs.push({ type: 'add', scope: 'table', table: name, detail: `新增表: ${name}` });
    }
  }

  // Modified tables
  for (const [name, newTable] of newTables) {
    const oldTable = oldTables.get(name);
    if (!oldTable) continue;

    const oldCols = new Map(oldTable.columns.map(c => [c.name, c]));
    const newCols = new Map(newTable.columns.map(c => [c.name, c]));

    // Deleted columns
    for (const [colName] of oldCols) {
      if (!newCols.has(colName)) {
        diffs.push({ type: 'delete', scope: 'column', table: name, column: colName, detail: `删除字段: ${name}.${colName}` });
      }
    }

    // Added columns
    for (const [colName, col] of newCols) {
      if (!oldCols.has(colName)) {
        const typeStr = col.length ? `${col.type}(${col.length})` : col.type;
        diffs.push({ type: 'add', scope: 'column', table: name, column: colName, detail: `新增字段: ${name}.${colName} (${typeStr})` });
      }
    }

    // Modified columns
    for (const [colName, newCol] of newCols) {
      const oldCol = oldCols.get(colName);
      if (!oldCol) continue;
      const oldTypeStr = oldCol.length ? `${oldCol.type}(${oldCol.length})` : oldCol.type;
      const newTypeStr = newCol.length ? `${newCol.type}(${newCol.length})` : newCol.type;

      if (oldTypeStr !== newTypeStr) {
        diffs.push({ type: 'modify', scope: 'column', table: name, column: colName, detail: `类型变更: ${name}.${colName} ${oldTypeStr} → ${newTypeStr}`, oldVal: oldTypeStr, newVal: newTypeStr });
      }

      if (oldCol.notNull !== newCol.notNull) {
        diffs.push({ type: 'modify', scope: 'column', table: name, column: colName, detail: `约束变更: ${name}.${colName} ${oldCol.notNull ? 'NOT NULL' : 'NULL'} → ${newCol.notNull ? 'NOT NULL' : 'NULL'}` });
      }

      if (oldCol.default !== newCol.default) {
        diffs.push({ type: 'modify', scope: 'column', table: name, column: colName, detail: `默认值变更: ${name}.${colName} '${oldCol.default}' → '${newCol.default}'` });
      }

      if (oldCol.isPrimary !== newCol.isPrimary) {
        diffs.push({ type: 'modify', scope: 'column', table: name, column: colName, detail: `主键变更: ${name}.${colName} ${oldCol.isPrimary ? '是主键' : '非主键'} → ${newCol.isPrimary ? '是主键' : '非主键'}` });
      }
    }

    // FK changes
    const oldFkKeys = new Set(oldTable.foreignKeys.map(f => {
      const c = oldTable.columns.find(c => c.id === f.fromColumn);
      const t = oldState.tables.find(t => t.id === f.toTable);
      const tc = t?.columns.find(c => c.id === f.toColumn);
      return `${c?.name}->${t?.name}.${tc?.name}`;
    }));
    const newFkKeys = new Set(newTable.foreignKeys.map(f => {
      const c = newTable.columns.find(c => c.id === f.fromColumn);
      const t = newState.tables.find(t => t.id === f.toTable);
      const tc = t?.columns.find(c => c.id === f.toColumn);
      return `${c?.name}->${t?.name}.${tc?.name}`;
    }));

    for (const key of oldFkKeys) {
      if (!newFkKeys.has(key)) {
        diffs.push({ type: 'delete', scope: 'fk', table: name, detail: `删除外键: ${name}.${key}` });
      }
    }
    for (const key of newFkKeys) {
      if (!oldFkKeys.has(key)) {
        diffs.push({ type: 'add', scope: 'fk', table: name, detail: `新增外键: ${name}.${key}` });
      }
    }

    // Index changes
    const oldIdx = new Set(oldTable.indexes.map(i => i.name));
    const newIdx = new Set(newTable.indexes.map(i => i.name));
    for (const idx of oldIdx) {
      if (!newIdx.has(idx)) diffs.push({ type: 'delete', scope: 'index', table: name, detail: `删除索引: ${name}.${idx}` });
    }
    for (const idx of newIdx) {
      if (!oldIdx.has(idx)) diffs.push({ type: 'add', scope: 'index', table: name, detail: `新增索引: ${name}.${idx}` });
    }
  }

  return {
    diffs,
    summary: {
      added: diffs.filter(d => d.type === 'add').length,
      deleted: diffs.filter(d => d.type === 'delete').length,
      modified: diffs.filter(d => d.type === 'modify').length,
    },
    incrementalSQL: generateIncrementalSQL(oldState, newState),
  };
}
