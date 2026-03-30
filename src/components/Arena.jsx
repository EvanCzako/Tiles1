import useGameStore from '../store';
import { CELL, GAP } from '../constants';
import { isDeadCell } from '../gameLogic';
import Tile from './Tile';
import FlyingTile from './FlyingTile';
import GameOverOverlay from './GameOverOverlay';

export default function Arena() {
  const {
    grid, leftPending, rightPending, topPending,
    score, gameOver, reset,
    flyingTiles, flyingSource,
    flashSet, redFlashSet, redFlashSource, annihilateSet,
    collapsingCells, disabledLeft, disabledRight, disabledTop,
    frozenPendingRows, cfg, layout,
  } = useGameStore();

  const { sideOffset, gridPx, gridTopOffset, pendingColTop, topPendingLeft } = layout;
  const { PENDING_ROW_START } = cfg;

  return (
    <>
      {gameOver && <GameOverOverlay score={score} onReset={reset} />}

      {flyingTiles.map(ft => (
        <FlyingTile
          key={ft.id}
          value={ft.value}
          fromX={ft.from.x} fromY={ft.from.y}
          toX={ft.to.x}     toY={ft.to.y}
          flyThrough={ft.flyThrough}
        />
      ))}

      {/* Top pending */}
      <div className="pending-row" style={{ left: sideOffset + topPendingLeft, top: 0 }}>
        {topPending.map((val, i) => {
          const isDisabled = disabledTop.has(i);
          const isBlocked  = redFlashSource === 'topPending' && redFlashSet.has(i);
          return (
            <Tile key={i}
              value={flyingSource === 'top' && !isBlocked && !isDisabled ? 0 : val}
              flashRed={isBlocked}
              disabled={isDisabled}
            />
          );
        })}
      </div>

      {/* Left pending */}
      <div className="pending-col" style={{ left: 0, top: pendingColTop }}>
        {leftPending.map((val, i) => {
          const rowActive  = frozenPendingRows ? frozenPendingRows.left[i] : grid[PENDING_ROW_START + i].some(v => v !== 0);
          const isDisabled = disabledLeft.has(i);
          const isBlocked  = redFlashSource === 'leftPending' && redFlashSet.has(i);
          return rowActive
            ? <Tile key={i}
                value={flyingSource === 'left' && !isBlocked && !isDisabled ? 0 : val}
                flashRed={isBlocked}
                disabled={isDisabled}
              />
            : <Tile key={i} value={0} />;
        })}
      </div>

      {/* Grid */}
      <div className="grid" style={{ left: sideOffset, top: gridTopOffset, width: gridPx, gridTemplateColumns: `repeat(${cfg.COLS}, ${CELL}px)` }}>
        {grid.map((row, r) =>
          row.map((val, c) => (
            isDeadCell(r, c)
              ? <div key={`${r}-${c}`} className="tile tile--dead" style={{ width: CELL, height: CELL }} />
              : <Tile
                  key={`${r}-${c}`}
                  value={collapsingCells.has(`${r},${c}`) ? 0 : val}
                  flashing={flashSet.has(`${r},${c}`)}
                  flashAnnihilate={annihilateSet.has(`${r},${c}`)}
                />
          ))
        )}
      </div>

      {/* Right pending */}
      <div className="pending-col" style={{ left: sideOffset + gridPx + GAP * 4, top: pendingColTop }}>
        {rightPending.map((val, i) => {
          const rowActive  = frozenPendingRows ? frozenPendingRows.right[i] : grid[PENDING_ROW_START + i].some(v => v !== 0);
          const isDisabled = disabledRight.has(i);
          const isBlocked  = redFlashSource === 'rightPending' && redFlashSet.has(i);
          return rowActive
            ? <Tile key={i}
                value={flyingSource === 'right' && !isBlocked && !isDisabled ? 0 : val}
                flashRed={isBlocked}
                disabled={isDisabled}
              />
            : <Tile key={i} value={0} />;
        })}
      </div>
    </>
  );
}
