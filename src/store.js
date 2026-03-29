import { create } from 'zustand';
import {
  ROWS, COLS, PENDING_SIZE, TOP_PENDING_SIZE, PENDING_ROW_START, PENDING_COL_START,
  createInitialGrid, createInitialPending, createInitialTopPending,
  pushFromLeft, pushFromRight, pushFromTop, collapseGrid,
} from './gameLogic';

// ── Layout constants ────────────────────────────────────────────────────────
export const CELL = 52;
export const GAP  = 4;

export const sideOffset     = CELL + GAP * 4;
export const gridPx         = COLS * CELL + (COLS - 1) * GAP;
export const gridTopOffset  = 3 * (CELL + GAP);
const        gridBottom     = gridTopOffset + ROWS * (CELL + GAP) - GAP;
export const pendingColTop  = gridBottom - PENDING_SIZE * (CELL + GAP) + GAP;
export const topPendingLeft = PENDING_COL_START * (CELL + GAP);
export const CONTAINER_H    = gridTopOffset + ROWS * (CELL + GAP);
export const CONTAINER_W    = gridPx + 2 * (CELL + GAP * 4);

// ── Position helpers ────────────────────────────────────────────────────────
export const cellPos         = (r, c) => ({ x: sideOffset + c * (CELL + GAP), y: gridTopOffset + r * (CELL + GAP) });
export const leftPendingPos  = i => ({ x: 0,                              y: pendingColTop + i * (CELL + GAP) });
export const rightPendingPos = i => ({ x: sideOffset + gridPx + GAP * 4, y: pendingColTop + i * (CELL + GAP) });
export const topPendingPos   = i => ({ x: sideOffset + topPendingLeft + i * (CELL + GAP), y: 0 });

// ── Animation timings ───────────────────────────────────────────────────────
export const ANIM_MS  = 220;
export const FLASH_MS = 320;

// ── Helpers ─────────────────────────────────────────────────────────────────
function checkGameOver(grid, dl, dr, dt) {
  const rowAct = i => grid[PENDING_ROW_START + i].some(v => v !== 0);
  return (
    Array.from({ length: PENDING_SIZE     }, (_, i) => i).every(i => !rowAct(i) || dl.has(i)) &&
    Array.from({ length: PENDING_SIZE     }, (_, i) => i).every(i => !rowAct(i) || dr.has(i)) &&
    Array.from({ length: TOP_PENDING_SIZE }, (_, i) => i).every(i => dt.has(i))
  );
}

function initState() {
  return {
    grid:           createInitialGrid(),
    leftPending:    createInitialPending(),
    rightPending:   createInitialPending(),
    topPending:     createInitialTopPending(),
    score:          0,
    missCount:      0,
    gameOver:       false,
    animating:      false,
    flyingTiles:    [],
    flyingSource:   null,
    flashSet:       new Set(),
    redFlashSet:    new Set(),
    redFlashSource: null,
    collapsingCells: new Set(),
    disabledLeft:   new Set(),
    disabledRight:  new Set(),
    disabledTop:    new Set(),
    pendingCommit:  null,
  };
}

// ── Store ───────────────────────────────────────────────────────────────────
const useGameStore = create((set, get) => ({
  ...initState(),

  reset() {
    set(initState());
  },

  triggerPush(direction) {
    const s = get();
    if (s.animating || s.gameOver) return;

    let pushFn, pendingArg, pendingKey, getPendingPos;
    if (direction === 'left') {
      pushFn = pushFromRight; pendingArg = s.rightPending;
      pendingKey = 'rightPending'; getPendingPos = rightPendingPos;
    } else if (direction === 'right') {
      pushFn = pushFromLeft;  pendingArg = s.leftPending;
      pendingKey = 'leftPending';  getPendingPos = leftPendingPos;
    } else if (direction === 'down') {
      pushFn = pushFromTop;   pendingArg = s.topPending;
      pendingKey = 'topPending';   getPendingPos = topPendingPos;
    } else return;

    const disabled = pendingKey === 'leftPending'  ? s.disabledLeft
                   : pendingKey === 'rightPending' ? s.disabledRight
                   : s.disabledTop;
    const filteredPending = pendingArg.map((v, i) => disabled.has(i) ? 0 : v);
    const result = pushFn(s.grid, filteredPending);
    const { landings, mergedCells, score: pushScore, blockedIndices } = result;

    const pc = {
      payload:       { grid: result.grid, [pendingKey]: result.pending },
      mergedCells,
      pushScore,
      blockedIndices,
      pendingKey,
    };

    const rowIsVisible = idx => {
      if (pendingKey === 'topPending') return true;
      return s.grid[PENDING_ROW_START + idx].some(v => v !== 0);
    };

    const flying = landings
      .filter(land => !land.flyThrough || rowIsVisible(land.pendingIdx))
      .map((land, idx) => {
        const from = getPendingPos(land.pendingIdx);
        let to, flyThrough;
        if (land.flyThrough) {
          flyThrough = true;
          if (pendingKey === 'leftPending')       to = { x: CONTAINER_W + CELL, y: from.y };
          else if (pendingKey === 'rightPending') to = { x: -CELL * 2,          y: from.y };
          else                                    to = { x: from.x, y: CONTAINER_H + CELL };
        } else {
          flyThrough = false;
          to = cellPos(land.row, land.col);
        }
        return { id: idx, value: pendingArg[land.pendingIdx], from, to, flyThrough };
      });

    // ── No animation: commit immediately ────────────────────────────────────
    if (flying.length === 0) {
      const newDL = pendingKey === 'leftPending'  ? new Set([...s.disabledLeft,  ...blockedIndices]) : s.disabledLeft;
      const newDR = pendingKey === 'rightPending' ? new Set([...s.disabledRight, ...blockedIndices]) : s.disabledRight;
      const newDT = pendingKey === 'topPending'   ? new Set([...s.disabledTop,   ...blockedIndices]) : s.disabledTop;

      set({
        ...pc.payload,
        disabledLeft:  newDL,
        disabledRight: newDR,
        disabledTop:   newDT,
        missCount:      blockedIndices.length > 0 ? s.missCount + blockedIndices.length : s.missCount,
        redFlashSet:    blockedIndices.length > 0 ? new Set(blockedIndices) : new Set(),
        redFlashSource: blockedIndices.length > 0 ? pendingKey : null,
      });
      if (blockedIndices.length > 0)
        setTimeout(() => set({ redFlashSet: new Set(), redFlashSource: null }), FLASH_MS);
      if (checkGameOver(pc.payload.grid, newDL, newDR, newDT)) set({ gameOver: true });
      return;
    }

    // ── Animate ──────────────────────────────────────────────────────────────
    set({
      pendingCommit:  pc,
      flyingTiles:    flying,
      flyingSource:   pendingKey.replace('Pending', ''),
      animating:      true,
      missCount:      blockedIndices.length > 0 ? s.missCount + blockedIndices.length : s.missCount,
      redFlashSet:    blockedIndices.length > 0 ? new Set(blockedIndices) : new Set(),
      redFlashSource: blockedIndices.length > 0 ? pendingKey : null,
    });

    setTimeout(() => {
      const cur = get();
      const { pendingCommit: commit } = cur;
      const { payload, mergedCells: mc, pushScore: ps, blockedIndices: blocked, pendingKey: pKey } = commit;

      const newDL = pKey === 'leftPending'  ? new Set([...cur.disabledLeft,  ...blocked]) : cur.disabledLeft;
      const newDR = pKey === 'rightPending' ? new Set([...cur.disabledRight, ...blocked]) : cur.disabledRight;
      const newDT = pKey === 'topPending'   ? new Set([...cur.disabledTop,   ...blocked]) : cur.disabledTop;

      set({
        score:         cur.score + ps,
        flyingTiles:   [],
        flyingSource:  null,
        redFlashSet:   new Set(),
        redFlashSource: null,
        disabledLeft:  newDL,
        disabledRight: newDR,
        disabledTop:   newDT,
        pendingCommit: null,
      });

      if (mc.length > 0) {
        set({ flashSet: new Set(mc.map(([r, c]) => `${r},${c}`)) });
        setTimeout(() => set({ flashSet: new Set() }), FLASH_MS);
      }

      const { grid: collapsedGrid, moves } = collapseGrid(payload.grid);

      if (moves.length === 0) {
        set({ ...payload, animating: false });
        if (checkGameOver(payload.grid, newDL, newDR, newDT)) set({ gameOver: true });
        return;
      }

      set(payload); // commit post-push holes

      requestAnimationFrame(() => requestAnimationFrame(() => {
        set({
          flyingTiles:     moves.map((m, idx) => ({
            id: `collapse-${idx}`,
            value: m.value,
            from: cellPos(m.fromRow, m.fromCol),
            to:   cellPos(m.toRow,   m.toCol),
            flyThrough: false,
          })),
          collapsingCells: new Set(moves.map(m => `${m.fromRow},${m.fromCol}`)),
        });

        setTimeout(() => {
          set({ grid: collapsedGrid, flyingTiles: [], collapsingCells: new Set(), animating: false });
          if (checkGameOver(collapsedGrid, newDL, newDR, newDT)) set({ gameOver: true });
        }, ANIM_MS + 30);
      }));
    }, ANIM_MS + 30);
  },
}));

export default useGameStore;
