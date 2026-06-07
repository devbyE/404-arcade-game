import type { SavedStats } from './types'

type GameOverScreenProps = {
  finalScore: number
  finalLevel: number
  stats: SavedStats
  onRestart: () => void
}

function GameOverScreen({
  finalScore,
  finalLevel,
  stats,
  onRestart,
}: GameOverScreenProps) {
  return (
    <section className="screen screen--over">
      <p className="eyebrow">Route rebuild ended</p>
      <h1 id="page-title">Game Over</h1>
      <div className="score-card" aria-label="Final round scores">
        <div>
          <span>Final score</span>
          <strong>{finalScore}</strong>
        </div>
        <div>
          <span>Level reached</span>
          <strong>{finalLevel}</strong>
        </div>
        <div>
          <span>Best score</span>
          <strong>{stats.bestScore}</strong>
        </div>
        <div>
          <span>Highest level</span>
          <strong>{stats.highestLevel}</strong>
        </div>
        <div>
          <span>Games played</span>
          <strong>{stats.gamesPlayed}</strong>
        </div>
      </div>
      <button className="primary-button" type="button" onClick={onRestart}>
        Restart
      </button>
    </section>
  )
}

export default GameOverScreen
