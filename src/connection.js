// connection.js — 外键连线渲染 (SVG) — 正交自动布线 + 方向箭头

import { store } from './store.js';

const PORT_OFFSET = 6;   // port 距离表边的偏移
const MIN_MARGIN = 30;   // 线段拐弯离表边的最小间距

export class ConnectionRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.layer = document.getElementById('connection-layer');
    this.onConnectionClick = null;
  }

  renderAll() {
    this.layer.innerHTML = '';

    // ── defs: 箭头 marker ──
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow-end" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse"
              class="arrow-marker-def">
        <path d="M 0 0 L 10 5 L 0 10 z" class="arrow-marker" />
      </marker>
      <marker id="arrow-end-selected" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-orange)" />
      </marker>
      <marker id="arrow-end-hover" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-orange)" />
      </marker>
    `;
    this.layer.appendChild(defs);

    const connections = store.getConnections();

    connections.forEach(conn => {
      this._renderConnection(conn);
    });
  }

  _renderConnection(conn) {
    const fromEl = document.querySelector(`[data-table-id="${conn.fromTableId}"]`);
    const toEl = document.querySelector(`[data-table-id="${conn.toTableId}"]`);
    if (!fromEl || !toEl) return;

    const fromColEl = fromEl.querySelector(`[data-column-id="${conn.fromColumnId}"]`);
    const toColEl = toEl.querySelector(`[data-column-id="${conn.toColumnId}"]`);
    if (!fromColEl || !toColEl) return;

    const scale = this.canvas.transform.scale;
    const contentBRect = document.getElementById('canvas-content').getBoundingClientRect();

    // 获取 from/to 表的位置和尺寸（canvas 坐标系）
    const fromTable = store.getTable(conn.fromTableId);
    const toTable = store.getTable(conn.toTableId);

    const fromTableX = fromTable.x;
    const fromTableW = fromEl.offsetWidth;
    const fromTableY = fromTable.y;
    const fromTableH = fromEl.offsetHeight;

    const toTableX = toTable.x;
    const toTableW = toEl.offsetWidth;
    const toTableY = toTable.y;
    const toTableH = toEl.offsetHeight;

    // 获取 from/to column 的 Y 坐标（canvas 坐标系）
    // 通过 DOM rect 计算
    const fromColRect = fromColEl.getBoundingClientRect();
    const toColRect = toColEl.getBoundingClientRect();
    const fromColY = (fromColRect.top + fromColRect.height / 2 - contentBRect.top) / scale;
    const toColY = (toColRect.top + toColRect.height / 2 - contentBRect.top) / scale;

    // 自动选择从哪侧出发：
    // 比较 from 表右侧到 to 表左侧的距离 vs from 表左侧到 to 表右侧的距离
    const fromRight = fromTableX + fromTableW;
    const fromLeft = fromTableX;
    const toRight = toTableX + toTableW;
    const toLeft = toTableX;

    // 优先从最近的两侧连接
    const rightToLeft = Math.abs(toLeft - fromRight);
    const leftToRight = Math.abs(fromLeft - toRight);
    const rightToRight = Math.abs(toRight - fromRight);
    const leftToLeft = Math.abs(toLeft - fromLeft);

    const minDist = Math.min(rightToLeft, leftToRight, rightToRight, leftToLeft);

    let fromPortX, toPortX, fromSide, toSide;

    if (minDist === rightToLeft) {
      // from 右 → to 左
      fromSide = 'right';
      toSide = 'left';
      fromPortX = fromRight + PORT_OFFSET;
      toPortX = toLeft - PORT_OFFSET;
    } else if (minDist === leftToRight) {
      // from 左 → to 右
      fromSide = 'left';
      toSide = 'right';
      fromPortX = fromLeft - PORT_OFFSET;
      toPortX = toRight + PORT_OFFSET;
    } else if (minDist === rightToRight) {
      // from 右 → to 右
      fromSide = 'right';
      toSide = 'right';
      fromPortX = fromRight + PORT_OFFSET;
      toPortX = toRight + PORT_OFFSET;
    } else {
      // from 左 → to 左
      fromSide = 'left';
      toSide = 'left';
      fromPortX = fromLeft - PORT_OFFSET;
      toPortX = toLeft - PORT_OFFSET;
    }

    const fromPortY = fromColY;
    const toPortY = toColY;

    // 标记 port 为已连接
    const fromPortEl = fromColEl.querySelector(`.db-column-port.${fromSide}`);
    const toPortEl = toColEl.querySelector(`.db-column-port.${toSide}`);
    if (fromPortEl) fromPortEl.classList.add('connected');
    if (toPortEl) { toPortEl.classList.add('connected'); toPortEl.classList.add('target'); }

    // 生成正交路径
    const pathData = this._orthogonalPath(fromPortX, fromPortY, toPortX, toPortY, fromSide, toSide);

    // 主路径
    const isSelected = store.selectedConnectionId === conn.id;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connection-path' + (isSelected ? ' selected' : ''));
    path.setAttribute('d', pathData);
    path.setAttribute('data-conn-id', conn.id);
    path.setAttribute('marker-end', isSelected ? 'url(#arrow-end-selected)' : 'url(#arrow-end)');

    path.addEventListener('click', (e) => {
      e.stopPropagation();
      store.selectConnection(conn.id);
    });

    path.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.onConnectionClick) this.onConnectionClick(conn);
    });

    // hover 切换箭头颜色
    path.addEventListener('mouseenter', () => {
      if (!isSelected) path.setAttribute('marker-end', 'url(#arrow-end-hover)');
    });
    path.addEventListener('mouseleave', () => {
      if (!isSelected) path.setAttribute('marker-end', 'url(#arrow-end)');
    });

    this.layer.appendChild(path);

    // 起点圆点
    const dotStart = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dotStart.setAttribute('cx', fromPortX);
    dotStart.setAttribute('cy', fromPortY);
    dotStart.setAttribute('r', 3);
    dotStart.setAttribute('class', 'connection-dot');
    this.layer.appendChild(dotStart);

    // 终点不需要圆点，箭头已表示方向
  }

  /**
   * 生成正交（直角拐弯）路径
   * 根据起点/终点在哪一侧，自动计算中间拐点
   */
  _orthogonalPath(x1, y1, x2, y2, fromSide, toSide) {
    const margin = MIN_MARGIN;

    // 同侧: 都在右侧或都在左侧 → 需要向外绕
    if (fromSide === toSide) {
      if (fromSide === 'right') {
        // 都在右侧 → 向右延伸再拐
        const midX = Math.max(x1, x2) + margin;
        return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
      } else {
        // 都在左侧 → 向左延伸再拐
        const midX = Math.min(x1, x2) - margin;
        return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
      }
    }

    // 不同侧: 左→右 或 右→左
    // 检查是否 x 范围有重叠
    const xOverlap = (x1 < x2 && fromSide === 'right' && toSide === 'left') ||
                      (x2 < x1 && fromSide === 'left' && toSide === 'right');

    if (xOverlap) {
      // 直接中间拐弯
      const midX = (x1 + x2) / 2;
      return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    }

    // 没有重叠 → 需要绕出去
    if (fromSide === 'right' && toSide === 'left') {
      // from 右，to 左，但 x1 > x2 → 向右绕出去再回来
      const midX = Math.max(x1, x2) + margin;
      return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    } else {
      // from 左，to 右，但 x1 < x2 → 向左绕出去再回来
      const midX = Math.min(x1, x2) - margin;
      return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    }
  }
}