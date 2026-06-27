// deleteHelper.js — 删除前影响范围分析

import { store } from './store.js';

/**
 * 获取引用指定表的外键信息
 * @returns {Array<{fromTableName: string, fromColumnName: string, toColumnName: string}>}
 */
export function getTableReferences(tableId) {
  const refs = [];
  const targetTable = store.getTable(tableId);
  if (!targetTable) return refs;

  store.getTables().forEach(t => {
    t.foreignKeys.forEach(fk => {
      if (fk.toTable === tableId) {
        const fromCol = t.columns.find(c => c.id === fk.fromColumn);
        const toCol = targetTable.columns.find(c => c.id === fk.toColumn);
        refs.push({
          fromTableId: t.id,
          fromTableName: t.name,
          fromColumnName: fromCol?.name || '?',
          toColumnName: toCol?.name || '?',
        });
      }
    });
  });

  return refs;
}

/**
 * 获取主题域下的表数量及名称列表
 */
export function getDomainStats(domainId) {
  const tables = store.getTables().filter(t => t.domainId === domainId);
  return {
    count: tables.length,
    names: tables.map(t => t.name),
  };
}

/**
 * 获取字段被引用的情况
 * @returns {Object} { indexes: number, foreignKeysIn: number, foreignKeysOut: number }
 */
export function getColumnReferences(tableId, columnId) {
  const table = store.getTable(tableId);
  if (!table) return { indexes: 0, foreignKeysIn: 0, foreignKeysOut: 0 };

  let indexes = 0;
  table.indexes.forEach(idx => {
    if (idx.columns.includes(columnId)) indexes++;
  });

  let foreignKeysOut = 0;
  table.foreignKeys.forEach(fk => {
    if (fk.fromColumn === columnId) foreignKeysOut++;
  });

  let foreignKeysIn = 0;
  store.getTables().forEach(t => {
    t.foreignKeys.forEach(fk => {
      if (fk.toTable === tableId && fk.toColumn === columnId) foreignKeysIn++;
    });
  });

  return { indexes, foreignKeysIn, foreignKeysOut };
}

/**
 * 获取表的基本统计信息
 */
export function getTableStats(tableId) {
  const table = store.getTable(tableId);
  if (!table) return { columns: 0, indexes: 0, foreignKeysIn: 0, foreignKeysOut: 0 };

  const refs = getTableReferences(tableId);
  return {
    columns: table.columns.length,
    indexes: table.indexes.length,
    foreignKeysIn: refs.length,
    foreignKeysOut: table.foreignKeys.length,
  };
}
