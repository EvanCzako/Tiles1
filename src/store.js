import { create } from 'zustand';
import {
  GRID_CONFIGS,
  createInitialGrid, createInitialPending, createInitialTopPending,
  pushFromLeft, pushFromRight, pushFromTop, collapseGrid, annihilateAdjacent,
} from './gameLogic';

// ── Fixed constants ─────────────────────────────────────────────────────────
export const CELL = 52;
export const GAP  = 4;

// ── Layout computed from cfg ─────────────────────────────────────────────────
export function getLayout(cfg) {
  const { ROWS, COLS, PENDING_SIZE, PENDING_COL_START } = cfg;
  const sideOffset     = CELL + GAP * 4;
  const gridPx         = COLS * CELL + (COLS - 1) * GAP;
  const gridTopOffset  = CELL + GAP * 4;
  const gridBottom     = gridTopOffset + ROWS * (CELL + GAP) - GAP;
  const pendingColTop  = gridBottom - PENDING_SIZE * (CELL + GAP) + GAP;
  const topPendingLeft = PENDING_COL_START * (CELL + GAP);
  const CONTAINER_H    = gridTopOffset + ROWS * (CELL + GAP);
  const CONTAINER_W    = gridPx + 2 * (CELL + GAP * 4);
  return { sideOffset, gridPx, gridTopOffset, pendingColTop, topPendingLeft, CONTAINER_H, CONTAINER_W };
}

// ── Position helpers ────────────────────────────────────────────────────────
export const cellPos         = (r, c, L) => ({ x: L.sideOffset + c * (CELL + GAP), y: L.gridTopOffset + r * (CELL + GAP) });
export const leftPendingPos  = (i, L)    => ({ x: 0,                                y: L.pendingColTop + i * (CELL + GAP) });
export const rightPendingPos = (i, L)    => ({ x: L.sideOffset + L.gridPx + GAP * 4, y: L.pendingColTop + i * (CELL + GAP) });
export const topPendingPos   = (i, L)    => ({ x: L.sideOffset + L.topPendingLeft + i * (CELL + GAP), y: 0 });

// ── Animation timings ───────────────────────────────────────────────────────
export const ANIM_MS      = 220;
export const FLASH_MS     = 320;
export const AUTO_MOVE_MS = 500;

// ── Helpers ─────────────────────────────────────────────────────────────────
function getAvailableDirections(s) {
  const { grid, leftPending, rightPending, topPending, disabledLeft, disabledRight, disabledTop, cfg } = s;
  const { PENDING_SIZE, TOP_PENDING_SIZE, PENDING_ROW_START } = cfg;
  const rowActive = i => grid[PENDING_ROW_START + i].some(v => v !== 0);
  const dirs = [];
  if (leftPending.some( (v, i) => v !== 0 && !disabledLeft.has(i)  && i < PENDING_SIZE     && rowActive(i))) dirs.push('right');
  if (rightPending.some((v, i) => v !== 0 && !disabledRight.has(i) && i < PENDING_SIZE     && rowActive(i))) dirs.push('left');
  if (topPending.some(  (v, i) => v !== 0 && !disabledTop.has(i)  && i < TOP_PENDING_SIZE))                  dirs.push('down');
  return dirs;
}

function checkGameOver(grid, dl, dr, dt, cfg) {
  const { PENDING_SIZE, TOP_PENDING_SIZE, PENDING_ROW_START } = cfg;
  const rowAct = i => grid[PENDING_ROW_START + i].some(v => v !== 0);
  return (
    Array.from({ length: PENDING_SIZE     }, (_, i) => i).every(i => !rowAct(i) || dl.has(i)) &&
    Array.from({ length: PENDING_SIZE     }, (_, i) => i).every(i => !rowAct(i) || dr.has(i)) &&
    Array.from({ length: TOP_PENDING_SIZE }, (_, i) => i).every(i => dt.has(i))
  );
}

function initState(mode = '9x9') {
  const cfg    = GRID_CONFIGS[mode];
  const layout = getLayout(cfg);
  return {
    gridMode:       mode,
    cfg,
    layout,
    grid:           createInitialGrid(cfg),
    leftPending:    createInitialPending(cfg),
    rightPending:   createInitialPending(cfg),
    topPending:     createInitialTopPending(cfg),
    score:          0,
    gameOver:       false,
    animating:      false,
    flyingTiles:    [],
    flyingSource:   null,
    flashSet:       new Set(),
    annihilateSet:  new Set(),
    redFlashSet:    new Set(),
    redFlashSource: null,
    collapsingCells: new Set(),
    disabledLeft:   new Set(),
    disabledRight:  new Set(),
    disabledTop:    new Set(),
    pendingCommit:  null,
    frozenPendingRows: null,  // snapshot of per-row activity at push time; held through cascade
  };
}

// ── Collapse + annihilate loop ─────────────────────────────────────────────
function runCollapseLoop(grid, pendingPayload, newDL, newDR, newDT, get, set) {
  const { cfg } = get();
  const { grid: collapsedGrid, midGrid, gravityMoves, horizontalMoves } = collapseGrid(grid, cfg);

  const afterCollapse = (settled) => {
    const curCfg = get().cfg;
    const { annihilatedCells, grid: annGrid, score: annScore } = annihilateAdjacent(settled, curCfg);

    if (annihilatedCells.length === 0) {
      // Cascade fully settled — now reveal the refreshed pending tiles
      set({ animating: false, frozenPendingRows: null, ...pendingPayload });
      if (checkGameOver(settled, newDL, newDR, newDT, curCfg)) {
        set({ gameOver: true });
      } else {
        const available = getAvailableDirections(get());
        if (available.length === 1) {
          setTimeout(() => { if (!get().gameOver && !get().animating) get().triggerPush(available[0]); }, AUTO_MOVE_MS);
        }
      }
      return;
    }

    set({
      score: get().score + annScore,
      annihilateSet: new Set(annihilatedCells.map(([r, c]) => `${r},${c}`)),
    });
    setTimeout(() => {
      set({ grid: annGrid, annihilateSet: new Set() });
      runCollapseLoop(annGrid, pendingPayload, newDL, newDR, newDT, get, set);
    }, FLASH_MS);
  };

  // Animate horizontal phase (inward pack) after gravity has settled
  const doHorizontalPhase = () => {
    if (horizontalMoves.length === 0) {
      afterCollapse(collapsedGrid);
      return;
    }
    const curLayout = get().layout;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      set({
        flyingTiles: horizontalMoves.map((m, idx) => ({
          id: `collapse-h-${idx}`,
          value: m.value,
          from: cellPos(m.fromRow, m.fromCol, curLayout),
          to:   cellPos(m.toRow,   m.toCol,   curLayout),
          flyThrough: false,
        })),
        collapsingCells: new Set(horizontalMoves.map(m => `${m.fromRow},${m.fromCol}`)),
      });
      setTimeout(() => {
        set({ grid: collapsedGrid, flyingTiles: [], collapsingCells: new Set() });
        afterCollapse(collapsedGrid);
      }, ANIM_MS + 30);
    }));
  };

  if (gravityMoves.length === 0 && horizontalMoves.length === 0) {
    afterCollapse(grid);
    return;
  }

  // Skip gravity animation if there are no gravity moves
  if (gravityMoves.length === 0) {
    doHorizontalPhase();
    return;
  }

  // Animate gravity (downward) first, then horizontal
  const curLayout = get().layout;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    set({
      flyingTiles: gravityMoves.map((m, idx) => ({
        id: `collapse-g-${idx}`,
        value: m.value,
        from: cellPos(m.fromRow, m.fromCol, curLayout),
        to:   cellPos(m.toRow,   m.toCol,   curLayout),
        flyThrough: false,
      })),
      collapsingCells: new Set(gravityMoves.map(m => `${m.fromRow},${m.fromCol}`)),
    });
    setTimeout(() => {
      set({ grid: midGrid, flyingTiles: [], collapsingCells: new Set() });
      doHorizontalPhase();
    }, ANIM_MS + 30);
  }));
}

// ── Store ───────────────────────────────────────────────────────────────────
const useGameStore = create((set, get) => ({
  ...initState(),

  reset() {
    set(initState(get().gridMode));
  },

  setGridMode(mode) {
    set(initState(mode));
  },

  triggerPush(direction) {
    const s = get();
    if (s.animating || s.gameOver) return;

    const { cfg, layout } = s;
    let pushFn, pendingArg, pendingKey, getPendingPos;
    if (direction === 'left') {
      pushFn = pushFromRight; pendingArg = s.rightPending;
      pendingKey = 'rightPending'; getPendingPos = i => rightPendingPos(i, layout);
    } else if (direction === 'right') {
      pushFn = pushFromLeft;  pendingArg = s.leftPending;
      pendingKey = 'leftPending';  getPendingPos = i => leftPendingPos(i, layout);
    } else if (direction === 'down') {
      pushFn = pushFromTop;   pendingArg = s.topPending;
      pendingKey = 'topPending';   getPendingPos = i => topPendingPos(i, layout);
    } else return;

    const disabled = pendingKey === 'leftPending'  ? s.disabledLeft
                   : pendingKey === 'rightPending' ? s.disabledRight
                   : s.disabledTop;
    const filteredPending = pendingArg.map((v, i) => disabled.has(i) ? 0 : v);
    const result = pushFn(s.grid, filteredPending, cfg);
    const { landings, mergedCells, score: pushScore, blockedIndices } = result;

    // Snapshot row activity BEFORE the push so pending columns stay frozen at
    // pre-swipe height for the entire cascade.
    const { PENDING_SIZE, PENDING_ROW_START } = cfg;
    const rowActive = i => s.grid[PENDING_ROW_START + i].some(v => v !== 0);
    const frozenPendingRows = {
      left:  Array.from({ length: PENDING_SIZE }, (_, i) => rowActive(i)),
      right: Array.from({ length: PENDING_SIZE }, (_, i) => rowActive(i)),
    };
    // Fully refreshed values (result.pending) are applied only when cascade settles.
    const intermediatePending = pendingArg.map((v, i) => blockedIndices.includes(i) ? v : 0);

    const pc = {
      payload:       { grid: result.grid, [pendingKey]: result.pending },
      mergedCells,
      pushScore,
      blockedIndices,
      pendingKey,
    };

    const rowIsVisible = idx => {
      if (pendingKey === 'topPending') return true;
      return s.grid[cfg.PENDING_ROW_START + idx].some(v => v !== 0);
    };

    const flying = landings
      .filter(land => !land.flyThrough || rowIsVisible(land.pendingIdx))
      .map((land, idx) => {
        const from = getPendingPos(land.pendingIdx);
        let to, flyThrough;
        if (land.flyThrough) {
          flyThrough = true;
          if (pendingKey === 'leftPending')       to = { x: layout.CONTAINER_W + CELL, y: from.y };
          else if (pendingKey === 'rightPending') to = { x: -CELL * 2,                  y: from.y };
          else                                    to = { x: from.x, y: layout.CONTAINER_H + CELL };
        } else {
          flyThrough = false;
          to = cellPos(land.row, land.col, layout);
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
        redFlashSet:    blockedIndices.length > 0 ? new Set(blockedIndices) : new Set(),
        redFlashSource: blockedIndices.length > 0 ? pendingKey : null,
      });
      if (blockedIndices.length > 0)
        setTimeout(() => set({ redFlashSet: new Set(), redFlashSource: null }), FLASH_MS);
      if (checkGameOver(pc.payload.grid, newDL, newDR, newDT, cfg)) set({ gameOver: true });
      return;
    }

    // ── Animate ──────────────────────────────────────────────────────────────
    set({
      pendingCommit:  pc,
      flyingTiles:    flying,
      flyingSource:   pendingKey.replace('Pending', ''),
      animating:      true,
      frozenPendingRows,
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

      // Commit the grid + intermediate pending (used slots zeroed); hold refreshed pending for cascade end
      const { grid: payloadGrid, ...pendingPayload } = payload;
      set({ grid: payloadGrid, [pendingKey]: intermediatePending });
      runCollapseLoop(payloadGrid, pendingPayload, newDL, newDR, newDT, get, set);
    }, ANIM_MS + 30);
  },
}));

export default useGameStore;
