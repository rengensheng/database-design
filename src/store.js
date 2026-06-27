// store.js — 数据存储与状态管理

import { uid, deepClone, formatDateTime, debounce } from './utils.js';

const STORAGE_KEY = 'dbforge_project';
const HISTORY_KEY = 'dbforge_file_history';
const MAX_HISTORY = 20;

class Store {
  constructor() {
    this.state = {
      projectName: '未命名项目',
      domains: [],
      tables: [],
      version: 1,
      lastSaved: formatDateTime(),
    };
    this.listeners = [];
    this.selectedTableId = null;
    this.selectedColumnId = null;
    this.selectedConnectionId = null;
    this.canvasTransform = { x: 0, y: 0, scale: 1 };
    this.lastSavedState = null;
    this.isDirty = false;
    this.currentFilePath = null; // 当前打开的文件路径（Tauri环境）
  }

  /** Load from localStorage */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.state = { ...this.state, ...data };
        this.lastSavedState = deepClone(this.state);
        this.isDirty = false;
        return true;
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
    return false;
  }

  /** Save to localStorage */
  save() {
    try {
      this.state.lastSaved = formatDateTime();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.lastSavedState = deepClone(this.state);
      this.isDirty = false;
      this._notify('save');
      return true;
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
      return false;
    }
  }

  /** Debounced auto-save */
  autoSave = debounce(() => {
    this.save();
  }, 500);

  /** Mark dirty and trigger auto-save */
  markDirty() {
    this.isDirty = true;
    this.autoSave();
    this._notify('change');
  }

  /** Subscribe to changes */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  _notify(event) {
    this.listeners.forEach(l => l(event, this.state));
  }

  // ====== Project ======
  setProjectName(name) {
    this.state.projectName = name;
    this.markDirty();
  }

  getProject() {
    return deepClone(this.state);
  }

  loadProject(data, filePath = null) {
    this.state = {
      projectName: data.projectName || '未命名项目',
      domains: data.domains || [],
      tables: data.tables || [],
      version: (data.version || 1) + 1,
      lastSaved: formatDateTime(),
    };
    this.selectedTableId = null;
    this.selectedColumnId = null;
    this.selectedConnectionId = null;
    this.currentFilePath = filePath;
    this.markDirty();
    this.save();
    if (filePath) this.addFileHistory(filePath, data.projectName || '未命名项目');
    this._notify('project-loaded');
  }

  /** 设置当前文件路径 */
  setCurrentFilePath(path) {
    this.currentFilePath = path;
    if (path) this.addFileHistory(path, this.state.projectName);
    this._notify('filepath-changed');
  }

  // ====== 文件历史管理 ======

  /** 获取文件历史列表 */
  getFileHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /** 添加文件到历史记录 */
  addFileHistory(filePath, projectName) {
    if (!filePath) return;
    let history = this.getFileHistory();
    // 去重：移除同路径的旧记录
    history = history.filter(h => h.path !== filePath);
    // 添加到顶部
    history.unshift({
      path: filePath,
      name: projectName || '未命名项目',
      timestamp: formatDateTime(),
    });
    // 限制数量
    history = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    this._notify('history-changed');
  }

  /** 从历史记录中移除 */
  removeFileHistory(filePath) {
    let history = this.getFileHistory();
    history = history.filter(h => h.path !== filePath);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    this._notify('history-changed');
  }

  /** 清空历史记录 */
  clearFileHistory() {
    localStorage.removeItem(HISTORY_KEY);
    this._notify('history-changed');
  }

  /** 新建空项目 */
  newProject() {
    this.state = {
      projectName: '未命名项目',
      domains: [],
      tables: [],
      version: 1,
      lastSaved: formatDateTime(),
    };
    this.selectedTableId = null;
    this.selectedColumnId = null;
    this.selectedConnectionId = null;
    this.currentFilePath = null;
    this.markDirty();
    this.save();
    this._notify('project-loaded');
  }

  // ====== Domains ======
  addDomain(name, color) {
    const domain = { id: uid('d'), name: name || '新主题域', color: color || '#e6f7ff' };
    this.state.domains.push(domain);
    this.markDirty();
    return domain;
  }

  updateDomain(id, updates) {
    const d = this.state.domains.find(d => d.id === id);
    if (d) { Object.assign(d, updates); this.markDirty(); }
  }

  removeDomain(id) {
    this.state.domains = this.state.domains.filter(d => d.id !== id);
    // Unlink tables from this domain
    this.state.tables.forEach(t => {
      if (t.domainId === id) t.domainId = null;
    });
    this.markDirty();
  }

  getDomains() {
    return this.state.domains;
  }

  // ====== Tables ======
  addTable(tableData = {}) {
    const table = {
      id: uid('t'),
      name: tableData.name || `table_${this.state.tables.length + 1}`,
      domainId: tableData.domainId || null,
      x: tableData.x ?? 100,
      y: tableData.y ?? 100,
      isFromDB: tableData.isFromDB || false,
      columns: tableData.columns || [
        { id: uid('c'), name: 'id', type: 'int', length: '11', notNull: true, default: '', comment: '主键ID', isPrimary: true, check: '' }
      ],
      indexes: tableData.indexes || [],
      foreignKeys: tableData.foreignKeys || [],
    };
    this.state.tables.push(table);
    this.markDirty();
    return table;
  }

  updateTable(id, updates) {
    const t = this.state.tables.find(t => t.id === id);
    if (t) { Object.assign(t, updates); this.markDirty(); }
  }

  removeTable(id) {
    this.state.tables = this.state.tables.filter(t => t.id !== id);
    // Remove foreign keys pointing to this table
    this.state.tables.forEach(t => {
      t.foreignKeys = t.foreignKeys.filter(fk => fk.toTable !== id);
    });
    if (this.selectedTableId === id) {
      this.selectedTableId = null;
      this.selectedColumnId = null;
    }
    this.markDirty();
  }

  getTable(id) {
    return this.state.tables.find(t => t.id === id);
  }

  getTables() {
    return this.state.tables;
  }

  // ====== Columns ======
  addColumn(tableId, columnData = {}) {
    const t = this.getTable(tableId);
    if (!t) return null;
    const col = {
      id: uid('c'),
      name: columnData.name || `field_${t.columns.length + 1}`,
      type: columnData.type || 'varchar',
      length: columnData.length ?? '255',
      notNull: columnData.notNull ?? false,
      default: columnData.default ?? '',
      comment: columnData.comment ?? '',
      isPrimary: columnData.isPrimary ?? false,
      check: columnData.check ?? '',
    };
    t.columns.push(col);
    this.markDirty();
    return col;
  }

  updateColumn(tableId, columnId, updates) {
    const t = this.getTable(tableId);
    if (!t) return;
    const col = t.columns.find(c => c.id === columnId);
    if (col) {
      Object.assign(col, updates);
      this.markDirty();
    }
  }

  removeColumn(tableId, columnId) {
    const t = this.getTable(tableId);
    if (!t) return;
    t.columns = t.columns.filter(c => c.id !== columnId);
    // Remove indexes referencing this column
    t.indexes.forEach(idx => {
      idx.columns = idx.columns.filter(c => c !== columnId);
    });
    t.indexes = t.indexes.filter(idx => idx.columns.length > 0);
    // Remove FKs referencing this column
    t.foreignKeys = t.foreignKeys.filter(fk => fk.fromColumn !== columnId);
    // Remove FKs in other tables pointing to this column
    this.state.tables.forEach(other => {
      if (other.id !== tableId) {
        other.foreignKeys = other.foreignKeys.filter(fk => !(fk.toTable === tableId && fk.toColumn === columnId));
      }
    });
    if (this.selectedColumnId === columnId) {
      this.selectedColumnId = null;
    }
    this.markDirty();
  }

  getColumn(tableId, columnId) {
    const t = this.getTable(tableId);
    if (!t) return null;
    return t.columns.find(c => c.id === columnId);
  }

  // ====== Indexes ======
  addIndex(tableId, indexData = {}) {
    const t = this.getTable(tableId);
    if (!t) return null;
    const idx = {
      id: uid('i'),
      name: indexData.name || `idx_${t.columns.length}`,
      type: indexData.type || '普通索引',
      columns: indexData.columns || [],
    };
    t.indexes.push(idx);
    this.markDirty();
    return idx;
  }

  updateIndex(tableId, indexId, updates) {
    const t = this.getTable(tableId);
    if (!t) return;
    const idx = t.indexes.find(i => i.id === indexId);
    if (idx) { Object.assign(idx, updates); this.markDirty(); }
  }

  removeIndex(tableId, indexId) {
    const t = this.getTable(tableId);
    if (!t) return;
    t.indexes = t.indexes.filter(i => i.id !== indexId);
    this.markDirty();
  }

  // ====== Foreign Keys ======
  addForeignKey(fromTableId, fkData) {
    const t = this.getTable(fromTableId);
    if (!t) return null;
    const fk = {
      id: uid('fk'),
      fromColumn: fkData.fromColumn,
      toTable: fkData.toTable,
      toColumn: fkData.toColumn,
      onDelete: fkData.onDelete || 'RESTRICT',
      onUpdate: fkData.onUpdate || 'RESTRICT',
    };
    t.foreignKeys.push(fk);
    this.markDirty();
    return fk;
  }

  updateForeignKey(tableId, fkId, updates) {
    const t = this.getTable(tableId);
    if (!t) return;
    const fk = t.foreignKeys.find(f => f.id === fkId);
    if (fk) { Object.assign(fk, updates); this.markDirty(); }
  }

  removeForeignKey(tableId, fkId) {
    const t = this.getTable(tableId);
    if (!t) return;
    t.foreignKeys = t.foreignKeys.filter(f => f.id !== fkId);
    if (this.selectedConnectionId === fkId) this.selectedConnectionId = null;
    this.markDirty();
  }

  /** Get all foreign keys as connections with resolved references */
  getConnections() {
    const conns = [];
    this.state.tables.forEach(t => {
      t.foreignKeys.forEach(fk => {
        const toTable = this.getTable(fk.toTable);
        const fromCol = t.columns.find(c => c.id === fk.fromColumn);
        const toCol = toTable?.columns.find(c => c.id === fk.toColumn);
        if (toTable && fromCol && toCol) {
          conns.push({
            id: fk.id,
            fromTableId: t.id,
            fromColumnId: fk.fromColumn,
            toTableId: fk.toTable,
            toColumnId: fk.toColumn,
            onDelete: fk.onDelete,
            onUpdate: fk.onUpdate,
            fromTableName: t.name,
            fromColumnName: fromCol.name,
            toTableName: toTable.name,
            toColumnName: toCol.name,
          });
        }
      });
    });
    return conns;
  }

  // ====== Selection ======
  selectTable(id) {
    this.selectedTableId = id;
    this.selectedColumnId = null;
    this.selectedConnectionId = null;
    this._notify('select');
  }

  selectColumn(tableId, columnId) {
    this.selectedTableId = tableId;
    this.selectedColumnId = columnId;
    this.selectedConnectionId = null;
    this._notify('select');
  }

  selectConnection(id) {
    this.selectedConnectionId = id;
    this.selectedTableId = null;
    this.selectedColumnId = null;
    this._notify('select');
  }

  clearSelection() {
    this.selectedTableId = null;
    this.selectedColumnId = null;
    this.selectedConnectionId = null;
    this._notify('select');
  }

  // ====== Canvas ======
  setCanvasTransform(transform) {
    this.canvasTransform = { ...this.canvasTransform, ...transform };
  }

  /** Get a snapshot for version comparison */
  getSnapshot() {
    return deepClone(this.state);
  }

  /** Count stats */
  getStats() {
    const tableCount = this.state.tables.length;
    const fkCount = this.state.tables.reduce((sum, t) => sum + t.foreignKeys.length, 0);
    const domainCount = this.state.domains.length;
    return { tableCount, fkCount, domainCount };
  }
}

export const store = new Store();