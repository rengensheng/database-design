// main.js — 应用入口

import { store } from './store.js';
import { Canvas } from './canvas.js';
import { TableRenderer } from './table.js';
import { ConnectionRenderer } from './connection.js';
import { Sidebar } from './sidebar.js';
import { PropertiesPanel } from './properties.js';
import { showModal, showDangerConfirmModal } from './modal.js';
import { showToast } from './toast.js';
import { getTableReferences, getTableStats } from './deleteHelper.js';
import { FileManager } from './fileManager.js';
import { generateFullSQL } from './sql.js';
import { generateDataDictionary } from './dict.js';
import { compareModels } from './diff.js';
import { parseCreateTableSQL, resolveFKReferences } from './parser.js';
import { getDomainColor } from './utils.js';
import {
  showAIConfigModal,
  showAICreateTableModal,
  showAIModifyTableModal,
  showAIModifyColumnModal,
  runAIAutoConnect,
} from './ai/aiUI.js';

// ====== Initialize ======
const canvas = new Canvas();
const connectionRenderer = new ConnectionRenderer(canvas);
const tableRenderer = new TableRenderer(canvas);
tableRenderer.setConnectionRenderer(connectionRenderer);
const sidebar = new Sidebar();
const propertiesPanel = new PropertiesPanel();

// ====== State change handler ======
store.subscribe((event) => {
  tableRenderer.renderAll();
  sidebar.render();
  propertiesPanel.render();
  updateStatusBar();
  updateSaveIndicator();
});

// ====== Connection double-click → edit in properties ======
connectionRenderer.onConnectionClick = (conn) => {
  store.selectConnection(conn.id);
};

// ====== Load saved data ======
if (!store.load()) {
  // First time - create a demo project
  store.state.projectName = '示例电商系统';
  const userDomain = store.addDomain('用户域', '#e6f7ff');
  const orderDomain = store.addDomain('订单域', '#fff2e8');

  const userTable = store.addTable({
    name: 'user',
    domainId: userDomain.id,
    x: 80,
    y: 100,
    columns: [
      { id: 'c_uid', name: 'id', type: 'int', length: '11', notNull: true, default: '', comment: '用户ID', isPrimary: true, check: '' },
      { id: 'c_uname', name: 'name', type: 'varchar', length: '50', notNull: true, default: '', comment: '姓名', isPrimary: false, check: '' },
      { id: 'c_uemail', name: 'email', type: 'varchar', length: '100', notNull: false, default: '', comment: '邮箱', isPrimary: false, check: '' },
      { id: 'c_upwd', name: 'password', type: 'varchar', length: '255', notNull: true, default: '', comment: '密码', isPrimary: false, check: '' },
      { id: 'c_ucreated', name: 'created_at', type: 'datetime', length: '', notNull: false, default: 'CURRENT_TIMESTAMP', comment: '创建时间', isPrimary: false, check: '' },
    ],
    indexes: [
      { id: 'i_uemail', name: 'idx_email', type: '唯一索引', columns: ['c_uemail'] },
    ],
  });

  const orderTable = store.addTable({
    name: 'orders',
    domainId: orderDomain.id,
    x: 460,
    y: 100,
    columns: [
      { id: 'c_oid', name: 'id', type: 'int', length: '11', notNull: true, default: '', comment: '订单ID', isPrimary: true, check: '' },
      { id: 'c_ouser', name: 'user_id', type: 'int', length: '11', notNull: true, default: '', comment: '用户ID', isPrimary: false, check: '' },
      { id: 'c_oamount', name: 'amount', type: 'decimal', length: '10,2', notNull: true, default: '0.00', comment: '金额', isPrimary: false, check: '' },
      { id: 'c_ostatus', name: 'status', type: 'tinyint', length: '1', notNull: true, default: '0', comment: '状态', isPrimary: false, check: '' },
      { id: 'c_ocreated', name: 'created_at', type: 'datetime', length: '', notNull: false, default: 'CURRENT_TIMESTAMP', comment: '创建时间', isPrimary: false, check: '' },
    ],
    indexes: [
      { id: 'i_ouser', name: 'idx_user_id', type: '普通索引', columns: ['c_ouser'] },
    ],
  });

  store.addForeignKey(orderTable.id, {
    fromColumn: 'c_ouser',
    toTable: userTable.id,
    toColumn: 'c_uid',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  });

  store.save();
}

// ====== Initial render ======
tableRenderer.renderAll();
sidebar.render();
propertiesPanel.render();
updateStatusBar();
if (window.lucide) lucide.createIcons();

// ====== Status bar ======
function updateStatusBar() {
  const stats = store.getStats();
  document.getElementById('status-tables').textContent = `${stats.tableCount} 表`;
  document.getElementById('status-connections').textContent = `${stats.fkCount} 外键`;
  document.getElementById('status-domains').textContent = `${stats.domainCount} 主题域`;
  document.getElementById('status-version').textContent = `v${store.state.version}`;

  // 更新文件路径显示
  const filePathText = document.getElementById('status-filepath-text');
  const filePathEl = document.getElementById('status-filepath');
  if (store.currentFilePath) {
    const shortPath = store.currentFilePath.length > 40
      ? '...' + store.currentFilePath.slice(-37)
      : store.currentFilePath;
    filePathText.textContent = shortPath;
    filePathEl.title = store.currentFilePath;
    filePathEl.style.color = 'var(--accent-orange)';
  } else {
    filePathText.textContent = store.isDirty ? '未保存*' : '未保存';
    filePathEl.title = '';
    filePathEl.style.color = '';
  }
}

function updateSaveIndicator() {
  const el = document.getElementById('status-save');
  if (store.isDirty) {
    el.classList.add('saving');
    el.innerHTML = '<i data-lucide="refresh-cw"></i><span>保存中...</span>';
  } else {
    el.classList.remove('saving');
    el.innerHTML = '<i data-lucide="check-circle"></i><span>已保存</span>';
  }
  if (window.lucide) lucide.createIcons({ root: el });
}

// ====== Project name input ======
document.getElementById('project-name-input').addEventListener('change', (e) => {
  store.setProjectName(e.target.value);
});

// Set initial project name
document.getElementById('project-name-input').value = store.state.projectName;

// ====== Toolbar dropdown menus ======
function initToolbarDropdowns() {
  const dropdowns = document.querySelectorAll('.toolbar-dropdown');

  dropdowns.forEach((dropdown) => {
    const trigger = dropdown.querySelector('.menu-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      closeAllToolbarDropdowns();
      if (!isOpen) {
        dropdown.classList.add('open');
      }
    });
  });

  document.addEventListener('click', (e) => {
    const dropdown = e.target.closest('.toolbar-dropdown');
    if (!dropdown || e.target.closest('.toolbar-menu-item')) {
      closeAllToolbarDropdowns();
    }
  });
}

function closeAllToolbarDropdowns() {
  document.querySelectorAll('.toolbar-dropdown.open').forEach((d) => d.classList.remove('open'));
}

initToolbarDropdowns();

// ====== Toolbar buttons ======

// New table
document.getElementById('btn-new-table').addEventListener('click', () => {
  // Place at center of current viewport
  const rect = document.getElementById('canvas-viewport').getBoundingClientRect();
  const pos = canvas.screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
  const table = store.addTable({
    x: Math.round(pos.x / 10) * 10,
    y: Math.round(pos.y / 10) * 10,
  });
  store.selectTable(table.id);
  showToast('新表已创建', 'success');
});

// New domain
document.getElementById('btn-new-domain').addEventListener('click', () => {
  const domains = store.getDomains();
  const color = getDomainColor(domains.length, document.documentElement.dataset.theme === 'dark');
  const domain = store.addDomain(`主题域_${domains.length + 1}`, color);
  showToast(`主题域已创建: ${domain.name}`, 'success');
});

document.getElementById('btn-add-domain').addEventListener('click', () => {
  const domains = store.getDomains();
  const color = getDomainColor(domains.length, document.documentElement.dataset.theme === 'dark');
  const domain = store.addDomain(`主题域_${domains.length + 1}`, color);
  showToast(`主题域已创建: ${domain.name}`, 'success');
});

// Export SQL
document.getElementById('btn-export-sql').addEventListener('click', () => {
  const sql = generateFullSQL();
  showSQLModal('完整建表SQL', sql);
});

// Export Data Dictionary
document.getElementById('btn-export-dict').addEventListener('click', () => {
  const md = generateDataDictionary();
  showTextModal('数据字典 (Markdown)', md, '复制到剪贴板', () => {
    navigator.clipboard.writeText(md).then(() => {
      showToast('数据字典已复制到剪贴板', 'success');
    }).catch(() => {
      showToast('复制失败，请手动选择', 'error');
    });
  });
});

// Version Diff
document.getElementById('btn-version-diff').addEventListener('click', () => {
  showVersionDiffModal();
});

// Reverse Engineering
document.getElementById('btn-reverse').addEventListener('click', () => {
  showReverseEngineerModal();
});

// AI features
document.getElementById('btn-ai-create').addEventListener('click', () => {
  showAICreateTableModal();
});

document.getElementById('btn-ai-connect').addEventListener('click', () => {
  runAIAutoConnect();
});

document.getElementById('btn-ai-config').addEventListener('click', () => {
  showAIConfigModal();
});



// ====== 文件操作（新建/打开/保存/另存为/历史）======

document.getElementById('btn-new-project').addEventListener('click', () => {
  FileManager.newProject();
});

document.getElementById('btn-open-file').addEventListener('click', () => {
  FileManager.openFile();
});

document.getElementById('btn-save-file').addEventListener('click', () => {
  FileManager.saveFile();
});

document.getElementById('btn-save-as').addEventListener('click', () => {
  FileManager.saveAs();
});

document.getElementById('btn-recent-files').addEventListener('click', () => {
  FileManager.showRecentFiles();
});



// Theme toggle
document.getElementById('btn-theme').addEventListener('click', () => {
  const current = document.documentElement.dataset.theme;
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = newTheme;
  showToast(`已切换到${newTheme === 'dark' ? '暗色' : '亮色'}主题`, 'info');
  tableRenderer.renderAll();
});

// ====== Sidebar collapse ======
document.getElementById('btn-collapse-sidebar').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
  const icon = document.querySelector('#btn-collapse-sidebar [data-lucide]');
  if (icon) {
    const sidebar = document.getElementById('sidebar');
    icon.setAttribute('data-lucide', sidebar.classList.contains('collapsed') ? 'panel-left-open' : 'panel-left-close');
    lucide.createIcons({ root: document.getElementById('btn-collapse-sidebar') });
  }
});

document.getElementById('btn-collapse-props').addEventListener('click', () => {
  document.getElementById('properties-panel').classList.toggle('collapsed');
  const icon = document.querySelector('#btn-collapse-props [data-lucide]');
  if (icon) {
    const panel = document.getElementById('properties-panel');
    icon.setAttribute('data-lucide', panel.classList.contains('collapsed') ? 'panel-right-open' : 'panel-right-close');
    lucide.createIcons({ root: document.getElementById('btn-collapse-props') });
  }
});

// ====== Canvas controls ======
document.getElementById('btn-zoom-in').addEventListener('click', () => canvas.zoomIn());
document.getElementById('btn-zoom-out').addEventListener('click', () => canvas.zoomOut());
document.getElementById('btn-zoom-fit').addEventListener('click', () => canvas.zoomFit());
document.getElementById('btn-zoom-reset').addEventListener('click', () => canvas.zoomReset());

// ====== Window resize ======
window.addEventListener('resize', () => {
  canvas.resize();
  if (connectionRenderer) connectionRenderer.renderAll();
});

// ====== Context menu dismiss ======
document.addEventListener('click', (e) => {
  const menu = document.getElementById('context-menu');
  if (!menu.contains(e.target)) {
    menu.classList.remove('show');
  }
});

// ====== Keyboard shortcuts ======
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd+S 保存
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    FileManager.saveFile();
    return;
  }

  // Ctrl/Cmd+O 打开
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    FileManager.openFile();
    return;
  }

  // Ctrl/Cmd+N 新建
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    FileManager.newProject();
    return;
  }

  // Don't trigger when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.getAttribute('contenteditable') === 'true') return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (store.selectedTableId) {
      const table = store.getTable(store.selectedTableId);
      if (table) confirmDeleteTable(table);
    } else if (store.selectedConnectionId) {
      // Find and remove FK
      for (const t of store.getTables()) {
        const fk = t.foreignKeys.find(f => f.id === store.selectedConnectionId);
        if (fk) {
          confirmDeleteForeignKey(t, fk);
          break;
        }
      }
    }
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

  function confirmDeleteForeignKey(table, fk) {
    const toTable = store.getTable(fk.toTable);
    const fromCol = table.columns.find(c => c.id === fk.fromColumn);
    const toCol = toTable?.columns.find(c => c.id === fk.toColumn);
    showDangerConfirmModal({
      title: '删除外键',
      message: `确认删除外键关系？`,
      detail: `${table.name}.${fromCol?.name || '?'} → ${toTable?.name || '?'}.${toCol?.name || '?'}`,
      dangerButton: '删除',
      onConfirm: () => {
        store.removeForeignKey(table.id, fk.id);
        showToast('外键已删除', 'success');
      },
    });
  }
});

// ====== Modal helpers ======

function showSQLModal(title, sql) {
  // Syntax highlight
  const highlighted = highlightSQL(sql);
  const { close } = showModal({
    title,
    size: 'lg',
    body: `<div class="sql-preview">${highlighted}</div>`,
    footer: `
      <button class="btn" id="modal-download-sql">下载SQL文件</button>
      <button class="btn primary" id="modal-copy-sql">复制到剪贴板</button>
    `,
  });

  document.getElementById('modal-copy-sql').addEventListener('click', () => {
    navigator.clipboard.writeText(sql).then(() => {
      showToast('SQL已复制到剪贴板', 'success');
    }).catch(() => showToast('复制失败', 'error'));
  });

  document.getElementById('modal-download-sql').addEventListener('click', () => {
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.state.projectName || 'schema'}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('SQL文件已下载', 'success');
  });
}

function showTextModal(title, content, actionLabel, onAction) {
  const { close } = showModal({
    title,
    size: 'lg',
    body: `<div class="sql-preview" style="white-space:pre-wrap">${content}</div>`,
    footer: `
      <button class="btn" id="modal-close-text">关闭</button>
      <button class="btn primary" id="modal-action-text">${actionLabel}</button>
    `,
  });

  document.getElementById('modal-close-text').addEventListener('click', close);
  document.getElementById('modal-action-text').addEventListener('click', () => {
    onAction();
    close();
  });
}

function showVersionDiffModal() {
  const { close } = showModal({
    title: '版本比对',
    body: `
      <div style="margin-bottom:14px">
        <div class="form-label">导入要比对的模型文件 (.json)</div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="file" id="diff-file-input" accept=".json" style="flex:1;font-size:11px;color:var(--text-muted)">
          <button class="btn sm" id="diff-load">加载并比对</button>
        </div>
      </div>
      <div id="diff-result" style="display:none"></div>
    `,
    footer: `<button class="btn" id="diff-close">关闭</button>`,
  });

  document.getElementById('diff-close').addEventListener('click', close);

  document.getElementById('diff-load').addEventListener('click', () => {
    const input = document.getElementById('diff-file-input');
    if (!input.files[0]) {
      showToast('请先选择文件', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const oldState = JSON.parse(e.target.result);
        const result = compareModels(oldState, store.state);
        renderDiffResult(result, oldState);
      } catch (err) {
        showToast('文件解析失败', 'error');
      }
    };
    reader.readAsText(input.files[0]);
  });

  function renderDiffResult(result, oldState) {
    const container = document.getElementById('diff-result');
    container.style.display = 'block';

    if (result.diffs.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--accent-green)">
          <i data-lucide="check-circle" style="width:32px;height:32px"></i>
          <div style="margin-top:8px">两个模型完全一致，无差异</div>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ root: container });
      return;
    }

    const rows = result.diffs.map(d => {
      const tagClass = d.type === 'add' ? 'add' : d.type === 'delete' ? 'delete' : 'modify';
      const tagText = d.type === 'add' ? '新增' : d.type === 'delete' ? '删除' : '修改';
      return `<tr><td><span class="diff-tag ${tagClass}">${tagText}</span></td><td>${d.scope}</td><td>${d.table}</td><td>${d.detail}</td></tr>`;
    }).join('');

    container.innerHTML = `
      <div class="diff-summary">
        <div class="diff-summary-item add"><i data-lucide="plus-circle" style="width:13px;height:13px"></i>新增: <span class="count">${result.summary.added}</span></div>
        <div class="diff-summary-item delete"><i data-lucide="minus-circle" style="width:13px;height:13px"></i>删除: <span class="count">${result.summary.deleted}</span></div>
        <div class="diff-summary-item modify"><i data-lucide="edit-3" style="width:13px;height:13px"></i>修改: <span class="count">${result.summary.modified}</span></div>
      </div>
      <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border-default);border-radius:2px;margin-bottom:14px">
        <table class="diff-table">
          <thead><tr><th>类型</th><th>范围</th><th>表</th><th>详情</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="form-label">增量迁移SQL</div>
      <div class="sql-preview" style="max-height:200px">${highlightSQL(result.incrementalSQL)}</div>
      <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
        <button class="btn" id="diff-copy-sql">复制增量SQL</button>
        <button class="btn primary" id="diff-download-sql">下载增量SQL</button>
      </div>
    `;

    if (window.lucide) lucide.createIcons({ root: container });

    document.getElementById('diff-copy-sql').addEventListener('click', () => {
      navigator.clipboard.writeText(result.incrementalSQL).then(() => {
        showToast('增量SQL已复制', 'success');
      });
    });

    document.getElementById('diff-download-sql').addEventListener('click', () => {
      const blob = new Blob([result.incrementalSQL], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `migration_${Date.now()}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('增量SQL已下载', 'success');
    });
  }
}

function showReverseEngineerModal() {
  const { close } = showModal({
    title: '逆向工程 — 导入SHOW CREATE TABLE',
    size: 'lg',
    body: `
      <div style="margin-bottom:10px;color:var(--text-secondary);font-size:12px">
        粘贴一个或多个 <code style="color:var(--accent-orange)">CREATE TABLE</code> 语句，系统将解析并在画布上生成对应的表。
      </div>
      <textarea class="form-textarea-large" id="reverse-sql-input" placeholder="CREATE TABLE \`user\` (&#10;  \`id\` int(11) NOT NULL AUTO_INCREMENT,&#10;  \`name\` varchar(50) NOT NULL,&#10;  PRIMARY KEY (\`id\`)&#10;) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"></textarea>
    `,
    footer: `
      <button class="btn" id="reverse-close">取消</button>
      <button class="btn primary" id="reverse-parse">解析并导入</button>
    `,
  });

  document.getElementById('reverse-close').addEventListener('click', close);
  document.getElementById('reverse-parse').addEventListener('click', () => {
    const sql = document.getElementById('reverse-sql-input').value;
    if (!sql.trim()) {
      showToast('请粘贴CREATE TABLE语句', 'warning');
      return;
    }

    const tables = parseCreateTableSQL(sql);
    if (tables.length === 0) {
      showToast('未找到有效的CREATE TABLE语句', 'error');
      return;
    }

    // Resolve FK references
    resolveFKReferences(tables);

    // Add to store with staggered positions
    const existingCount = store.getTables().length;
    tables.forEach((t, i) => {
      t.x = 80 + (existingCount + i) * 300 % 1200;
      t.y = 80 + Math.floor((existingCount + i) * 300 / 1200) * 280;
    });

    // Merge tables into store
    tables.forEach(t => {
      store.state.tables.push(t);
    });
    store.markDirty();
    store.save();

    showToast(`已导入 ${tables.length} 张表`, 'success');
    close();
  });
}

// ====== SQL Syntax Highlighting ======
function highlightSQL(sql) {
  const keywords = ['CREATE', 'TABLE', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'NOT', 'NULL', 'DEFAULT', 'AUTO_INCREMENT', 'ENGINE', 'CHARSET', 'UNIQUE', 'INDEX', 'FULLTEXT', 'CONSTRAINT', 'ON', 'DELETE', 'UPDATE', 'CASCADE', 'RESTRICT', 'SET', 'NO', 'ACTION', 'CHECK', 'COMMENT', 'ALTER', 'ADD', 'DROP', 'COLUMN', 'MODIFY', 'IF', 'EXISTS', 'TABLE', 'INT', 'BIGINT', 'VARCHAR', 'TEXT', 'DATETIME', 'TIMESTAMP', 'DECIMAL', 'TINYINT', 'BOOLEAN', 'JSON'];
  const types = ['int', 'bigint', 'varchar', 'text', 'datetime', 'timestamp', 'decimal', 'tinyint', 'boolean', 'json', 'smallint', 'mediumint', 'float', 'double', 'char', 'longtext', 'mediumtext', 'tinytext', 'date', 'time', 'year', 'blob', 'enum', 'set', 'serial'];

  let result = sql;
  // Escape HTML
  result = result.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Comments
  result = result.replace(/(--.*$)/gm, '<span class="sql-comment">$1</span>');

  // Keywords (case insensitive, word boundary)
  const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
  result = result.replace(keywordRegex, '<span class="sql-keyword">$1</span>');

  // Types
  const typeRegex = new RegExp(`\\b(${types.join('|')})\\b`, 'gi');
  result = result.replace(typeRegex, '<span class="sql-type">$1</span>');

  // Strings
  result = result.replace(/'(.*?)'/g, '<span class="sql-string">\'$1\'</span>');

  return result;
}

// ====== Re-render when canvas transform changes ======
canvas.onTransformChange = () => {
  if (connectionRenderer) connectionRenderer.renderAll();
};

// Re-render connections after tables are rendered
setTimeout(() => {
  connectionRenderer.renderAll();
}, 100);