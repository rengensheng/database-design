// canvas.js — 画布交互：缩放、平移、网格

import { store } from './store.js';
import { clamp } from './utils.js';

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const GRID_SIZE = 20;

export class Canvas {
  constructor() {
    this.viewport = document.getElementById('canvas-viewport');
    this.content = document.getElementById('canvas-content');
    this.grid = document.getElementById('canvas-grid');
    this.zoomLabel = document.getElementById('zoom-label');
    this.transform = { x: 0, y: 0, scale: 1 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.onTransformChange = null;

    this._init();
  }

  _init() {
    // Pan with mouse
    this.viewport.addEventListener('mousedown', (e) => {
      // Only pan when clicking empty canvas (not on tables)
      if (e.target === this.viewport || e.target === this.grid || e.target === this.content) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
        this.viewport.classList.add('panning');
        store.clearSelection();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.transform.x = e.clientX - this.panStart.x;
        this.transform.y = e.clientY - this.panStart.y;
        this._applyTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewport.classList.remove('panning');
      }
    });

    // Zoom with wheel
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom(e.clientX, e.clientY, delta);
    }, { passive: false });

    this._updateGrid();
  }

  zoom(clientX, clientY, factor) {
    const rect = this.viewport.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const newScale = clamp(this.transform.scale * factor, MIN_SCALE, MAX_SCALE);
    const actualFactor = newScale / this.transform.scale;

    // Zoom toward cursor
    this.transform.x = mouseX - (mouseX - this.transform.x) * actualFactor;
    this.transform.y = mouseY - (mouseY - this.transform.y) * actualFactor;
    this.transform.scale = newScale;

    this._applyTransform();
    this._updateGrid();
  }

  zoomIn() {
    const rect = this.viewport.getBoundingClientRect();
    this.zoom(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2);
  }

  zoomOut() {
    const rect = this.viewport.getBoundingClientRect();
    this.zoom(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.2);
  }

  zoomReset() {
    this.transform = { x: 0, y: 0, scale: 1 };
    this._applyTransform();
    this._updateGrid();
  }

  zoomFit() {
    const tables = store.getTables();
    if (tables.length === 0) {
      this.zoomReset();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    tables.forEach(t => {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + 260); // approx table width
      maxY = Math.max(maxY, t.y + 200); // approx table height
    });

    const rect = this.viewport.getBoundingClientRect();
    const padding = 60;
    const scaleX = (rect.width - padding * 2) / (maxX - minX);
    const scaleY = (rect.height - padding * 2) / (maxY - minY);
    const scale = clamp(Math.min(scaleX, scaleY), MIN_SCALE, MAX_SCALE);

    this.transform.scale = scale;
    this.transform.x = padding - minX * scale + (rect.width - (maxX - minX) * scale - padding * 2) / 2;
    this.transform.y = padding - minY * scale + (rect.height - (maxY - minY) * scale - padding * 2) / 2;

    this._applyTransform();
    this._updateGrid();
  }

  _applyTransform() {
    const { x, y, scale } = this.transform;
    this.content.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    this.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    store.setCanvasTransform(this.transform);
    if (this.onTransformChange) this.onTransformChange(this.transform);
  }

  _updateGrid() {
    const scale = this.transform.scale;
    const gridSize = GRID_SIZE * scale;
    const offsetX = this.transform.x % gridSize;
    const offsetY = this.transform.y % gridSize;

    const rect = this.viewport.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;

    this.grid.innerHTML = `
      <defs>
        <pattern id="grid-pattern" x="${offsetX}" y="${offsetY}" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
          <circle cx="${gridSize / 2}" cy="${gridSize / 2}" r="0.5" fill="var(--border-default)" />
        </pattern>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#grid-pattern)" />
    `;
  }

  /** Convert screen coordinates to canvas coordinates */
  screenToCanvas(screenX, screenY) {
    const rect = this.viewport.getBoundingClientRect();
    const x = (screenX - rect.left - this.transform.x) / this.transform.scale;
    const y = (screenY - rect.top - this.transform.y) / this.transform.scale;
    return { x, y };
  }

  resize() {
    this._updateGrid();
  }
}
