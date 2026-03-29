import {
  ROWS, COLS, PENDING_SIZE, PENDING_ROW_START, PENDING_COL_START, CENTER_COL,
  createInitialGrid, createInitialPending,
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
    expect(pending.every(t => [1, 2, 3].includes(t))).toBe(true);
  });
});

describe('Collision Logic', () => {
  test('equal tiles annihilate (1+1 → 0)', () => {
    const grid = [
      ...Array(ROWS - 1).fill(null).map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    grid[PENDING_ROW_START][0] = 1; // tile at position for left push

    const result = pushFromLeft(grid, [1, 0, 0, 0, 0]);
    expect(result.grid[PENDING_ROW_START][0]).toBe(0);
    expect(result.score).toBe(2); // 1 + 1
  });

  test('subtraction: smaller tile reduces larger (1 + 3 → 2)', () => {
    const grid = [
      ...Array(ROWS - 1).fill(null).map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    grid[PENDING_ROW_START][0] = 3; // larger tile

    const result = pushFromLeft(grid, [1, 0, 0, 0, 0]);
    expect(result.grid[PENDING_ROW_START][0]).toBe(2);
    expect(result.score).toBe(1); // score = moving tile value
  });

  test('no collision: larger tile does not collide with smaller', () => {
    const grid = [
      ...Array(ROWS - 1).fill(null).map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    grid[PENDING_ROW_START][0] = 1; // smaller tile

    const result = pushFromLeft(grid, [3, 0, 0, 0, 0]);
    // Larger tile (3) should stick adjacent (not collide)
    expect(result.grid[PENDING_ROW_START][0]).toBe(1); // original remains
    expect(result.score).toBe(0); // no collision score
  });
});

describe('Push From Left', () => {
  test('basic left push places tile adjacent to grid tile', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[PENDING_ROW_START][2] = 3;

    const result = pushFromLeft(grid, [2, 0, 0, 0, 0]);
    // Tile should be placed adjacent to the 3 at position [PENDING_ROW_START][1]
    // But then collapseGrid will be called which moves things down
    // For this test, just check that a collision happened
    expect(result.grid[PENDING_ROW_START][2]).toBe(1); // 3 - 2 = 1 (after collision)
    expect(result.pending[0]).toBeGreaterThan(0); // new random tile
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
    // Use CENTER_COL-1 (col 4) so tiles are already at the center target — no horizontal move
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
    // Use CENTER_COL-1 so no horizontal packing is triggered
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
    // Bug regression: tiles at cols 6,7 are contiguous (no mid-row hole)
    // but col 5 (CENTER_COL) is empty — must still pack to cols 5, 6
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][CENTER_COL + 1] = 1;  // col 6
    grid[ROWS - 1][CENTER_COL + 2] = 2;  // col 7

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    expect(row[CENTER_COL]).toBe(1);       // moved to col 5
    expect(row[CENTER_COL + 1]).toBe(2);   // moved to col 6
    expect(row[CENTER_COL + 2]).toBe(0);   // vacated
  });

  test('left half contiguous tiles with leading center gap pack correctly', () => {
    // Tiles at cols 2,3 are contiguous but col 4 (CENTER_COL-1) is empty
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][CENTER_COL - 3] = 1;  // col 2
    grid[ROWS - 1][CENTER_COL - 2] = 2;  // col 3

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    expect(row[CENTER_COL - 2]).toBe(1);   // moved to col 3
    expect(row[CENTER_COL - 1]).toBe(2);   // moved to col 4
    expect(row[CENTER_COL - 3]).toBe(0);   // vacated
  });
});

describe('Row Packing (all push directions)', () => {
  test('left-half tiles pack toward center regardless of starting column', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    // Tiles at cols 0 and 3; gravity falls them to bottom row first
    grid[5][0] = 1;
    grid[5][3] = 2;

    const result = collapseGrid(grid);
    // After gravity both land on row 9, then pack to cols 3, 4
    expect(result.grid[ROWS - 1].slice(0, CENTER_COL - 2).every(v => v === 0)).toBe(true);
    expect(result.grid[ROWS - 1][CENTER_COL - 2]).toBe(1);
    expect(result.grid[ROWS - 1][CENTER_COL - 1]).toBe(2);
  });

  test('right side packs left toward center even with empty center columns', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][7] = 1;
    grid[ROWS - 1][9] = 2;

    const result = collapseGrid(grid);
    expect(result.grid[ROWS - 1][CENTER_COL]).toBe(1);
    expect(result.grid[ROWS - 1][CENTER_COL + 1]).toBe(2);
  });

  test('left side packs right toward center even with empty center columns', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][0] = 1;
    grid[ROWS - 1][2] = 2;

    const result = collapseGrid(grid);
    expect(result.grid[ROWS - 1][CENTER_COL - 2]).toBe(1);
    expect(result.grid[ROWS - 1][CENTER_COL - 1]).toBe(2);
  });

  test('single right-side tile packs to CENTER_COL when center is empty', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][9] = 1;

    const result = collapseGrid(grid);
    expect(result.grid[ROWS - 1][CENTER_COL]).toBe(1);
  });
});

describe('Cascading Collapse Loop', () => {
  test('gravity then row-packing interact correctly', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    // Tiles in separate columns; gravity lands all on row 9, then row packing compacts
    grid[3][0] = 1;
    grid[4][2] = 2;
    grid[5][4] = 3;

    const result = collapseGrid(grid);
    // After gravity: [9][0]=1, [9][2]=2, [9][4]=3
    // After left-half row pack: cols [0,2,4] → [2,3,4]
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
    // Verify no tiles are lost
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
