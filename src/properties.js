// properties.js — 右侧属性面板
import { store } from './store.js';
import { MYSQL_TYPES } from './utils.js';
import { showToast } from './toast.js';
import { showAIModifyTableModal, showAIModifyColumnModal } from './ai/aiUI.js';
import { showDangerConfirmModal } from './modal.js';
import { getTableReferences, getTableStats, getColumnReferences } from './deleteHelper.js';
export class PropertiesPanel {
  constructor() {
    this.body = document.getElementById('props-body');
  }

  render() {
    const { selectedTableId, selectedColumnId, selectedConnectionId } = store;

    if (selectedConnectionId) {
      this._renderConnectionProps(selectedConnectionId);
    } else if (selectedColumnId && selectedTableId) {
      this._renderColumnProps(selectedTableId, selectedColumnId);
    } else if (selectedTableId) {
      this._renderTableProps(selectedTableId);
    } else {
      this._renderEmpty();
    }

    if (window.lucide) lucide.createIcons({ root: this.body });
  }

  _renderEmpty() {
    this.body.innerHTML = `
      <div class="props-empty">
        <i data-lucide="mouse-pointer-click"></i>
        <div class="props-empty-text">选择表或字段以编辑属性</div>
      </div>
    `;
  }

  _renderTableProps(tableId) {
    const table = store.getTable(tableId);
    if (!table) return this._renderEmpty();

    const domains = store.getDomains();
    const domainOptions = '<option value="">未分组</option>' +
      domains.map(d => `<option value="${d.id}" ${table.domainId === d.id ? 'selected' : ''}>${d.name}</option>`).join('');

    const indexRows = table.indexes.map(idx => {
      const selectedCols = idx.columns.map(c => {
        const colName = table.columns.find(x => x.id === c)?.name || '?';
        return `<span class="idx-col-tag" data-idx-col-remove="${idx.id}:${c}" style="display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border:1px solid var(--accent-orange);border-radius:2px;font-size:9px;color:var(--accent-orange);cursor:pointer;margin-right:2px">${colName} <i data-lucide="x" style="width:8px;height:8px"></i></span>`;
      }).join('');
      const availableCols = table.columns.filter(c => !idx.columns.includes(c.id)).map(c =>
        `<span class="idx-col-add" data-idx-col-add="${idx.id}:${c.id}" style="display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border:1px solid var(--border-default);border-radius:2px;font-size:9px;color:var(--text-muted);cursor:pointer;margin-right:2px;margin-bottom:2px">${c.name} <i data-lucide="plus" style="width:8px;height:8px"></i></span>`
      ).join('');
      return `
        <div class="prop-index-item">
          <input class="prop-input" data-idx-name="${idx.id}" value="${idx.name}" placeholder="索引名" style="flex:1">
          <select class="prop-select" data-idx-type="${idx.id}" style="width:85px">
            <option ${idx.type === '普通索引' ? 'selected' : ''}>普通索引</option>
            <option ${idx.type === '唯一索引' ? 'selected' : ''}>唯一索引</option>
            <option ${idx.type === '全文索引' ? 'selected' : ''}>全文索引</option>
          </select>
          <button class="prop-index-delete" data-idx-delete="${idx.id}"><i data-lucide="trash-2"></i></button>
        </div>
        <div style="font-size:9px;color:var(--text-muted);margin:4px 0 2px;padding-left:4px;text-transform:uppercase;letter-spacing:0.04em">已选字段:</div>
        <div style="margin-bottom:4px;padding-left:4px">${selectedCols || '<span style="font-size:10px;color:var(--text-muted);font-style:italic">无</span>'}</div>
        <div style="font-size:9px;color:var(--text-muted);margin:4px 0 2px;padding-left:4px;text-transform:uppercase;letter-spacing:0.04em">可添加:</div>
        <div style="margin-bottom:8px;padding-left:4px;display:flex;flex-wrap:wrap">${availableCols || '<span style="font-size:10px;color:var(--text-muted);font-style:italic">全部已选</span>'}</div>
      `;
    }).join('');

    this.body.innerHTML = `
      <div class="prop-group">
        <div class="prop-group-title">表属性</div>
        <div class="prop-row">
          <label class="prop-label">表名</label>
          <input class="prop-input" id="prop-table-name" value="${table.name}">
        </div>
        <div class="prop-row">
          <label class="prop-label">主题域</label>
          <select class="prop-select" id="prop-table-domain">${domainOptions}</select>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">字段列表 (${table.columns.length})</div>
        ${table.columns.map(c => `
          <div class="prop-row" style="cursor:pointer" data-col-select="${c.id}">
            <span style="width:14px;flex-shrink:0;color:${c.isPrimary ? 'var(--accent-orange)' : 'var(--text-muted)'}">
              <i data-lucide="${c.isPrimary ? 'key' : 'circle'}" style="width:12px;height:12px"></i>
            </span>
            <span style="flex:1;font-family:var(--font-mono);font-size:11px;color:var(--text-primary)">${c.name}</span>
            <span style="color:var(--accent-blue);font-family:var(--font-mono);font-size:10px">${c.length ? `${c.type}(${c.length})` : c.type}</span>
          </div>
        `).join('')}
      </div>

      <div class="prop-group">
        <div class="prop-group-title">索引管理</div>
        ${indexRows || '<div style="color:var(--text-muted);font-size:10px;padding:4px 0">暂无索引</div>'}
        <button class="prop-add-btn" id="prop-add-index">
          <i data-lucide="plus"></i>添加索引
        </button>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">操作</div>
        <button class="btn sm" id="prop-add-column" style="width:100%;justify-content:center;margin-bottom:6px">
          <i data-lucide="plus"></i>添加字段
        </button>
        <button class="btn sm ai-btn" id="prop-ai-modify-table" style="width:100%;justify-content:center;margin-bottom:6px">
          <i data-lucide="sparkles"></i>AI 改表
        </button>
        <button class="btn danger sm" id="prop-delete-table" style="width:100%;justify-content:center">
          <i data-lucide="trash-2"></i>删除表
        </button>
      </div>
    `;

    // Wire events
    document.getElementById('prop-table-name').addEventListener('change', (e) => {
      store.updateTable(tableId, { name: e.target.value || 'unnamed' });
    });

    document.getElementById('prop-table-domain').addEventListener('change', (e) => {
      store.updateTable(tableId, { domainId: e.target.value || null });
    });

    this.body.querySelectorAll('[data-col-select]').forEach(row => {
      row.addEventListener('click', () => {
        store.selectColumn(tableId, row.dataset.colSelect);
      });
    });

    this.body.querySelectorAll('[data-idx-name]').forEach(input => {
      input.addEventListener('change', () => {
        store.updateIndex(tableId, input.dataset.idxName, { name: input.value });
      });
    });

    this.body.querySelectorAll('[data-idx-type]').forEach(sel => {
      sel.addEventListener('change', () => {
        store.updateIndex(tableId, sel.dataset.idxType, { type: sel.value });
      });
    });

    this.body.querySelectorAll('[data-idx-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.removeIndex(tableId, btn.dataset.idxDelete);
        showToast('索引已删除', 'success');
      });
    });

    // Index column add/remove
    this.body.querySelectorAll('[data-idx-col-remove]').forEach(tag => {
      tag.addEventListener('click', () => {
        const [idxId, colId] = tag.dataset.idxColRemove.split(':');
        const idx = table.indexes.find(i => i.id === idxId);
        if (idx) {
          store.updateIndex(tableId, idxId, { columns: idx.columns.filter(c => c !== colId) });
        }
      });
    });

    this.body.querySelectorAll('[data-idx-col-add]').forEach(tag => {
      tag.addEventListener('click', () => {
        const [idxId, colId] = tag.dataset.idxColAdd.split(':');
        const idx = table.indexes.find(i => i.id === idxId);
        if (idx) {
          store.updateIndex(tableId, idxId, { columns: [...idx.columns, colId] });
        }
      });
    });

    document.getElementById('prop-add-index').addEventListener('click', () => {
      if (table.columns.length === 0) {
        showToast('请先添加字段', 'warning');
        return;
      }
      const idx = store.addIndex(tableId, { columns: [table.columns[0].id] });
      showToast('索引已添加', 'success');
    });

    document.getElementById('prop-add-column').addEventListener('click', () => {
      const col = store.addColumn(tableId, {});
      store.selectColumn(tableId, col.id);
    });

    document.getElementById('prop-ai-modify-table').addEventListener('click', () => {
      showAIModifyTableModal(tableId);
    });

    document.getElementById('prop-delete-table').addEventListener('click', () => {
      confirmDeleteTableFromProps(table);
    });

    function confirmDeleteTableFromProps(table) {
      const refs = getTableReferences(table.id);
      const stats = getTableStats(table.id);
      const detailLines = [
        `字段：${stats.columns} 个`,
        `索引：${stats.indexes} 个`,
        `外键引用本表：${stats.foreignKeysIn} 处`,
        `本表引用他人：${stats.foreignKeysOut} 处`,
      ];

      if (refs.length > 0) {
        detailLines.push('', '将被移除的外键引用：');
        refs.forEach(r => {
          detailLines.push(`• ${r.fromTableName}.${r.fromColumnName} → ${table.name}.${r.toColumnName}`);
        });
      }

      showDangerConfirmModal({
        title: '删除表',
        message: `确认删除表 "<span style="color:var(--accent-orange)">${table.name}</span>"？删除后不可恢复。`,
        detail: detailLines.join('<br>'),
        dangerButton: '删除表',
        onConfirm: () => {
          store.removeTable(table.id);
          showToast(`已删除表: ${table.name}`, 'success');
        },
      });
    }
  }

  _renderColumnProps(tableId, columnId) {
    const col = store.getColumn(tableId, columnId);
    if (!col) return this._renderTableProps(tableId);

    const typeOptions = MYSQL_TYPES.map(t => `<option value="${t}" ${col.type === t ? 'selected' : ''}>${t}</option>`).join('');

    this.body.innerHTML = `
      <div class="prop-group">
        <div class="prop-group-title">字段属性</div>
        <div class="prop-row">
          <label class="prop-label">字段名</label>
          <input class="prop-input" id="prop-col-name" value="${col.name}">
        </div>
        <div class="prop-row">
          <label class="prop-label">数据类型</label>
          <select class="prop-select" id="prop-col-type">${typeOptions}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">长度</label>
          <input class="prop-input" id="prop-col-length" value="${col.length || ''}" placeholder="如 255 或 10,2">
        </div>
        <div class="prop-row">
          <label class="prop-label">默认值</label>
          <input class="prop-input" id="prop-col-default" value="${col.default || ''}" placeholder="如 0 或 CURRENT_TIMESTAMP">
        </div>
        <div class="prop-row">
          <label class="prop-label">注释</label>
          <input class="prop-input" id="prop-col-comment" value="${col.comment || ''}" placeholder="字段说明">
        </div>
        <div class="prop-row">
          <label class="prop-label">CHECK</label>
          <input class="prop-input" id="prop-col-check" value="${col.check || ''}" placeholder="如 age >= 0">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">约束</div>
        <div class="prop-row">
          <div class="prop-checkbox ${col.isPrimary ? 'checked' : ''}" id="prop-col-pk">
            <div class="prop-checkbox-box"></div>
            <span class="prop-checkbox-label">主键 (Primary Key)</span>
          </div>
        </div>
        <div class="prop-row">
          <div class="prop-checkbox ${col.notNull ? 'checked' : ''}" id="prop-col-notnull">
            <div class="prop-checkbox-box"></div>
            <span class="prop-checkbox-label">非空 (NOT NULL)</span>
          </div>
        </div>
      </div>
      <div class="prop-group">
        <div class="prop-group-title">操作</div>
        <button class="btn sm ai-btn" id="prop-ai-modify-col" style="width:100%;justify-content:center;margin-bottom:6px">
          <i data-lucide="sparkles"></i>AI 优化字段
        </button>
        <button class="btn danger sm" id="prop-delete-col" style="width:100%;justify-content:center">
          <i data-lucide="trash-2"></i>删除字段
        </button>
      </div>
    `;

    // Wire events
    const updateField = (field, el) => {
      el.addEventListener('change', () => {
        store.updateColumn(tableId, columnId, { [field]: el.value });
      });
    };

    updateField('name', document.getElementById('prop-col-name'));
    updateField('type', document.getElementById('prop-col-type'));
    updateField('length', document.getElementById('prop-col-length'));
    updateField('default', document.getElementById('prop-col-default'));
    updateField('comment', document.getElementById('prop-col-comment'));
    updateField('check', document.getElementById('prop-col-check'));

    document.getElementById('prop-col-pk').addEventListener('click', (e) => {
      const isPk = !e.currentTarget.classList.contains('checked');
      store.updateColumn(tableId, columnId, { isPrimary: isPk });
    });

    document.getElementById('prop-col-notnull').addEventListener('click', (e) => {
      const isNn = !e.currentTarget.classList.contains('checked');
      store.updateColumn(tableId, columnId, { notNull: isNn });
    });
    document.getElementById('prop-ai-modify-col').addEventListener('click', () => {
      showAIModifyColumnModal(tableId, columnId);
    });
    document.getElementById('prop-delete-col').addEventListener('click', () => {
      confirmDeleteColumnFromProps(table, col);
    });

    function confirmDeleteColumnFromProps(table, col) {
      const refs = getColumnReferences(table.id, col.id);
      const detailLines = [];

      if (refs.indexes > 0) detailLines.push(`索引引用：${refs.indexes} 个`);
      if (refs.foreignKeysOut > 0) detailLines.push(`作为外键起点：${refs.foreignKeysOut} 处`);
      if (refs.foreignKeysIn > 0) detailLines.push(`被其他表外键引用：${refs.foreignKeysIn} 处`);

      if (detailLines.length === 0) detailLines.push('无关联引用');

      showDangerConfirmModal({
        title: '删除字段',
        message: `确认删除字段 "<span style="color:var(--accent-orange)">${table.name}.${col.name}</span>"？`,
        detail: detailLines.join('<br>'),
        dangerButton: '删除字段',
        onConfirm: () => {
          store.removeColumn(table.id, col.id);
          showToast(`已删除字段: ${col.name}`, 'success');
        },
      });
    }
  }

  _renderConnectionProps(connId) {
    // Find the FK across all tables
    let fkTable = null, fk = null;
    for (const t of store.getTables()) {
      const found = t.foreignKeys.find(f => f.id === connId);
      if (found) { fkTable = t; fk = found; break; }
    }
    if (!fk) return this._renderEmpty();

    const fromCol = fkTable.columns.find(c => c.id === fk.fromColumn);
    const toTable = store.getTable(fk.toTable);
    const toCol = toTable?.columns.find(c => c.id === fk.toColumn);

    this.body.innerHTML = `
      <div class="prop-group">
        <div class="prop-group-title">外键关系</div>
        <div style="padding:8px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:2px;margin-bottom:10px">
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-primary)">
            <span style="color:var(--accent-orange)">${fkTable.name}</span>.<span>${fromCol?.name}</span>
          </div>
          <div style="text-align:center;color:var(--text-muted);font-size:10px;padding:4px 0">↓ references ↓</div>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-primary)">
            <span style="color:var(--accent-blue)">${toTable?.name}</span>.<span>${toCol?.name}</span>
          </div>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">删除/更新规则</div>
        <div class="prop-row">
          <label class="prop-label">ON DELETE</label>
          <select class="prop-select" id="prop-fk-delete">
            <option ${fk.onDelete === 'CASCADE' ? 'selected' : ''}>CASCADE</option>
            <option ${fk.onDelete === 'RESTRICT' ? 'selected' : ''}>RESTRICT</option>
            <option ${fk.onDelete === 'SET NULL' ? 'selected' : ''}>SET NULL</option>
            <option ${fk.onDelete === 'NO ACTION' ? 'selected' : ''}>NO ACTION</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">ON UPDATE</label>
          <select class="prop-select" id="prop-fk-update">
            <option ${fk.onUpdate === 'CASCADE' ? 'selected' : ''}>CASCADE</option>
            <option ${fk.onUpdate === 'RESTRICT' ? 'selected' : ''}>RESTRICT</option>
            <option ${fk.onUpdate === 'SET NULL' ? 'selected' : ''}>SET NULL</option>
            <option ${fk.onUpdate === 'NO ACTION' ? 'selected' : ''}>NO ACTION</option>
          </select>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">操作</div>
        <button class="btn danger sm" id="prop-delete-fk" style="width:100%;justify-content:center">
          <i data-lucide="trash-2"></i>删除外键
        </button>
      </div>
    `;

    document.getElementById('prop-fk-delete').addEventListener('change', (e) => {
      store.updateForeignKey(fkTable.id, connId, { onDelete: e.target.value });
      showToast('外键规则已更新', 'success');
    });

    document.getElementById('prop-fk-update').addEventListener('change', (e) => {
      store.updateForeignKey(fkTable.id, connId, { onUpdate: e.target.value });
      showToast('外键规则已更新', 'success');
    });

    document.getElementById('prop-delete-fk').addEventListener('click', () => {
      const fromCol = fkTable.columns.find(c => c.id === fk.fromColumn);
      const toTable = store.getTable(fk.toTable);
      const toCol = toTable?.columns.find(c => c.id === fk.toColumn);
      showDangerConfirmModal({
        title: '删除外键',
        message: '确认删除此外键关系？',
        detail: `${fkTable.name}.${fromCol?.name || '?'} → ${toTable?.name || '?'}.${toCol?.name || '?'}`,
        dangerButton: '删除',
        onConfirm: () => {
          store.removeForeignKey(fkTable.id, connId);
          showToast('外键已删除', 'success');
        },
      });
    });
  }
}