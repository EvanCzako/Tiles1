export const ROWS = 10;
export const COLS = 10;
export const PENDING_SIZE = 5;          // side panels: 5 slots
export const TOP_PENDING_SIZE = 6;      // top row: 6 tiles (cols 2-7), centered

export const PENDING_ROW_START = ROWS - PENDING_SIZE; // 5
export const PENDING_COL_START = 2; // cols 2-7 for top, 2-6 for sides
export const CENTER_COL = Math.floor(COLS / 2); // 5

export const GRID_CONFIGS = {
  '10x10': {
    ROWS: 10, COLS: 10, PENDING_SIZE: 5, TOP_PENDING_SIZE: 6,
    PENDING_ROW_START: 5, PENDING_COL_START: 2, CENTER_COL: 5,
  },
  '8x8': {
    ROWS: 8, COLS: 8, PENDING_SIZE: 4, TOP_PENDING_SIZE: 4,
    PENDING_ROW_START: 4, PENDING_COL_START: 2, CENTER_COL: 4,
  },
};

const DEFAULT_CFG = GRID_CONFIGS['10x10'];

export function createInitialGrid(cfg = DEFAULT_CFG) {
  const { ROWS, COLS, TOP_PENDING_SIZE, PENDING_COL_START } = cfg;
  const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
  // Build pyramid at bottom: bottom row is TOP_PENDING_SIZE wide, each row above loses 2
  let width = TOP_PENDING_SIZE;
  let row = ROWS - 1;
  while (width >= 2) {
    const start = PENDING_COL_START + Math.floor((TOP_PENDING_SIZE - width) / 2);
    for (let c = start; c < start + width; c++) grid[row][c] = 3;
    width -= 2;
    row--;
  }
  return grid;
}

function randTile() {
  const r = Math.random() * 21;
  if (r < 6)  return 1;
  if (r < 12) return 2;
  if (r < 18) return 3;
  if (r < 20) return 4;
  return 5;
}

export function createInitialPending(cfg = DEFAULT_CFG) {
  return Array.from({ length: cfg.PENDING_SIZE }, randTile);
}

export function createInitialTopPending(cfg = DEFAULT_CFG) {
  return Array.from({ length: cfg.TOP_PENDING_SIZE }, randTile);
}

function collide(moving, stationary) {
  if (moving === stationary) return 0;
  if (moving < stationary) return stationary - moving;
  return null;
}

export function pushFromLeft(grid, leftPending, cfg = DEFAULT_CFG) {
  const { COLS, PENDING_SIZE, PENDING_ROW_START } = cfg;
  const newGrid = grid.map(row => [...row]);
  const newPending = [...leftPending];
  const mergedCells = [];
  const landings = [];
  const blockedIndices = [];
  let score = 0;

  const rowLeftmost = [];
  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    let leftmost = -1;
    for (let c = 0; c < COLS; c++) {
      if (newGrid[row][c] !== 0) { leftmost = c; break; }
    }
    rowLeftmost.push(leftmost);
  }

  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;

    const leftmost = rowLeftmost[i];

    if (leftmost === -1) {
      landings.push({ pendingIdx: i, flyThrough: true });
    } else {
      const result = collide(tileVal, newGrid[row][leftmost]);
      if (result !== null) {
        score += result === 0 ? tileVal + newGrid[row][leftmost] : tileVal;
        newGrid[row][leftmost] = result;
        mergedCells.push([row, leftmost]);
        landings.push({ pendingIdx: i, row, col: leftmost, merged: true });
      } else if (leftmost > 0) {
        newGrid[row][leftmost - 1] = tileVal;
        landings.push({ pendingIdx: i, row, col: leftmost - 1, merged: false });
      } else {
        blockedIndices.push(i);
        continue;
      }
    }

    newPending[i] = randTile();
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

export function pushFromRight(grid, rightPending, cfg = DEFAULT_CFG) {
  const { COLS, PENDING_SIZE, PENDING_ROW_START } = cfg;
  const newGrid = grid.map(row => [...row]);
  const newPending = [...rightPending];
  const mergedCells = [];
  const landings = [];
  const blockedIndices = [];
  let score = 0;

  const rowRightmost = [];
  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    let rightmost = -1;
    for (let c = COLS - 1; c >= 0; c--) {
      if (newGrid[row][c] !== 0) { rightmost = c; break; }
    }
    rowRightmost.push(rightmost);
  }

  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;

    const rightmost = rowRightmost[i];

    if (rightmost === -1) {
      landings.push({ pendingIdx: i, flyThrough: true });
    } else {
      const result = collide(tileVal, newGrid[row][rightmost]);
      if (result !== null) {
        score += result === 0 ? tileVal + newGrid[row][rightmost] : tileVal;
        newGrid[row][rightmost] = result;
        mergedCells.push([row, rightmost]);
        landings.push({ pendingIdx: i, row, col: rightmost, merged: true });
      } else if (rightmost < COLS - 1) {
        newGrid[row][rightmost + 1] = tileVal;
        landings.push({ pendingIdx: i, row, col: rightmost + 1, merged: false });
      } else {
        blockedIndices.push(i);
        continue;
      }
    }

    newPending[i] = randTile();
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

export function pushFromTop(grid, topPending, cfg = DEFAULT_CFG) {
  const { ROWS, PENDING_COL_START } = cfg;
  const newGrid = grid.map(row => [...row]);
  const newPending = [...topPending];
  const mergedCells = [];
  const landings = [];
  const blockedIndices = [];
  let score = 0;

  for (let i = 0; i < newPending.length; i++) {
    const col = PENDING_COL_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;

    let topmost = -1;
    for (let r = 0; r < ROWS; r++) {
      if (newGrid[r][col] !== 0) { topmost = r; break; }
    }

    if (topmost === -1) {
      newGrid[ROWS - 1][col] = tileVal;
      landings.push({ pendingIdx: i, row: ROWS - 1, col, merged: false });
    } else {
      const result = collide(tileVal, newGrid[topmost][col]);
      if (result !== null) {
        score += result === 0 ? tileVal + newGrid[topmost][col] : tileVal;
        newGrid[topmost][col] = result;
        mergedCells.push([topmost, col]);
        landings.push({ pendingIdx: i, row: topmost, col, merged: true });
      } else if (topmost > 0) {
        newGrid[topmost - 1][col] = tileVal;
        landings.push({ pendingIdx: i, row: topmost - 1, col, merged: false });
      } else {
        blockedIndices.push(i);
        continue;
      }
    }

    newPending[i] = randTile();
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

export function collapseGrid(grid, cfg = DEFAULT_CFG) {
  const { ROWS, COLS, CENTER_COL } = cfg;
  const newGrid = grid.map(row => [...row]);
  const allMoves = [];

  while (true) {
    const moves = [];

    for (let c = 0; c < COLS; c++) {
      const tiles = [];
      for (let r = 0; r < ROWS; r++) {
        if (newGrid[r][c] !== 0) tiles.push({ r, v: newGrid[r][c] });
      }
      if (tiles.length === 0) continue;
      const packed = tiles.every((t, i) => t.r === ROWS - tiles.length + i);
      if (packed) continue;

      for (let r = 0; r < ROWS; r++) newGrid[r][c] = 0;
      let dest = ROWS - 1;
      for (let j = tiles.length - 1; j >= 0; j--) {
        const { r: from, v } = tiles[j];
        newGrid[dest][c] = v;
        if (from !== dest) moves.push({ value: v, fromRow: from, fromCol: c, toRow: dest, toCol: c });
        dest--;
      }
    }

    for (let r = 0; r < ROWS; r++) {
      const rowSnapshot = [...newGrid[r]];

      {
        const tiles = [];
        for (let c = 0; c < CENTER_COL; c++) {
          if (rowSnapshot[c] !== 0) tiles.push({ c, v: rowSnapshot[c] });
        }
        if (tiles.length > 0) {
          const already = tiles.every((t, i) => t.c === CENTER_COL - tiles.length + i);
          if (!already) {
            for (let c = 0; c < CENTER_COL; c++) newGrid[r][c] = 0;
            let dest = CENTER_COL - tiles.length;
            for (const { c: from, v } of tiles) {
              newGrid[r][dest] = v;
              if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
              dest++;
            }
          }
        }
      }

      {
        const tiles = [];
        for (let c = CENTER_COL; c < COLS; c++) {
          if (rowSnapshot[c] !== 0) tiles.push({ c, v: rowSnapshot[c] });
        }
        if (tiles.length > 0) {
          const already = tiles.every((t, i) => t.c === CENTER_COL + i);
          if (!already) {
            for (let c = CENTER_COL; c < COLS; c++) newGrid[r][c] = 0;
            let dest = CENTER_COL;
            for (const { c: from, v } of tiles) {
              newGrid[r][dest] = v;
              if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
              dest++;
            }
          }
        }
      }
    }

    allMoves.push(...moves);
    if (moves.length === 0) break;
  }

  return { grid: newGrid, moves: allMoves };
}

export function isDeadCell(r, c) {
  return false;
}

export function getTileColor(value) {
  const colors = {
    0:  { bg: '#1e1e38', text: 'transparent' },
    1:  { bg: '#3a7bd5', text: '#fff' },
    2:  { bg: '#2ecc71', text: '#fff' },
    3:  { bg: '#f0c030', text: '#222' },
    4:  { bg: '#e67e22', text: '#fff' },
    5:  { bg: '#e74c3c', text: '#fff' },
    6:  { bg: '#9b59b6', text: '#fff' },
    7:  { bg: '#e91e8c', text: '#fff' },
    8:  { bg: '#ff6b35', text: '#fff' },
    9:  { bg: '#c0392b', text: '#fff' },
    10: { bg: '#1abc9c', text: '#fff' },
  };
  return colors[value] ?? { bg: '#fff', text: '#333' };
}
