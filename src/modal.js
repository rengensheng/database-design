// modal.js — 模态框系统

export function showModal({ title, body, footer, size = '' }) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const sizeClass = size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : '';

  overlay.innerHTML = `
    <div class="modal ${sizeClass}">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;

  root.appendChild(overlay);
  if (window.lucide) lucide.createIcons({ root: overlay });

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('show'));

  // Close handlers
  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 250);
  };

  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  return { overlay, close };
}

export function showConfirmModal(message, onConfirm, title = '确认操作') {
  const { close } = showModal({
    title,
    body: `<div style="font-size:13px;color:var(--text-secondary);padding:8px 0">${message}</div>`,
    footer: `
      <button class="btn" id="modal-cancel">取消</button>
      <button class="btn primary" id="modal-confirm">确认</button>
    `,
  });

  document.getElementById('modal-cancel').addEventListener('click', close);
  document.getElementById('modal-confirm').addEventListener('click', () => {
    close();
    onConfirm();
  });
}

export function showDangerConfirmModal({ title = '确认删除', message, detail, dangerButton = '删除', onConfirm }) {
  const bodyContent = detail
    ? `<div style="font-size:13px;color:var(--text-secondary);padding:8px 0 12px">${message}</div>
       <div style="background:var(--bg-primary);border:1px solid var(--border-default);border-radius:2px;padding:10px 12px;font-size:12px;color:var(--text-muted);line-height:1.6">${detail}</div>`
    : `<div style="font-size:13px;color:var(--text-secondary);padding:8px 0">${message}</div>`;

  const { close } = showModal({
    title,
    body: bodyContent,
    footer: `
      <button class="btn" id="modal-cancel">取消</button>
      <button class="btn danger" id="modal-confirm">${dangerButton}</button>
    `,
  });

  document.getElementById('modal-cancel').addEventListener('click', close);
  document.getElementById('modal-confirm').addEventListener('click', () => {
    close();
    onConfirm();
  });
}