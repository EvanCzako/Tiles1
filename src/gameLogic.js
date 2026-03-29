export const ROWS = 10;
export const COLS = 10;
export const PENDING_SIZE = 5;          // side panels: 5 slots
export const TOP_PENDING_SIZE = 6;      // top row: 6 tiles (cols 2-7), centered

export const PENDING_ROW_START = ROWS - PENDING_SIZE; // 5
export const PENDING_COL_START = 2; // cols 2-7 for top, 2-6 for sides
export const CENTER_COL = Math.floor(COLS / 2); // 5

export function createInitialGrid() {
  const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
  for (let c = 2; c <= 7; c++) grid[9][c] = 3;
  for (let c = 3; c <= 6; c++) grid[8][c] = 3;
  for (let c = 4; c <= 5; c++) grid[7][c] = 3;
  return grid;
}

// Weights: 1→3, 2→2, 3→1  (out of 6)
function randTile() {
  const r = Math.random() * 9;
  if (r < 3) return 1;
  if (r < 6) return 2;
  return 3;
}

export function createInitialPending() {
  return Array.from({ length: PENDING_SIZE }, randTile);
}

export function createInitialTopPending() {
  return Array.from({ length: TOP_PENDING_SIZE }, randTile);
}

// Returns the result of a moving tile hitting a stationary tile.
// equal → annihilate (0), moving < stationary → stationary - moving, moving > stationary → no collision (null)
function collide(moving, stationary) {
  if (moving === stationary) return 0;
  if (moving < stationary) return stationary - moving;
  return null; // moving > stationary: stick adjacent instead
}

// Each push returns { grid, pending, mergedCells, landings, score }
// landing: { pendingIdx, row, col, merged }

export function pushFromLeft(grid, leftPending) {
  const newGrid = grid.map(row => [...row]);
  const newPending = [...leftPending];
  const mergedCells = [];
  const landings = [];
  const blockedIndices = [];
  let score = 0;

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
        if (result === 0) {
          // Annihilation
          score += tileVal + newGrid[row][leftmost];
        } else {
          // Subtraction
          score += tileVal;
        }
        newGrid[row][leftmost] = result;
        mergedCells.push([row, leftmost]);
        landings.push({ pendingIdx: i, row, col: leftmost, merged: true });
      } else if (leftmost > 0) {
        newGrid[row][leftmost - 1] = tileVal;
        landings.push({ pendingIdx: i, row, col: leftmost - 1, merged: false });
      } else {
        // col 0 is occupied and tile is larger — no room to enter
        blockedIndices.push(i);
        continue; // preserve original tile value; don't replace with new random
      }
    }

    newPending[i] = randTile();
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

export function pushFromRight(grid, rightPending) {
  const newGrid = grid.map(row => [...row]);
  const newPending = [...rightPending];
  const mergedCells = [];
  const landings = [];
  const blockedIndices = [];
  let score = 0;

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
        if (result === 0) {
          // Annihilation
          score += tileVal + newGrid[row][rightmost];
        } else {
          // Subtraction
          score += tileVal;
        }
        newGrid[row][rightmost] = result;
        mergedCells.push([row, rightmost]);
        landings.push({ pendingIdx: i, row, col: rightmost, merged: true });
      } else if (rightmost < COLS - 1) {
        newGrid[row][rightmost + 1] = tileVal;
        landings.push({ pendingIdx: i, row, col: rightmost + 1, merged: false });
      } else {
        // col COLS-1 is occupied and tile is larger — no room to enter
        blockedIndices.push(i);
        continue; // preserve original tile value; don't replace with new random
      }
    }

    newPending[i] = randTile();
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

export function pushFromTop(grid, topPending) {
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
        if (result === 0) {
          // Annihilation
          score += tileVal + newGrid[topmost][col];
        } else {
          // Subtraction
          score += tileVal;
        }
        newGrid[topmost][col] = result;
        mergedCells.push([topmost, col]);
        landings.push({ pendingIdx: i, row: topmost, col, merged: true });
      } else if (topmost > 0) {
        newGrid[topmost - 1][col] = tileVal;
        landings.push({ pendingIdx: i, row: topmost - 1, col, merged: false });
      } else {
        // row 0 is occupied and tile is larger — no room to enter
        blockedIndices.push(i);
        continue; // preserve original tile value; don't replace with new random
      }
    }

    newPending[i] = randTile();
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

// Returns { grid, moves } where moves = [{ value, fromRow, fromCol, toRow, toCol }]
// Each iteration: gravity (columns fall down), then each row's halves pack toward center.
// Repeats until stable.
export function collapseGrid(grid) {
  const newGrid = grid.map(row => [...row]);
  const allMoves = [];

  while (true) {
    const moves = [];

    // ── Gravity: pack each column downward ──────────────────────────────────
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

    // ── Horizontal: each row's halves pack toward center ─────────────────────
    // Uses a snapshot so left-half and right-half reads are independent per row.
    for (let r = 0; r < ROWS; r++) {
      const rowSnapshot = [...newGrid[r]];

      // Left half (cols 0…CENTER_COL-1): pack rightward toward center
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

      // Right half (cols CENTER_COL…COLS-1): pack leftward toward center
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
