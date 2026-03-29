export const ROWS = 9;
export const COLS = 9;
export const PENDING_SIZE = 5;

export const PENDING_ROW_START = ROWS - PENDING_SIZE; // 4
export const PENDING_COL_START = 2; // cols 2-6

export function createInitialGrid() {
  const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
  for (let c = 2; c <= 6; c++) grid[8][c] = 3;
  for (let c = 3; c <= 5; c++) grid[7][c] = 3;
  grid[6][4] = 3;
  return grid;
}

// Weights: 1→3, 2→2, 3→1  (out of 6)
function randTile() {
  const r = Math.random() * 6;
  if (r < 3) return 1;
  if (r < 5) return 2;
  return 3;
}

export function createInitialPending() {
  return Array.from({ length: PENDING_SIZE }, randTile);
}

// Returns the result of a moving tile hitting a stationary tile.
// equal → annihilate (0), moving < stationary → stationary - moving, moving > stationary → no collision (null)
function collide(moving, stationary) {
  if (moving === stationary) return 0;
  if (moving < stationary) return stationary - moving;
  return null; // moving > stationary: stick adjacent instead
}

// Each push returns { grid, pending, mergedCells, landings }
// landing: { pendingIdx, row, col, merged }

export function pushFromLeft(grid, leftPending) {
  const newGrid = grid.map(row => [...row]);
  const newPending = [...leftPending];
  const mergedCells = [];
  const landings = [];

  // Find per-row leftmost tiles and overall structure left face
  const rowLeftmost = [];
  let structureLeft = COLS;
  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    let leftmost = -1;
    for (let c = 0; c < COLS; c++) {
      if (newGrid[row][c] !== 0) { leftmost = c; break; }
    }
    rowLeftmost.push(leftmost);
    if (leftmost !== -1) structureLeft = Math.min(structureLeft, leftmost);
  }
  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;

    const leftmost = rowLeftmost[i];

    if (leftmost === -1) {
      // Empty row — fly through, don't place
      landings.push({ pendingIdx: i, flyThrough: true });
    } else {
      const result = collide(tileVal, newGrid[row][leftmost]);
      if (result !== null) {
        newGrid[row][leftmost] = result;
        mergedCells.push([row, leftmost]);
        landings.push({ pendingIdx: i, row, col: leftmost, merged: true });
      } else if (leftmost > 0) {
        newGrid[row][leftmost - 1] = tileVal;
        landings.push({ pendingIdx: i, row, col: leftmost - 1, merged: false });
      }
    }

    newPending[i] = randTile();
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings };
}

export function pushFromRight(grid, rightPending) {
  const newGrid = grid.map(row => [...row]);
  const newPending = [...rightPending];
  const mergedCells = [];
  const landings = [];

  // Find per-row rightmost tiles and overall structure right face
  const rowRightmost = [];
  let structureRight = -1;
  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    let rightmost = -1;
    for (let c = COLS - 1; c >= 0; c--) {
      if (newGrid[row][c] !== 0) { rightmost = c; break; }
    }
    rowRightmost.push(rightmost);
    if (rightmost !== -1) structureRight = Math.max(structureRight, rightmost);
  }
  for (let i = 0; i < PENDING_SIZE; i++) {
    const row = PENDING_ROW_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;

    const rightmost = rowRightmost[i];

    if (rightmost === -1) {
      // Empty row — fly through, don't place
      landings.push({ pendingIdx: i, flyThrough: true });
    } else {
      const result = collide(tileVal, newGrid[row][rightmost]);
      if (result !== null) {
        newGrid[row][rightmost] = result;
        mergedCells.push([row, rightmost]);
        landings.push({ pendingIdx: i, row, col: rightmost, merged: true });
      } else if (rightmost < COLS - 1) {
        newGrid[row][rightmost + 1] = tileVal;
        landings.push({ pendingIdx: i, row, col: rightmost + 1, merged: false });
      }
    }

    newPending[i] = randTile();
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings };
}

export function pushFromTop(grid, topPending) {
  const newGrid = grid.map(row => [...row]);
  const newPending = [...topPending];
  const mergedCells = [];
  const landings = [];

  for (let i = 0; i < PENDING_SIZE; i++) {
    const col = PENDING_COL_START + i;
    const tileVal = newPending[i];
    if (tileVal === 0) continue;

    // Find topmost occupied row
    let topmost = -1;
    for (let r = 0; r < ROWS; r++) {
      if (newGrid[r][col] !== 0) { topmost = r; break; }
    }

    if (topmost === -1) {
      // Empty column — land at bottom row, no fly-through
      newGrid[ROWS - 1][col] = tileVal;
      landings.push({ pendingIdx: i, row: ROWS - 1, col, merged: false });
    } else {
      const result = collide(tileVal, newGrid[topmost][col]);
      if (result !== null) {
        newGrid[topmost][col] = result;
        mergedCells.push([topmost, col]);
        landings.push({ pendingIdx: i, row: topmost, col, merged: true });
      } else if (topmost > 0) {
        newGrid[topmost - 1][col] = tileVal;
        landings.push({ pendingIdx: i, row: topmost - 1, col, merged: false });
      }
    }

    newPending[i] = randTile();
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings };
}

export function isDeadCell(r, c) {
  return r < PENDING_ROW_START && (c < PENDING_COL_START || c >= PENDING_COL_START + PENDING_SIZE);
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
