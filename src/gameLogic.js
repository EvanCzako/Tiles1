export const ROWS = 9;
export const COLS = 9;
export const PENDING_SIZE = 4;          // side panels: 4 slots
export const TOP_PENDING_SIZE = 5;      // top row: 5 tiles (cols 2-6), centered

export const PENDING_ROW_START = ROWS - PENDING_SIZE; // 5
export const PENDING_COL_START = 2; // cols 2-6 for top
export const CENTER_COL = Math.floor(COLS / 2); // 4

export const GRID_CONFIGS = {
  '9x9': {
    ROWS: 9, COLS: 9, PENDING_SIZE: 4, TOP_PENDING_SIZE: 5,
    PENDING_ROW_START: 5, PENDING_COL_START: 2, CENTER_COL: 4,
  },
};

const DEFAULT_CFG = GRID_CONFIGS['9x9'];

export function createInitialGrid(cfg = DEFAULT_CFG) {
  const { ROWS, COLS, TOP_PENDING_SIZE, PENDING_COL_START } = cfg;
  const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
  // Build pyramid at bottom: bottom row is TOP_PENDING_SIZE wide, each row above loses 2
  // Each row has a symmetric ramp: e.g. width 6 → 1 2 3 3 2 1, width 4 → 1 2 2 1, width 2 → 1 1
  let width = TOP_PENDING_SIZE;
  let row = ROWS - 1;
  while (width >= 1) {
    const start = PENDING_COL_START + Math.floor((TOP_PENDING_SIZE - width) / 2);
    for (let j = 0; j < width; j++) {
      grid[row][start + j] = Math.min(j + 1, width - j);
    }
    width -= 2;
    row--;
  }
  return grid;
}

function randTile() {
  const r = Math.random() * 15.75;
  if (r < 5) return 1;
  if (r < 9) return 2;
  if (r < 12) return 3;
  if (r < 14) return 4;
	if (r < 15) return 5;
	if (r < 15.5) return 6
  return 7;
}

function randTileExcluding(exclude) {
  let v;
  do { v = randTile(); } while (v === exclude);
  return v;
}

export function createInitialPending(cfg = DEFAULT_CFG) {
  const arr = [];
  for (let i = 0; i < cfg.PENDING_SIZE; i++)
    arr.push(randTileExcluding(arr[i - 1] ?? -1));
  return arr;
}

export function createInitialTopPending(cfg = DEFAULT_CFG) {
  const arr = [];
  for (let i = 0; i < cfg.TOP_PENDING_SIZE; i++)
    arr.push(randTileExcluding(arr[i - 1] ?? -1));
  return arr;
}

function collide(moving, stationary) {
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

    newPending[i] = randTileExcluding(i > 0 ? newPending[i - 1] : -1);
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

    newPending[i] = randTileExcluding(i > 0 ? newPending[i - 1] : -1);
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

    newPending[i] = randTileExcluding(i > 0 ? newPending[i - 1] : -1);
  }

  return { grid: newGrid, pending: newPending, mergedCells, landings, blockedIndices, score };
}

export function collapseGrid(grid, cfg = DEFAULT_CFG, lastPushedSide = 'left') {
  const { ROWS, COLS, CENTER_COL } = cfg;
  const newGrid = grid.map(row => [...row]);
  const gravityMoves = [];
  const horizontalMoves = [];

  // Phase 1: gravity (downward) to stability — always runs before horizontal
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
    gravityMoves.push(...moves);
    if (moves.length === 0) break;
  }

  // Snapshot after gravity, before horizontal — needed for staged animation
  const midGrid = newGrid.map(row => [...row]);

  // Phase 2: horizontal (inward) to stability — runs only after gravity is settled
  // The most recently pushed side gets priority for the center column
  while (true) {
    const moves = [];
    for (let r = 0; r < ROWS; r++) {
      const rowSnapshot = [...newGrid[r]];

      if (lastPushedSide === 'left') {
        // Left side pushes right toward the center and can occupy CENTER_COL
        {
          const tiles = [];
          for (let c = 0; c <= CENTER_COL; c++) {
            if (rowSnapshot[c] !== 0) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            const already = tiles.every((t, i) => t.c === CENTER_COL + 1 - tiles.length + i);
            if (!already) {
              for (let c = 0; c <= CENTER_COL; c++) newGrid[r][c] = 0;
              let dest = CENTER_COL + 1 - tiles.length;
              for (const { c: from, v } of tiles) {
                newGrid[r][dest] = v;
                if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
                dest++;
              }
            }
          }
        }

        // Right side packs left but stays right of left tiles
        {
          const tiles = [];
          for (let c = CENTER_COL + 1; c < COLS; c++) {
            if (rowSnapshot[c] !== 0) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            let rightmostLeftTile = -1;
            for (let c = CENTER_COL; c >= 0; c--) {
              if (newGrid[r][c] !== 0) { rightmostLeftTile = c; break; }
            }
            // If no left tiles exist, pack toward center; otherwise pack right of left tiles
            const destStart = rightmostLeftTile === -1 ? CENTER_COL + 1 - tiles.length : rightmostLeftTile + 1;
            const already = tiles.every((t, i) => t.c === destStart + i);
            if (!already) {
              for (let c = CENTER_COL + 1; c < COLS; c++) newGrid[r][c] = 0;
              let dest = destStart;
              for (const { c: from, v } of tiles) {
                newGrid[r][dest] = v;
                if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
                dest++;
              }
            }
          }
        }
      } else {
        // Right side pushes left toward the center and can occupy CENTER_COL
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

        // Left side packs right but stays left of right tiles
        {
          const tiles = [];
          for (let c = 0; c < CENTER_COL; c++) {
            if (rowSnapshot[c] !== 0) tiles.push({ c, v: rowSnapshot[c] });
          }
          if (tiles.length > 0) {
            let leftmostRightTile = COLS;
            for (let c = CENTER_COL; c < COLS; c++) {
              if (newGrid[r][c] !== 0) { leftmostRightTile = c; break; }
            }
            // If no right tiles exist, pack toward center; otherwise pack left of right tiles
            const destEnd = leftmostRightTile === COLS ? CENTER_COL : leftmostRightTile - 1;
            const already = tiles.every((t, i) => t.c === destEnd - tiles.length + 1 + i);
            if (!already) {
              for (let c = 0; c < CENTER_COL; c++) newGrid[r][c] = 0;
              let dest = destEnd - tiles.length + 1;
              for (const { c: from, v } of tiles) {
                newGrid[r][dest] = v;
                if (from !== dest) moves.push({ value: v, fromRow: r, fromCol: from, toRow: r, toCol: dest });
                dest++;
              }
            }
          }
        }
      }
    }
    horizontalMoves.push(...moves);
    if (moves.length === 0) break;
  }

  return { grid: newGrid, midGrid, gravityMoves, horizontalMoves };
}

export function annihilateAdjacent(grid, cfg = DEFAULT_CFG) {
  const { ROWS, COLS } = cfg;
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const toAnnihilate = [];
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (visited[r][c] || grid[r][c] === 0) continue;

      const value = grid[r][c];
      const group = [];
      const queue = [[r, c]];
      visited[r][c] = true;

      while (queue.length > 0) {
        const [cr, cc] = queue.shift();
        group.push([cr, cc]);
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc] && grid[nr][nc] === value) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }

      if (group.length >= 2) {
        toAnnihilate.push(...group);
        score += group.length * value;
      }
    }
  }

  if (toAnnihilate.length === 0) return { grid, annihilatedCells: [], score: 0 };

  const newGrid = grid.map(row => [...row]);
  for (const [r, c] of toAnnihilate) newGrid[r][c] = 0;
  return { grid: newGrid, annihilatedCells: toAnnihilate, score };
}

export function isDeadCell(r, c) {
  return false;
}

export function getTileColor(value) {
  const colors = {
    0:  { bg: '#1e1e38', text: 'transparent' },
    1:  { bg: '#4488ee', text: '#fff' },  // blue
    2:  { bg: '#22bbaa', text: '#fff' },  // teal
    3:  { bg: '#44cc66', text: '#fff' },  // green
    4:  { bg: '#99cc22', text: '#fff' },  // yellow-green
    5:  { bg: '#ffcc00', text: '#222' },  // yellow
    6:  { bg: '#ff8822', text: '#fff' },  // orange
    7:  { bg: '#ff4422', text: '#fff' },  // red-orange
    8:  { bg: '#dd1144', text: '#fff' },  // red
    9:  { bg: '#cc1188', text: '#fff' },  // magenta
    10: { bg: '#8822cc', text: '#fff' },  // purple
  };
  return colors[value] ?? { bg: '#fff', text: '#333' };
}
