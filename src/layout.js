import { CELL, GAP } from './constants';

// ── Layout computed from cfg ──────────────────────────────────────────────────
export function getLayout(cfg) {
  const { ROWS, COLS, PENDING_SIZE, PENDING_COL_START } = cfg;
  const sideOffset     = CELL;
  const gridPx         = COLS * CELL + (COLS - 1) * GAP;
  const gridTopOffset  = CELL + GAP * 4;
  const gridBottom     = gridTopOffset + ROWS * (CELL + GAP) - GAP;
  const pendingColTop  = gridBottom - PENDING_SIZE * (CELL + GAP) + GAP;
  const topPendingLeft = PENDING_COL_START * (CELL + GAP);
  const CONTAINER_H    = gridTopOffset + ROWS * (CELL + GAP);
  const CONTAINER_W    = gridPx + 2 * CELL + GAP * 4;
  return { sideOffset, gridPx, gridTopOffset, pendingColTop, topPendingLeft, CONTAINER_H, CONTAINER_W };
}

// ── Position helpers ──────────────────────────────────────────────────────────
export const cellPos         = (r, c, L) => ({ x: L.sideOffset + c * (CELL + GAP), y: L.gridTopOffset + r * (CELL + GAP) });
export const leftPendingPos  = (i, L)    => ({ x: 0,                                y: L.pendingColTop + i * (CELL + GAP) });
export const rightPendingPos = (i, L)    => ({ x: L.sideOffset + L.gridPx + GAP * 4, y: L.pendingColTop + i * (CELL + GAP) });
export const topPendingPos   = (i, L)    => ({ x: L.sideOffset + L.topPendingLeft + i * (CELL + GAP), y: 0 });
