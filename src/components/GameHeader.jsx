const isTouch = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export default function GameHeader({ score }) {
  return (
    <div className="game-header">
      <h1 className="title">TILES</h1>
      <p className="score">Score: {score}</p>
      <p className="hint">
        {isTouch
          ? 'swipe ← → to push  ·  swipe ↓ to drop'
          : '← → push tiles in  ·  ↓ drop from top'}
      </p>
    </div>
  );
}
