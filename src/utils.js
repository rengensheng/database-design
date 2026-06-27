// utils.js — 工具函数

let _idCounter = 0;

export function uid(prefix = '') {
  _idCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return prefix + ts + rand + _idCounter;
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function formatDateTime(date = new Date()) {
  return date.toISOString();
}

// MySQL data types
export const MYSQL_TYPES = [
  'int', 'bigint', 'smallint', 'tinyint', 'mediumint', 'decimal', 'float', 'double',
  'varchar', 'char', 'text', 'longtext', 'mediumtext', 'tinytext',
  'date', 'datetime', 'timestamp', 'time', 'year',
  'json', 'blob', 'enum', 'set', 'boolean', 'serial'
];

// Smart field auto-complete mapping
export const SMART_FIELD_MAP = {
  'created_at': { type: 'datetime', length: '', default: 'CURRENT_TIMESTAMP', notNull: false, comment: '创建时间' },
  'updated_at': { type: 'datetime', length: '', default: 'CURRENT_TIMESTAMP', notNull: false, comment: '更新时间' },
  'deleted_at': { type: 'datetime', length: '', default: '', notNull: false, comment: '删除时间' },
  'is_deleted': { type: 'tinyint', length: '1', default: '0', notNull: true, comment: '是否删除' },
  'is_active': { type: 'tinyint', length: '1', default: '1', notNull: true, comment: '是否启用' },
  'is_enabled': { type: 'tinyint', length: '1', default: '1', notNull: true, comment: '是否启用' },
  'status': { type: 'tinyint', length: '1', default: '0', notNull: true, comment: '状态' },
  'sort': { type: 'int', length: '11', default: '0', notNull: true, comment: '排序' },
  'remark': { type: 'varchar', length: '255', default: '', notNull: false, comment: '备注' },
  'description': { type: 'varchar', length: '500', default: '', notNull: false, comment: '描述' },
  'name': { type: 'varchar', length: '50', default: '', notNull: true, comment: '名称' },
  'title': { type: 'varchar', length: '100', default: '', notNull: true, comment: '标题' },
  'email': { type: 'varchar', length: '100', default: '', notNull: false, comment: '邮箱' },
  'phone': { type: 'varchar', length: '20', default: '', notNull: false, comment: '电话' },
  'avatar': { type: 'varchar', length: '255', default: '', notNull: false, comment: '头像' },
  'password': { type: 'varchar', length: '255', default: '', notNull: true, comment: '密码' },
  'token': { type: 'varchar', length: '255', default: '', notNull: false, comment: '令牌' },
  'amount': { type: 'decimal', length: '10,2', default: '0.00', notNull: true, comment: '金额' },
  'price': { type: 'decimal', length: '10,2', default: '0.00', notNull: true, comment: '价格' },
  'count': { type: 'int', length: '11', default: '0', notNull: true, comment: '数量' },
  'qty': { type: 'int', length: '11', default: '0', notNull: true, comment: '数量' },
  'order_no': { type: 'varchar', length: '50', default: '', notNull: true, comment: '订单号' },
  'ip': { type: 'varchar', length: '50', default: '', notNull: false, comment: 'IP地址' },
  'url': { type: 'varchar', length: '500', default: '', notNull: false, comment: 'URL' },
  'uuid': { type: 'varchar', length: '36', default: '', notNull: false, comment: 'UUID' },
  'version': { type: 'int', length: '11', default: '1', notNull: true, comment: '版本号' },
  'weight': { type: 'decimal', length: '10,2', default: '0.00', notNull: true, comment: '权重' },
};

export function getSmartSuggestion(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (SMART_FIELD_MAP[key]) return deepClone(SMART_FIELD_MAP[key]);
  return null;
}

// Domain default colors
export const DOMAIN_COLORS = [
  '#e6f7ff', '#fff2e8', '#f0f9eb', '#f9f0ff', '#fffbe6',
  '#e8f4ff', '#ffe6e6', '#e6fff0', '#f5e6ff', '#fff0e6'
];

// For dark mode, use darker domain backgrounds
export const DOMAIN_COLORS_DARK = [
  '#1a2332', '#2a2018', '#1a2a1a', '#221a2a', '#2a2a18',
  '#1a2438', '#2a1818', '#1a2a22', '#241a2a', '#2a1e18'
];

export function getDomainColor(index, isDark) {
  const palette = isDark ? DOMAIN_COLORS_DARK : DOMAIN_COLORS;
  return palette[index % palette.length];
}
