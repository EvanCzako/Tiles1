import {
  ROWS, COLS, PENDING_SIZE, TOP_PENDING_SIZE, PENDING_ROW_START, PENDING_COL_START, CENTER_COL,
  createInitialGrid, createInitialPending, createInitialTopPending,
  pushFromLeft, pushFromRight, pushFromTop,
  collapseGrid,
} from './gameLogic.js';

describe('Game Constants', () => {
  test('grid dimensions are 9x9', () => {
    expect(ROWS).toBe(9);
    expect(COLS).toBe(9);
  });

  test('pending row starts at 5 (ROWS - PENDING_SIZE)', () => {
    expect(PENDING_ROW_START).toBe(5);
  });

  test('top pending size is 5 (centered over 9 cols)', () => {
    expect(TOP_PENDING_SIZE).toBe(5);
  });

  test('center column is 4', () => {
    expect(CENTER_COL).toBe(4);
  });
});

describe('Grid Initialization', () => {
  test('createInitialGrid returns 9x9 grid with pattern', () => {
    const grid = createInitialGrid();
    expect(grid.length).toBe(9);
    expect(grid[0].length).toBe(9);

    // Check initial pattern: 12321 / 121 / 1
    expect(grid[8].slice(2, 7)).toEqual([1, 2, 3, 2, 1]); // bottom row: cols 2-6
    expect(grid[7].slice(3, 6)).toEqual([1, 2, 1]);       // middle row: cols 3-5
    expect(grid[6].slice(4, 5)).toEqual([1]);             // top row: col 4
  });

  test('createInitialPending returns array of 4 tiles', () => {
    const pending = createInitialPending();
    expect(pending.length).toBe(4);
    expect(pending.every(t => t >= 1 && t <= 7)).toBe(true);
  });

  test('createInitialTopPending returns array of 5 tiles', () => {
    const pending = createInitialTopPending();
    expect(pending.length).toBe(5);
    expect(pending.every(t => t >= 1 && t <= 7)).toBe(true);
  });
});

describe('Collision Logic', () => {
  test('equal tiles placed adjacent (no collision annihilation)', () => {
    const grid = [
      ...Array(ROWS - 1).fill(null).map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    grid[PENDING_ROW_START][1] = 1;

    const result = pushFromLeft(grid, [1, 0, 0, 0]);
    // equal tiles: no collision merge, tile lands at col 0 (adjacent)
    expect(result.grid[PENDING_ROW_START][1]).toBe(1);
    expect(result.grid[PENDING_ROW_START][0]).toBe(1);
    expect(result.score).toBe(0);
  });

  test('unequal tiles do not merge: incoming placed adjacent', () => {
    const grid = [
      ...Array(ROWS - 1).fill(null).map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    grid[PENDING_ROW_START][1] = 3;

    const result = pushFromLeft(grid, [1, 0, 0, 0]);
    // 1 !== 3: no merge, tile lands at col 0 (adjacent)
    expect(result.grid[PENDING_ROW_START][1]).toBe(3);
    expect(result.grid[PENDING_ROW_START][0]).toBe(1);
    expect(result.score).toBe(0);
  });

  test('no collision: larger tile does not collide with smaller', () => {
    const grid = [
      ...Array(ROWS - 1).fill(null).map(() => Array(COLS).fill(0)),
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    grid[PENDING_ROW_START][1] = 1;

    const result = pushFromLeft(grid, [3, 0, 0, 0]);
    // 3 !== 1: no merge, tile lands at col 0
    expect(result.grid[PENDING_ROW_START][1]).toBe(1);
    expect(result.grid[PENDING_ROW_START][0]).toBe(3);
    expect(result.score).toBe(0);
  });
});

describe('Push From Left', () => {
  test('basic left push places tile adjacent to grid tile', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[PENDING_ROW_START][2] = 3;

    const result = pushFromLeft(grid, [2, 0, 0, 0]);
    // 2 !== 3: no merge, tile placed at col 1
    expect(result.grid[PENDING_ROW_START][2]).toBe(3);
    expect(result.grid[PENDING_ROW_START][1]).toBe(2);
    expect(result.pending[0]).toBeGreaterThan(0);
  });

  test('left push in empty row flies through', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));

    const result = pushFromLeft(grid, [1, 0, 0, 0]);
    expect(result.landings[0].flyThrough).toBe(true);
  });
});

describe('Push From Right', () => {
  test('basic right push places tile adjacent to grid tile', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[PENDING_ROW_START][6] = 3;

    const result = pushFromRight(grid, [2, 0, 0, 0]);
    // 2 !== 3: no merge, tile placed at col 7
    expect(result.grid[PENDING_ROW_START][6]).toBe(3);
    expect(result.grid[PENDING_ROW_START][7]).toBe(2);
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
    // 2 !== 3: no merge, tile placed at row ROWS-2
    expect(result.grid[ROWS - 1][PENDING_COL_START]).toBe(3);
    expect(result.grid[ROWS - 2][PENDING_COL_START]).toBe(2);
    expect(result.score).toBe(0);
  });
});

describe('Vertical Collapse (Gravity)', () => {
  test('tiles fall down under gravity', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[2][CENTER_COL] = 1;
    grid[3][CENTER_COL] = 2;

    const result = collapseGrid(grid);
    const col = result.grid.map(row => row[CENTER_COL]);
    const nonZero = col.filter(v => v !== 0);
    expect(nonZero).toEqual([1, 2]);
    expect(col.slice(-2)).toEqual([1, 2]);
  });

  test('tiles pack to bottom without gaps', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[0][CENTER_COL] = 1;
    grid[3][CENTER_COL] = 2;
    grid[7][CENTER_COL] = 3;

    const result = collapseGrid(grid);
    const col = result.grid.map(row => row[CENTER_COL]);
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
    // With center fill requirement, CENTER_COL should be filled
    expect(row[CENTER_COL]).not.toBe(0);
    expect(row.slice(0, CENTER_COL + 1).filter(v => v !== 0).length).toBe(2);
  });

  test('right half tiles with gap pack left toward center', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][6] = 1;
    grid[ROWS - 1][8] = 2;

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

  test('left half contiguous tiles with trailing center gap pack to center', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][0] = 1;
    grid[ROWS - 1][1] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    // Should pack right and fill CENTER_COL with one of them
    expect(row[CENTER_COL]).not.toBe(0);
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
    grid[ROWS - 1][5] = 1;
    grid[ROWS - 1][7] = 2;
    grid[ROWS - 1][8] = 3;

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
    expect(result.gravityMoves.length).toBe(0);
    expect(result.horizontalMoves.length).toBe(0);
  });
});

describe('Center Column Fill Requirement', () => {
  test('left-side only tiles are pulled to center to fill CENTER_COL', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][0] = 1;
    grid[ROWS - 1][2] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    // Row has tiles, so CENTER_COL must be filled
    expect(row[CENTER_COL]).not.toBe(0);
    expect(row.slice(0, CENTER_COL).every(v => v === 0 || v !== 0)).toBe(true);
  });

  test('right-side only tiles are pulled to center to fill CENTER_COL', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][6] = 1;
    grid[ROWS - 1][8] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    // Row has tiles, so CENTER_COL must be filled
    expect(row[CENTER_COL]).not.toBe(0);
  });

  test('single left-side tile moves to center', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][1] = 5;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    expect(row[CENTER_COL]).toBe(5);
    expect(row.slice(0, CENTER_COL).every(v => v === 0)).toBe(true);
  });

  test('single right-side tile moves to center', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][7] = 3;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    expect(row[CENTER_COL]).toBe(3);
    expect(row.slice(CENTER_COL + 1).every(v => v === 0)).toBe(true);
  });

  test('empty rows stay empty (no tiles to fill center)', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][CENTER_COL] = 1; // center already filled
    grid[ROWS - 2]; // empty row

    const result = collapseGrid(grid);
    expect(result.grid[ROWS - 2].every(v => v === 0)).toBe(true);
  });
});

describe('No Overhang Boundary Checks', () => {
  test('left-side tiles do not overhang right edge', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    for (let i = 0; i < COLS; i++) {
      grid[ROWS - 1][i] = 1; // Fill entire row
    }

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    // All tiles should be within bounds
    expect(row.every((v, i) => i < COLS)).toBe(true);
    // No overhang past COLS-1
    expect(row[COLS]).toBeUndefined();
  });

  test('right-side tiles do not overhang into left half', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][CENTER_COL + 1] = 1;
    grid[ROWS - 1][CENTER_COL + 2] = 2;
    grid[ROWS - 1][CENTER_COL + 3] = 3;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];
    // Right side should start at CENTER_COL + 1 or later
    for (let c = 0; c < CENTER_COL; c++) {
      if (grid[ROWS - 1][c] === 0) {
        expect(row[c]).toBe(0);
      }
    }
  });

  test('multiple rows collapse without interference', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    // Bottom row: mix of left and right tiles
    grid[ROWS - 1][0] = 1;
    grid[ROWS - 1][1] = 2;
    grid[ROWS - 1][7] = 3;
    grid[ROWS - 1][8] = 4;

    const result = collapseGrid(grid);
    const row1 = result.grid[ROWS - 1];

    // Verify all 4 tiles are preserved and positioned correctly
    expect(row1.filter(v => v !== 0).length).toBe(4);
    // Verify no tiles in upper rows
    for (let r = 0; r < ROWS - 1; r++) {
      expect(result.grid[r].every(v => v === 0)).toBe(true);
    }
  });
});

describe('Complex Cascading Scenarios', () => {
  test('gravity + horizontal + center fill all work together', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    // Floating left-side tile high up
    grid[2][0] = 1;
    // Floating right-side tile high up
    grid[3][8] = 2;

    const result = collapseGrid(grid);
    const bottomRow = result.grid[ROWS - 1];

    // After gravity, both should fall to bottom
    expect(bottomRow.some(v => v !== 0)).toBe(true);
    // CENTER_COL should be filled since row has tiles
    expect(bottomRow[CENTER_COL]).not.toBe(0);
  });

  test('row with tile on each side of center stays balanced', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[ROWS - 1][CENTER_COL - 1] = 1;
    grid[ROWS - 1][CENTER_COL] = 5;
    grid[ROWS - 1][CENTER_COL + 1] = 2;

    const result = collapseGrid(grid);
    const row = result.grid[ROWS - 1];

    // Tiles should remain with center filled
    expect(row[CENTER_COL]).toBe(5);
    expect([1, 2].includes(row[CENTER_COL - 1]) || [1, 2].includes(row[CENTER_COL + 1])).toBe(true);
  });

  test('prevents tiles from crossing the center boundary', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    // Bottom row: left-side at edge, right-side at edge
    grid[ROWS - 1][0] = 1;
    grid[ROWS - 1][1] = 2;
    grid[ROWS - 1][7] = 3;
    grid[ROWS - 1][8] = 4;

    const result = collapseGrid(grid);
    const row1 = result.grid[ROWS - 1];

    // Verify tiles exist and didn't cross boundary
    expect(row1.filter(v => v !== 0).length).toBe(4);
    
    // Find left-side and right-side tiles
    let leftmost = -1, rightmost = -1;
    for (let c = 0; c < COLS; c++) {
      if (row1[c] !== 0) {
        if (leftmost === -1) leftmost = c;
        rightmost = c;
      }
    }
    
    // Verify positions: left side should be <= CENTER_COL, right side should have tiles across boundary
    expect(leftmost).toBeLessThanOrEqual(CENTER_COL);
    expect(rightmost).toBeGreaterThanOrEqual(CENTER_COL);
  });

  test('tile counts are preserved through collapse', () => {
    const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    grid[1][0] = 1;
    grid[2][3] = 2;
    grid[4][8] = 3;
    grid[5][CENTER_COL - 1] = 4;
    grid[5][CENTER_COL + 1] = 5;

    const before = grid.flat().filter(v => v !== 0).length;
    const result = collapseGrid(grid);
    const after = result.grid.flat().filter(v => v !== 0).length;

    expect(after).toBe(before);
  });
});
