// fileManager.js — 文件打开/保存/历史管理（兼容 Tauri 和浏览器环境）

import { store } from './store.js';
import { showToast } from './toast.js';
import { showModal } from './modal.js';

// 检测是否在 Tauri 环境中
function isTauri() {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
}

// 动态导入 Tauri 插件模块
async function getTauriModules() {
  try {
    const dialog = await import('@tauri-apps/plugin-dialog');
    const fs = await import('@tauri-apps/plugin-fs');
    return { open: dialog.open, save: dialog.save, message: dialog.message, fs };
  } catch (e) {
    console.warn('Tauri APIs not available, falling back to browser mode', e);
    return null;
  }
}

// 浏览器环境下用 hidden input 选择文件
function browserOpenFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          resolve({ data, path: file.name, name: file.name });
        } catch (err) {
          resolve({ error: '文件格式错误' });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

// 浏览器环境下下载文件
function browserSaveFile(data, suggestedName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName || 'project.json';
  a.click();
  URL.revokeObjectURL(url);
}

export class FileManager {

  /** 新建项目 */
  static async newProject() {
    if (store.isDirty) {
      const confirmed = confirm('当前项目有未保存的更改，确定要新建吗？');
      if (!confirmed) return;
    }
    store.newProject();
    showToast('已创建新项目', 'success');
  }

  /** 打开文件 */
  static async openFile() {
    if (store.isDirty) {
      const confirmed = confirm('当前项目有未保存的更改，确定要打开其他文件吗？');
      if (!confirmed) return;
    }

    const tauri = isTauri() ? await getTauriModules() : null;

    if (tauri) {
      // Tauri 环境：使用原生文件对话框
      try {
        const filePath = await tauri.open({
          filters: [{ name: 'DBForge Project', extensions: ['json'] }],
          multiple: false,
        });
        if (!filePath) return;

        const content = await tauri.fs.readTextFile(filePath);
        const data = JSON.parse(content);
        store.loadProject(data, filePath);
        showToast(`已打开: ${data.projectName || filePath}`, 'success');
      } catch (e) {
        showToast(`打开文件失败: ${e.message || e}`, 'error');
      }
    } else {
      // 浏览器环境：使用 file input
      const result = await browserOpenFile();
      if (!result) return;
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      store.loadProject(result.data, null);
      showToast(`已打开: ${result.data.projectName || result.name}`, 'success');
    }
  }

  /** 从历史路径打开文件 */
  static async openFromHistory(filePath) {
    const tauri = isTauri() ? await getTauriModules() : null;

    if (tauri) {
      try {
        const content = await tauri.fs.readTextFile(filePath);
        const data = JSON.parse(content);
        store.loadProject(data, filePath);
        showToast(`已打开: ${data.projectName || filePath}`, 'success');
      } catch (e) {
        showToast(`无法打开文件: ${e.message || e}`, 'error');
        // 文件可能已移动/删除，从历史中移除
        store.removeFileHistory(filePath);
      }
    } else {
      // 浏览器环境无法直接通过路径读取文件
      showToast('浏览器环境不支持通过路径打开文件，请使用"打开"按钮选择文件', 'warning');
    }
  }

  /** 保存文件（如果有路径则直接保存，否则另存为） */
  static async saveFile() {
    if (store.currentFilePath && isTauri()) {
      const tauri = await getTauriModules();
      if (tauri) {
        try {
          const data = store.getProject();
          await tauri.fs.writeTextFile(store.currentFilePath, JSON.stringify(data, null, 2));
          store.addFileHistory(store.currentFilePath, data.projectName);
          showToast('文件已保存', 'success');
          return;
        } catch (e) {
          showToast(`保存失败: ${e.message || e}`, 'error');
          return;
        }
      }
    }
    // 没有路径或非 Tauri → 另存为
    await this.saveAs();
  }

  /** 另存为 */
  static async saveAs() {
    const data = store.getProject();
    const suggestedName = `${data.projectName || 'project'}.json`;

    const tauri = isTauri() ? await getTauriModules() : null;

    if (tauri) {
      try {
        const filePath = await tauri.save({
          filters: [{ name: 'DBForge Project', extensions: ['json'] }],
          defaultPath: suggestedName,
        });
        if (!filePath) return;

        await tauri.fs.writeTextFile(filePath, JSON.stringify(data, null, 2));
        store.setCurrentFilePath(filePath);
        showToast(`已保存到: ${filePath}`, 'success');
      } catch (e) {
        showToast(`保存失败: ${e.message || e}`, 'error');
      }
    } else {
      // 浏览器环境：下载文件
      browserSaveFile(data, suggestedName);
      showToast('文件已下载（浏览器环境不支持直接保存到磁盘）', 'info');
    }
  }

  /** 显示历史文件列表弹窗 */
  static showRecentFiles() {
    const history = store.getFileHistory();

    if (history.length === 0) {
      showModal({
        title: '历史文件',
        body: `
          <div style="text-align:center;padding:30px;color:var(--text-muted)">
            <i data-lucide="inbox" style="width:32px;height:32px"></i>
            <div style="margin-top:8px;font-size:12px">暂无历史文件记录</div>
          </div>
        `,
        footer: `<button class="btn" id="history-close">关闭</button>`,
      });
      const close = () => document.querySelector('.modal-overlay.show .modal-close')?.click();
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        modal.querySelector('#history-close')?.addEventListener('click', () => {
          modal.querySelector('.modal-close')?.click();
        });
      }
      if (window.lucide) lucide.createIcons();
      return;
    }

    const rows = history.map((h, i) => {
      const date = new Date(h.timestamp);
      const dateStr = `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
      const shortPath = h.path.length > 50 ? '...' + h.path.slice(-47) : h.path;
      return `
        <div class="history-item" data-idx="${i}" style="
          display:flex;align-items:center;gap:10px;padding:10px 12px;
          border:1px solid var(--border-default);border-radius:2px;
          margin-bottom:6px;cursor:pointer;transition:all var(--ease-fast);
        " onmouseover="this.style.background='var(--bg-hover)';this.style.borderColor='var(--border-hover)'"
          onmouseout="this.style.background='transparent';this.style.borderColor='var(--border-default)'">
          <i data-lucide="file-json" style="width:16px;height:16px;color:var(--accent-orange);flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-primary);margin-bottom:2px">${escapeHtml(h.name)}</div>
            <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(h.path)}">${escapeHtml(shortPath)}</div>
          </div>
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);flex-shrink:0">${dateStr}</div>
          <button class="history-remove" data-remove-idx="${i}" style="
            width:22px;height:22px;display:flex;align-items:center;justify-content:center;
            background:transparent;border:1px solid transparent;border-radius:2px;
            color:var(--text-muted);cursor:pointer;flex-shrink:0;transition:all var(--ease-fast)
          " onmouseover="this.style.color='var(--accent-red)';this.style.borderColor='var(--accent-red)'"
            onmouseout="this.style.color='var(--text-muted)';this.style.borderColor='transparent'">
            <i data-lucide="x" style="width:12px;height:12px"></i>
          </button>
        </div>
      `;
    }).join('');

    const { close } = showModal({
      title: '历史文件',
      size: 'lg',
      body: `
        <div style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em">
            最近打开的文件 (${history.length})
          </span>
          <button class="btn ghost sm" id="history-clear">清空全部</button>
        </div>
        <div id="history-list">${rows}</div>
      `,
      footer: `<button class="btn" id="history-close-btn">关闭</button>`,
    });

    if (window.lucide) lucide.createIcons({ root: document.querySelector('.modal-overlay.show') });

    // Wire events
    document.getElementById('history-close-btn')?.addEventListener('click', close);
    document.getElementById('history-clear')?.addEventListener('click', () => {
      if (confirm('确认清空所有历史记录？')) {
        store.clearFileHistory();
        close();
        showToast('历史记录已清空', 'success');
      }
    });

    document.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // 不要在点击删除按钮时触发打开
        if (e.target.closest('.history-remove')) return;
        const idx = parseInt(item.dataset.idx);
        const historyItem = history[idx];
        close();
        this.openFromHistory(historyItem.path);
      });
    });

    document.querySelectorAll('.history-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.removeIdx);
        const historyItem = history[idx];
        store.removeFileHistory(historyItem.path);
        // 刷新列表
        close();
        this.showRecentFiles();
      });
    });
  }
}

// Helper
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}