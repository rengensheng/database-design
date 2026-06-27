// table.js — 表格组件渲染与交互
import { store } from './store.js';
import { uid, escapeHtml, getSmartSuggestion, MYSQL_TYPES } from './utils.js';
import { showToast } from './toast.js';
import { showDangerConfirmModal } from './modal.js';
import { getTableReferences, getTableStats } from './deleteHelper.js';

export class TableRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.content = document.getElementById('canvas-content');
    this.connectionLayer = document.getElementById('connection-layer');
    this.connectionRenderer = null;
    this.connecting = null; // { fromTableId, fromColumnId, startX, startY }
    this.onColumnPortClick = null;

    this._init();
  }

  setConnectionRenderer(r) {
    this.connectionRenderer = r;
  }

  _init() {
    // Global mouse move for connection dragging
    window.addEventListener('mousemove', (e) => {
      if (this.connecting) {
        this._updateTempConnection(e);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.connecting) {
        this._finishConnection(e);
      }
    });
  }

/**
   * 将十六进制颜色调暗 amount 值（0-255）
   * 用于亮色主题下让浅色域颜色可见
   */
  _darkenColor(hex, amount) {
    if (!hex || !hex.startsWith('#')) return hex;
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 将十六进制颜色提亮 amount 值（0-255）
   */
  _lightenColor(hex, amount) {
    if (!hex || !hex.startsWith('#')) return hex;
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + amount);
    g = Math.min(255, g + amount);
    b = Math.min(255, b + amount);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 判断十六进制颜色是否为浅色
   */
  _isLightColor(hex) {
    if (!hex || !hex.startsWith('#')) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128;
  }



  renderAll() {
    // Remove existing table elements
    this.content.querySelectorAll('.db-table').forEach(el => el.remove());

    const tables = store.getTables();
    tables.forEach(t => this._renderTable(t));

    // Render domain group backgrounds
    this._renderDomainGroups();

    // Render connections
    if (this.connectionRenderer) this.connectionRenderer.renderAll();

    // Update empty state
    const empty = document.getElementById('canvas-empty');
    if (empty) empty.style.display = tables.length === 0 ? 'flex' : 'none';
  }

  _renderDomainGroups() {
    // Remove existing
    this.content.querySelectorAll('.domain-group').forEach(el => el.remove());

    const domains = store.getDomains();
    const tables = store.getTables();

    domains.forEach(d => {
      const domainTables = tables.filter(t => t.domainId === d.id);
      if (domainTables.length === 0) return;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      domainTables.forEach(t => {
        const el = this.content.querySelector(`[data-table-id="${t.id}"]`);
        const w = el ? el.offsetWidth : 260;
        const h = el ? el.offsetHeight : 200;
        minX = Math.min(minX, t.x - 15);
        minY = Math.min(minY, t.y - 15);
        maxX = Math.max(maxX, t.x + w + 15);
        maxY = Math.max(maxY, t.y + h + 15);
      });

const group = document.createElement('div');
      group.className = 'domain-group';
      group.style.left = `${minX}px`;
      group.style.top = `${minY}px`;
      group.style.width = `${maxX - minX}px`;
      group.style.height = `${maxY - minY}px`;
      // 根据主题调整域边框和背景颜色
      const isLightTheme = document.documentElement.dataset.theme === 'light';
      const domainColor = d.color;
      const isLightColor = this._isLightColor(domainColor);
      let borderColor, bgColor, labelColor, bgAlpha;
      if (isLightTheme) {
        borderColor = isLightColor ? this._darkenColor(domainColor, 40) : domainColor;
        bgColor = isLightColor ? this._darkenColor(domainColor, 5) : domainColor;
        labelColor = isLightColor ? this._darkenColor(domainColor, 50) : domainColor;
        bgAlpha = '15';
      } else {
        // 暗色主题：浅色域颜色加深，深色域颜色提亮，确保在深色背景可见
        if (isLightColor) {
          borderColor = this._darkenColor(domainColor, 100);
          bgColor = this._darkenColor(domainColor, 90);
          labelColor = this._darkenColor(domainColor, 80);
        } else {
          borderColor = this._lightenColor(domainColor, 60);
          bgColor = this._lightenColor(domainColor, 40);
          labelColor = this._lightenColor(domainColor, 80);
        }
        bgAlpha = '30';
      }


      group.style.borderColor = borderColor;
      group.style.background = bgColor + bgAlpha;

      const label = document.createElement('div');
      label.className = 'domain-group-label';
      label.style.color = labelColor;
      label.textContent = d.name;
      group.appendChild(label);

      this.content.insertBefore(group, this.content.firstChild);
    });
  }

  _renderTable(table) {
    const el = document.createElement('div');
    el.className = 'db-table';
    el.dataset.tableId = table.id;
    el.style.left = `${table.x}px`;
    el.style.top = `${table.y}px`;

    if (store.selectedTableId === table.id) el.classList.add('selected');
// Domain color bar
    const domain = table.domainId ? store.getDomains().find(d => d.id === table.domainId) : null;
    if (domain) {
      const isLight = document.documentElement.dataset.theme === 'light';
      const bar = document.createElement('div');
      bar.className = 'db-table-domain-bar';
      bar.style.background = isLight ? this._darkenColor(domain.color, 30) : domain.color;
      el.appendChild(bar);
    }

    // Header
    const header = document.createElement('div');
    header.className = 'db-table-header';

    const title = document.createElement('input');
    title.className = 'db-table-title';
    title.value = table.name;
    title.addEventListener('change', () => {
      store.updateTable(table.id, { name: title.value || 'unnamed' });
    });
    title.addEventListener('mousedown', (e) => e.stopPropagation());
    header.appendChild(title);

    // DB badge for reverse-engineered tables
    if (table.isFromDB) {
      const badge = document.createElement('span');
      badge.className = 'db-table-badge';
      badge.innerHTML = '<i data-lucide="database"></i>DB';
      header.appendChild(badge);
    }

    el.appendChild(header);

    // Body (columns)
    const body = document.createElement('div');
    body.className = 'db-table-body';

    table.columns.forEach(col => {
      body.appendChild(this._renderColumn(table.id, col));
    });

    el.appendChild(body);

    // Footer (indexes - always created, toggleable)
    const footer = document.createElement('div');
    footer.className = 'db-table-footer';
    if (table.indexes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'db-index-row';
      empty.style.color = 'var(--text-muted)';
      empty.style.fontStyle = 'italic';
      empty.textContent = '暂无索引';
      footer.appendChild(empty);
    } else {
      table.indexes.forEach(idx => {
        const row = document.createElement('div');
        row.className = 'db-index-row';
        const typeClass = idx.type === '唯一索引' ? 'unique' : idx.type === '全文索引' ? 'fulltext' : 'normal';
        const colNames = idx.columns.map(cId => {
          const c = table.columns.find(c => c.id === cId);
          return c ? c.name : '?';
        }).join(', ');
        row.innerHTML = `
          <span class="db-index-type ${typeClass}">${idx.type}</span>
          <span>${escapeHtml(idx.name)} (${escapeHtml(colNames)})</span>
        `;
        footer.appendChild(row);
      });
    }
    el.appendChild(footer);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'db-table-actions';
    actions.innerHTML = `
      <button class="db-table-action-btn" data-action="add-col">
        <i data-lucide="plus"></i>添加字段
      </button>
      <button class="db-table-action-btn" data-action="toggle-index">
        <i data-lucide="list"></i>索引
      </button>
      <div style="flex:1"></div>
      <button class="db-table-action-btn danger" data-action="delete">
        <i data-lucide="trash-2"></i>删除
      </button>
    `;
    el.appendChild(actions);

    // Wire actions
    actions.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'add-col') {
          const col = store.addColumn(table.id, {});
          store.selectColumn(table.id, col.id);
        } else if (action === 'toggle-index') {
          el.classList.toggle('hide-indexes');
        } else if (action === 'delete') {
          confirmDeleteTableFromCard(table);
        }
      });
    });

    // Table drag
    this._makeDraggable(el, header, table);
// Click to select (only when clicking table header or non-interactive areas)
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.db-table-action-btn') || e.target.closest('.db-column-port') ||
          e.target.closest('.db-column-pk') || e.target.closest('.db-column') ||
          e.target.tagName === 'INPUT' ||
          e.target.getAttribute('contenteditable') === 'true') return;
      store.selectTable(table.id);
    });

    // Double-click header to edit name
    title.addEventListener('focus', () => title.select());

    this.content.appendChild(el);

    // Render icons
    if (window.lucide) lucide.createIcons({ root: el });
  }

  confirmDeleteTableFromCard(table) {
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

  _renderColumn(tableId, col) {
    const row = document.createElement('div');
    row.className = 'db-column';
    row.dataset.columnId = col.id;
    row.dataset.tableId = tableId;

    if (store.selectedColumnId === col.id) row.style.background = 'var(--bg-hover)';

    // PK toggle
    const pk = document.createElement('div');
    pk.className = 'db-column-pk' + (col.isPrimary ? ' active' : '');
    pk.innerHTML = `<i data-lucide="${col.isPrimary ? 'key' : 'circle'}"></i>`;
    pk.title = '点击切换主键';
    pk.addEventListener('click', (e) => {
      e.stopPropagation();
      store.updateColumn(tableId, col.id, { isPrimary: !col.isPrimary });
      showToast(col.isPrimary ? '已取消主键' : '已设为主键', 'success');
    });
    row.appendChild(pk);
// Connection ports — 左右各一个
    const portLeft = document.createElement('div');
    portLeft.className = 'db-column-port left';
    portLeft.title = '拖拽建立外键连接';
    portLeft.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this._startConnection(tableId, col.id, e, 'left');
    });
    row.appendChild(portLeft);

    const portRight = document.createElement('div');
    portRight.className = 'db-column-port right';
    portRight.title = '拖拽建立外键连接';
    portRight.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this._startConnection(tableId, col.id, e, 'right');
    });
    row.appendChild(portRight);

    // 点击字段行任意位置 → 选中字段（显示字段配置）
    row.addEventListener('mousedown', (e) => {
      // 排除 port、pk、contenteditable 等元素
      if (e.target.closest('.db-column-port') || e.target.closest('.db-column-pk')) return;
      if (e.target.getAttribute('contenteditable') === 'true') return;
      e.stopPropagation();
      store.selectColumn(tableId, col.id);
    });
    // Column name (inline editable)
    const nameEl = document.createElement('span');
    nameEl.className = 'db-column-name';
    nameEl.textContent = col.name;
    nameEl.title = '点击编辑字段名';
    nameEl.addEventListener('click', (e) => {
      e.stopPropagation();
      store.selectColumn(tableId, col.id);
    });
    nameEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      nameEl.setAttribute('contenteditable', 'true');
      nameEl.focus();
      document.execCommand('selectAll', false, null);
    });
    nameEl.addEventListener('blur', () => {
      nameEl.removeAttribute('contenteditable');
      const newName = nameEl.textContent.trim();
      if (newName && newName !== col.name) {
        store.updateColumn(tableId, col.id, { name: newName });
        // Smart auto-complete
        const suggestion = getSmartSuggestion(newName);
        if (suggestion) {
          store.updateColumn(tableId, col.id, suggestion);
          showToast(`已自动补全 "${newName}" 的类型与默认值`, 'info');
        }
      }
    });
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.textContent = col.name; nameEl.blur(); }
    });
    row.appendChild(nameEl);

    // Type display
    const typeEl = document.createElement('span');
    typeEl.className = 'db-column-type' + (col.isPrimary ? ' pk' : '');
    const typeText = col.length ? `${col.type}(${col.length})` : col.type;
    typeEl.textContent = typeText;
    row.appendChild(typeEl);

    // Null display
    const nullEl = document.createElement('span');
    nullEl.className = 'db-column-null';
    nullEl.textContent = col.notNull ? 'NN' : 'NULL';
    row.appendChild(nullEl);

    return row;
  }

  _makeDraggable(el, handle, table) {
    let isDragging = false;
    let startX, startY, origX, origY;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.target.closest('.db-column-port')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = table.x;
      origY = table.y;
      el.classList.add('dragging');
      e.preventDefault();
      e.stopPropagation();
      store.selectTable(table.id);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const scale = this.canvas.transform.scale;
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      const newX = Math.round((origX + dx) / 10) * 10; // grid snap
      const newY = Math.round((origY + dy) / 10) * 10;
      store.updateTable(table.id, { x: newX, y: newY });
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
      if (this.connectionRenderer) this.connectionRenderer.renderAll();
      this._renderDomainGroups();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        el.classList.remove('dragging');
      }
    });
  }

// ====== Connection (Foreign Key) ======
  _startConnection(fromTableId, fromColumnId, e, side) {
    const rect = this.content.getBoundingClientRect();
    const port = e.target;
    const portRect = port.getBoundingClientRect();

    this.connecting = {
      fromTableId,
      fromColumnId,
      side,
      startX: (portRect.left + portRect.width / 2 - rect.left) / this.canvas.transform.scale,
      startY: (portRect.top + portRect.height / 2 - rect.top) / this.canvas.transform.scale,
    };

    this.viewport = document.getElementById('canvas-viewport');
    this.viewport.classList.add('connecting');
  }

  _updateTempConnection(e) {
    if (!this.connecting) return;
    const rect = this.content.getBoundingClientRect();
    const scale = this.canvas.transform.scale;
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;

    // Draw temp line with orthogonal path
    let tempPath = this.connectionLayer.querySelector('.connection-path-temp');
    if (!tempPath) {
      tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.classList.add('connection-path-temp');
      this.connectionLayer.appendChild(tempPath);
    }

    const { startX, startY, side } = this.connecting;
    const pathData = this._tempOrthogonalPath(startX, startY, mouseX, mouseY, side);
    tempPath.setAttribute('d', pathData);
  }

  /** 临时连线的正交路径：从 port 向外延伸，再水平/垂直到鼠标 */
  _tempOrthogonalPath(x1, y1, mouseX, mouseY, fromSide) {
    const margin = 30;
    // 如果鼠标在起点的延伸方向上，走简单 L 形
    if (fromSide === 'right') {
      const midX = Math.max(x1 + margin, mouseX);
      return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${mouseY} L ${mouseX} ${mouseY}`;
    } else {
      const midX = Math.min(x1 - margin, mouseX);
      return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${mouseY} L ${mouseX} ${mouseY}`;
    }
  }

  _finishConnection(e) {
    if (!this.connecting) return;
    this.viewport.classList.remove('connecting');

    // Remove temp path
    const tempPath = this.connectionLayer.querySelector('.connection-path-temp');
    if (tempPath) tempPath.remove();

    // Find target column
    const targetEl = document.elementFromPoint(e.clientX, e.clientY);
    if (targetEl) {
      const colEl = targetEl.closest('.db-column');
      if (colEl) {
        const toTableId = colEl.dataset.tableId;
        const toColumnId = colEl.dataset.columnId;

        if (toTableId === this.connecting.fromTableId) {
          showToast('不能连接到同一张表', 'error');
        } else {
          // Check if target column is primary key
          const targetCol = store.getColumn(toTableId, toColumnId);
          if (!targetCol) {
            showToast('未找到目标字段', 'error');
          } else if (!targetCol.isPrimary) {
            showToast(`目标字段 "${targetCol.name}" 不是主键，无法建立外键`, 'error');
          } else {
            // Check if FK already exists
            const fromTable = store.getTable(this.connecting.fromTableId);
            const exists = fromTable.foreignKeys.find(fk =>
              fk.fromColumn === this.connecting.fromColumnId &&
              fk.toTable === toTableId &&
              fk.toColumn === toColumnId
            );
            if (exists) {
              showToast('该外键关系已存在', 'warning');
            } else {
              store.addForeignKey(this.connecting.fromTableId, {
                fromColumn: this.connecting.fromColumnId,
                toTable: toTableId,
                toColumn: toColumnId,
              });
              showToast('外键连接已建立', 'success');
            }
          }
        }
      }
    }

    this.connecting = null;
  }
}