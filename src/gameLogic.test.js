import {
  ROWS, COLS, PENDING_SIZE, TOP_PENDING_SIZE, PENDING_ROW_START, PENDING_COL_START, CENTER_COL,
  createInitialGrid, createInitialPending, createInitialTopPending,
  pushFromLeft, pushFromRight, pushFromTop,
  collapseGrid,
} from './gameLogic.js';

describe('Game Constants', () => {
  test('grid dimensions are 10x10', () => {
    expect(ROWS).toBe(10);
    expect(COLS).toBe(10);
  });

  test('pending row starts at 5 (ROWS - PENDING_SIZE)', () => {
    expect(PENDING_ROW_START).toBe(5);
  });

  test('top pending size is 6 (centered over 10 cols)', () => {
    expect(TOP_PENDING_SIZE).toBe(6);
  });

  test('center column is 5', () => {
    expect(CENTER_COL).toBe(5);
  });
});

describe('Grid Initialization', () => {
  test('createInitialGrid returns 10x10 grid with pattern', () => {
    const grid = createInitialGrid();
    expect(grid.length).toBe(10);
    expect(grid[0].length).toBe(10);
    
    // Check initial 3-tile pattern: 6x4x2
    expect(grid[9].slice(2, 8)).toEqual([3, 3, 3, 3, 3, 3]); // row 10: cols 3-8
    expect(grid[8].slice(3, 7)).toEqual([3, 3, 3, 3]);       // row 9: cols 4-7
    expect(grid[7].slice(4, 6)).toEqual([3, 3]);             // row 8: cols 5-6
  });

  test('createInitialPending returns array of 5 tiles', () => {
    const pending = createInitialPending();
    expect(pending.length).toBe(5);
    expect(pending.every(t => t >= 1 && t <= 5)).toBe(true);
  });

  test('createInitialTopPending returns array of 6 tiles', () => {
    const pending = createInitialTopPending();
    expect(pending.length).toBe(6);
    expect(pending.every(t => t >= 1 && t <= 5)).toBe(true);
  });
});

describe('Collision Logic', () => {
  test('equal tiles annihilate (1+1 → 0)', () => {
    const grid = [
      ...Array(ROWS - 1).fill(null).map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    grid[PENDING_ROW_START][0] = 1;

    const result = pushFromLeft(grid, [1, 0, 0, 0, 0]);
    expect(result.grid[PENDING_ROW_START][0]).toBe(0);
    expect(result.score).toBe(2);
  });

  test('subtraction: smaller tile reduces larger (1 + 3 → 2)', () => {
    const grid = [
      ...Array(ROWS - 1).fill(null).map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    grid[PENDING_ROW_START][0] = 3;

    const result = pushFromLeft(grid, [1, 0, 0, 0, 0]);
    expect(result.grid[PENDING_ROW_START][0]).toBe(2);
    expect(result.score).toBe(1);
  });

  test('no collision: larger tile does not collide with smaller', () => {
    const grid = [
      ...Array(ROWS - 1).fill(null).map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    grid[PENDING_ROW_START][0] = 1;

    const result = pushFromLeft(grid, [3, 0, 0, 0, 0]);
    expect(result.grid[PENDING_ROW_START][0]).toBe(1);
    expect(result.score).toBe(0);
  });
});

describe('Push From Left', () => {
  test('basic left push places tile adjacent to grid tile', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[PENDING_ROW_START][2] = 3;

    const result = pushFromLeft(grid, [2, 0, 0, 0, 0]);
    expect(result.grid[PENDING_ROW_START][2]).toBe(1);
    expect(result.pending[0]).toBeGreaterThan(0);
  });

  test('left push in empty row flies through', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));

    const result = pushFromLeft(grid, [1, 0, 0, 0, 0]);
    expect(result.landings[0].flyThrough).toBe(true);
  });
});

describe('Push From Right', () => {
  test('basic right push places tile adjacent to grid tile', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[PENDING_ROW_START][6] = 3;

    const result = pushFromRight(grid, [2, 0, 0, 0, 0]);
    // Tile collides with 3, result = 3 - 2 = 1
    expect(result.grid[PENDING_ROW_START][6]).toBe(1);
  });
});

describe('Push From Top', () => {
  test('basic top push drops tile to column bottom', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));

    const result = pushFromTop(grid, [1, 0, 0, 0, 0]);
    const col = PENDING_COL_START; // column 2
    expect(result.grid[ROWS - 1][col]).toBe(1);
  });

  test('top push lands on existing tile in column', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][PENDING_COL_START] = 3;

    const result = pushFromTop(grid, [2, 0, 0, 0, 0]);
    // 2 < 3, so collision: result = 3 - 2 = 1
    expect(result.grid[ROWS - 1][PENDING_COL_START]).toBe(1);
    expect(result.score).toBe(2);
  });
});

describe('Vertical Collapse (Gravity)', () => {
  test('tiles fall down under gravity', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[2][CENTER_COL - 1] = 1;
    grid[3][CENTER_COL - 1] = 2;

    const result = collapseGrid(grid);
    const col = result.grid.map(row => row[CENTER_COL - 1]);
    const nonZero = col.filter(v => v !== 0);
    expect(nonZero).toEqual([1, 2]);
    expect(col.slice(-2)).toEqual([1, 2]);
  });

  test('tiles pack to bottom without gaps', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[0][CENTER_COL - 1] = 1;
    grid[3][CENTER_COL - 1] = 2;
    grid[7][CENTER_COL - 1] = 3;

    const result = collapseGrid(grid);
    const col = result.grid.map(row => row[CENTER_COL - 1]);
    expect(col.slice(-3)).toEqual([1, 2, 3]);
  });
});

describe('Horizontal Collapse (Row Packing)', () => {
  test('left half tiles with gap pack right toward center', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][0] = 1;
    grid[ROWS - 1][2] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    expect(row[CENTER_COL - 2]).toBe(1);
    expect(row[CENTER_COL - 1]).toBe(2);
  });

  test('right half tiles with gap pack left toward center', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][7] = 1;
    grid[ROWS - 1][9] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    expect(row[CENTER_COL]).toBe(1);
    expect(row[CENTER_COL + 1]).toBe(2);
  });

  test('right half contiguous tiles with leading center gap pack correctly', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][CENTER_COL + 1] = 1;
    grid[ROWS - 1][CENTER_COL + 2] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    expect(row[CENTER_COL]).toBe(1);
    expect(row[CENTER_COL + 1]).toBe(2);
    expect(row[CENTER_COL + 2]).toBe(0);
  });

  test('left half contiguous tiles with leading center gap pack correctly', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][CENTER_COL - 3] = 1;
    grid[ROWS - 1][CENTER_COL - 2] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    expect(row[CENTER_COL - 2]).toBe(1);
    expect(row[CENTER_COL - 1]).toBe(2);
    expect(row[CENTER_COL - 3]).toBe(0);
  });
});

describe('Cascading Collapse Loop', () => {
  test('gravity then row-packing interact correctly', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[3][0] = 1;
    grid[4][2] = 2;
    grid[5][4] = 3;

    const result = collapseGrid(grid);
    const bottomRow = result.grid[ROWS - 1];
    expect(bottomRow[2]).toBe(1);
    expect(bottomRow[3]).toBe(2);
    expect(bottomRow[4]).toBe(3);
  });

  test('right side row packing does not overwrite or lose tiles', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][6] = 1;
    grid[ROWS - 1][8] = 2;
    grid[ROWS - 1][9] = 3;

    const result = collapseGrid(grid);
    const flatOrig = grid.flat().filter(x => x !== 0).length;
    const flatResult = result.grid.flat().filter(x => x !== 0).length;
    expect(flatResult).toBe(flatOrig);

    const row = result.grid[ROWS - 1];
    expect(row[CENTER_COL]).toBe(1);
    expect(row[CENTER_COL + 1]).toBe(2);
    expect(row[CENTER_COL + 2]).toBe(3);
  });
});

describe('Edge Cases', () => {
  test('empty grid remains empty', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    const result = collapseGrid(grid);
    expect(result.grid.flat().every(x => x === 0)).toBe(true);
  });

  test('already collapsed grid produces no moves', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    // Tiles already at bottom-center positions
    grid[ROWS - 1][CENTER_COL - 1] = 1;
    grid[ROWS - 1][CENTER_COL] = 2;

    const result = collapseGrid(grid);
    expect(result.moves.length).toBe(0);
  });
});
