type HudProps = {
  score: number
  lives: number
  timeRemaining: number
  level: number
}

function Hud({ score, lives, timeRemaining, level }: HudProps) {
  return (
    <>
      <header className="hud">
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span>Lives</span>
          <strong className="lives-hearts" aria-label={`${lives} lives`}>
            {'\u2665'.repeat(lives)}
          </strong>
        </div>
        <div>
          <span>Time</span>
          <strong>{Math.ceil(timeRemaining)}</strong>
        </div>
        <div>
          <span>Level</span>
          <strong>{level}</strong>
        </div>
      </header>

      <p className="controls-hint">
        Move: WASD / Arrows {'\u00b7'} Pause: P or Space {'\u00b7'} Quit: Q
      </p>
    </>
  )
}

export default Hud
