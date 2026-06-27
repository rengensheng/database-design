// sidebar.js — 左侧主题域管理器
import { store } from './store.js';
import { getDomainColor, DOMAIN_COLORS } from './utils.js';
import { showDangerConfirmModal } from './modal.js';
import { getTableReferences, getTableStats, getDomainStats } from './deleteHelper.js';

export class Sidebar {
  constructor() {
    this.body = document.getElementById('sidebar-body');
    this.expandedDomains = new Set();
  }

  render() {
    const domains = store.getDomains();
    const tables = store.getTables();

    this.body.innerHTML = '';

    // Default group (no domain)
    const noDomainTables = tables.filter(t => !t.domainId);
    if (noDomainTables.length > 0) {
      this._renderDomainGroup({
        id: '__none__',
        name: '未分组',
        color: 'var(--text-muted)',
      }, noDomainTables, true);
    }

    domains.forEach(d => {
      const domainTables = tables.filter(t => t.domainId === d.id);
      this._renderDomainGroup(d, domainTables, false);
    });

    // Render icons
    if (window.lucide) lucide.createIcons({ root: this.body });
  }

  _renderDomainGroup(domain, tables, isDefault) {
    const wrapper = document.createElement('div');
    wrapper.className = 'domain-item' + (this.expandedDomains.has(domain.id) ? ' expanded' : '');
    if (!isDefault && this.expandedDomains.size === 0 && domain.id !== '__none__') {
      // Auto expand first domain
    }
    if (domain.id === '__none__') {
      wrapper.classList.add('expanded');
      this.expandedDomains.add('__none__');
    }

    const header = document.createElement('div');
    header.className = 'domain-header';
    header.innerHTML = `
      <i data-lucide="${this.expandedDomains.has(domain.id) ? 'chevron-down' : 'chevron-right'}"></i>
      <div class="domain-color-dot" style="background:${domain.color}"></div>
      <span class="domain-name">${domain.name}</span>
      <span class="domain-count">${tables.length}</span>
    `;

    header.addEventListener('click', () => {
      if (this.expandedDomains.has(domain.id)) {
        this.expandedDomains.delete(domain.id);
      } else {
        this.expandedDomains.add(domain.id);
      }
      this.render();
    });

    if (!isDefault) {
      header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._showDomainContextMenu(e, domain);
      });
    }

    wrapper.appendChild(header);

    const tableList = document.createElement('div');
    tableList.className = 'domain-tables';

    if (tables.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'domain-table-item';
      empty.style.opacity = '0.5';
      empty.style.fontStyle = 'italic';
      empty.textContent = '（空）';
      tableList.appendChild(empty);
    } else {
      tables.forEach(t => {
        const item = document.createElement('div');
        item.className = 'domain-table-item' + (store.selectedTableId === t.id ? ' selected' : '');
        item.innerHTML = `<i data-lucide="table-2"></i><span>${t.name}</span>`;
        item.addEventListener('click', () => {
          store.selectTable(t.id);
          this._scrollToTable(t.id);
        });
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._showTableContextMenu(e, t, domain);
        });
        tableList.appendChild(item);
      });
    }

    wrapper.appendChild(tableList);
    this.body.appendChild(wrapper);
  }

  _scrollToTable(tableId) {
    const table = store.getTable(tableId);
    if (!table) return;
    const el = document.querySelector(`[data-table-id="${tableId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }

  _showDomainContextMenu(e, domain) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = `
      <div class="context-menu-item" data-action="edit">
        <i data-lucide="pencil"></i>编辑主题域
      </div>
      <div class="context-menu-item" data-action="add-table">
        <i data-lucide="plus-square"></i>在此域新建表
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" data-action="delete">
        <i data-lucide="trash-2"></i>删除主题域
      </div>
    `;

    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.add('show');
    if (window.lucide) lucide.createIcons({ root: menu });

    menu.querySelectorAll('[data-action]').forEach(item => {
      item.addEventListener('click', () => {
        menu.classList.remove('show');
        const action = item.dataset.action;
        if (action === 'edit') {
          this._editDomain(domain);
        } else if (action === 'add-table') {
          const table = store.addTable({ domainId: domain.id, x: 200, y: 200 });
          store.selectTable(table.id);
        } else if (action === 'delete') {
          confirmDeleteDomain(domain);
        }
      });
    });
  }

  _showTableContextMenu(e, table, domain) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = `
      <div class="context-menu-item" data-action="select">
        <i data-lucide="mouse-pointer-click"></i>选择表
      </div>
      <div class="context-menu-item" data-action="move">
        <i data-lucide="folder-input"></i>移动到主题域
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" data-action="delete">
        <i data-lucide="trash-2"></i>删除表
      </div>
    `;

    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.add('show');
    if (window.lucide) lucide.createIcons({ root: menu });

    menu.querySelectorAll('[data-action]').forEach(item => {
      item.addEventListener('click', () => {
        menu.classList.remove('show');
        const action = item.dataset.action;
        if (action === 'select') {
          store.selectTable(table.id);
        } else if (action === 'move') {
          this._showMoveDialog(table);
        } else if (action === 'delete') {
          confirmDeleteTable(table);
        }
      });
    });
  }

  _editDomain(domain) {
    const name = prompt('主题域名称:', domain.name);
    if (name !== null && name.trim()) {
      store.updateDomain(domain.id, { name: name.trim() });
    }
  }

  _showMoveDialog(table) {
    const domains = store.getDomains();
    const options = '<option value="">未分组</option>' +
      domains.map(d => `<option value="${d.id}" ${table.domainId === d.id ? 'selected' : ''}>${d.name}</option>`).join('');
    const val = prompt(`移动表 "${table.name}" 到主题域（输入序号）:\n0. 未分组\n${domains.map((d, i) => `${i + 1}. ${d.name}`).join('\n')}`, '');
    if (val !== null) {
      const idx = parseInt(val);
      if (idx === 0) {
        store.updateTable(table.id, { domainId: null });
      } else if (idx >= 1 && idx <= domains.length) {
        store.updateTable(table.id, { domainId: domains[idx - 1].id });
      }
    }
  }
}

function confirmDeleteDomain(domain) {
  const stats = getDomainStats(domain.id);
  const detailLines = [`包含表：${stats.count} 张`];
  if (stats.count > 0) {
    detailLines.push('', '删除后这些表将变为未分组：');
    stats.names.forEach(name => detailLines.push(`• ${name}`));
  }

  showDangerConfirmModal({
    title: '删除主题域',
    message: `确认删除主题域 "<span style="color:var(--accent-orange)">${domain.name}</span>"？`,
    detail: detailLines.join('<br>'),
    dangerButton: '删除主题域',
    onConfirm: () => {
      store.removeDomain(domain.id);
    },
  });
}

function confirmDeleteTable(table) {
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