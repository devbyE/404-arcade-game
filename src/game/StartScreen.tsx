import type { SavedStats } from './types'

type StartScreenProps = {
  stats: SavedStats
  onStart: () => void
}

function StartScreen({ stats, onStart }: StartScreenProps) {
  return (
    <section className="screen screen--intro">
      <div className="intro-content">
        <h1 id="page-title">
          <span>404</span>
          <span>Arcade Game</span>
        </h1>
        <p className="subtitle">
          Collect lost files. Avoid the bugs. Rebuild the route.
        </p>

        <div className="progress-strip" aria-label="Saved progress">
          <div>
            <span>Best</span>
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

        <button className="primary-button" type="button" onClick={onStart}>
          Start Game
        </button>
      </div>

      <aside className="controls-panel" aria-label="Game controls">
        <h2>Controls</h2>
        <dl>
          <div>
            <dt>Move</dt>
            <dd>WASD / Arrow Keys</dd>
          </div>
          <div>
            <dt>Pause</dt>
            <dd>P or Space</dd>
          </div>
          <div>
            <dt>Quit</dt>
            <dd>Q</dd>
          </div>
        </dl>
        <ul>
          <li>Collect 404 fragments</li>
          <li>Avoid error blocks</li>
          <li>Hits cost a life and time</li>
        </ul>
      </aside>
    </section>
  )
}

export default StartScreen
