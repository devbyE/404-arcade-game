import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

type Phase = 'start' | 'playing' | 'gameOver'
type Theme = 'dark' | 'light'

type Point = {
  x: number
  y: number
}

type Fragment = Point & {
  id: number
}

type Hazard = Point & {
  id: number
  vx: number
  vy: number
}

type HitFeedback = Point & {
  id: number
  text: string
  expiresAt: number
}

type World = {
  player: Point
  fragments: Fragment[]
  hazards: Hazard[]
  score: number
  lives: number
  timeRemaining: number
  invulnerable: boolean
  hitFeedback: HitFeedback | null
}

type SavedStats = {
  bestScore: number
  highestLevel: number
  gamesPlayed: number
}

const ARENA_WIDTH = 900
const ARENA_HEIGHT = 540
const PLAYER_SIZE = 28
const FRAGMENT_SIZE = 42
const HAZARD_SIZE = 38
const ROUND_SECONDS = 90
const STARTING_LIVES = 3
const PLAYER_SPEED = 320
const INVULNERABLE_MS = 1400
const HIT_FEEDBACK_MS = 850
const STORAGE_KEY = '404-arcade-progress'

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const randomPoint = (size: number): Point => ({
  x: Math.random() * (ARENA_WIDTH - size),
  y: Math.random() * (ARENA_HEIGHT - size),
})

const isTouching = (a: Point, aSize: number, b: Point, bSize: number) =>
  a.x < b.x + bSize &&
  a.x + aSize > b.x &&
  a.y < b.y + bSize &&
  a.y + aSize > b.y

const getLevel = (score: number) => Math.min(Math.floor(score / 50) + 1, 5)

const getHitPenalty = (level: number) => level + 1

const getHazardSpeedMultiplier = (level: number) => 1 + (level - 1) * 0.14

const loadSavedStats = (): SavedStats => {
  const fallback = {
    bestScore: 0,
    highestLevel: 1,
    gamesPlayed: 0,
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      return fallback
    }

    const parsed = JSON.parse(saved) as Partial<SavedStats>

    return {
      bestScore: Number(parsed.bestScore) || 0,
      highestLevel: Number(parsed.highestLevel) || 1,
      gamesPlayed: Number(parsed.gamesPlayed) || 0,
    }
  } catch {
    return fallback
  }
}

const saveStats = (stats: SavedStats) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
}

const createFragments = (): Fragment[] =>
  Array.from({ length: 7 }, (_, id) => ({
    id,
    ...randomPoint(FRAGMENT_SIZE),
  }))

const createHazards = (): Hazard[] =>
  Array.from({ length: 5 }, (_, id) => {
    const direction = id % 2 === 0 ? 1 : -1

    return {
      id,
      ...randomPoint(HAZARD_SIZE),
      vx: direction * (42 + id * 8),
      vy: -direction * (34 + id * 6),
    }
  })

const createWorld = (): World => ({
  player: {
    x: ARENA_WIDTH / 2 - PLAYER_SIZE / 2,
    y: ARENA_HEIGHT / 2 - PLAYER_SIZE / 2,
  },
  fragments: createFragments(),
  hazards: createHazards(),
  score: 0,
  lives: STARTING_LIVES,
  timeRemaining: ROUND_SECONDS,
  invulnerable: false,
  hitFeedback: null,
})

function App() {
  const [phase, setPhase] = useState<Phase>('start')
  const [theme, setTheme] = useState<Theme>('dark')
  const [world, setWorld] = useState<World>(() => createWorld())
  const [paused, setPaused] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [finalLevel, setFinalLevel] = useState(1)
  const [stats, setStats] = useState<SavedStats>(() => loadSavedStats())
  const worldRef = useRef(world)
  const phaseRef = useRef(phase)
  const pausedRef = useRef(paused)
  const keysRef = useRef(new Set<string>())
  const invulnerableUntilRef = useRef(0)
  const feedbackIdRef = useRef(0)

  useEffect(() => {
    worldRef.current = world
  }, [world])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const finishRound = useCallback((score: number) => {
    const level = getLevel(score)

    setFinalScore(score)
    setFinalLevel(level)
    setStats((currentStats) => {
      const nextStats = {
        bestScore: Math.max(currentStats.bestScore, score),
        highestLevel: Math.max(currentStats.highestLevel, level),
        gamesPlayed: currentStats.gamesPlayed + 1,
      }

      saveStats(nextStats)
      return nextStats
    })
    keysRef.current.clear()
    setPaused(false)
    setPhase('gameOver')
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isMoveKey = [
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
        'w',
        'a',
        's',
        'd',
      ].includes(key)
      const isPauseKey = key === 'p' || key === ' '
      const isQuitKey = key === 'q'

      if (isMoveKey || isPauseKey) {
        event.preventDefault()
      }

      if (isQuitKey && phaseRef.current === 'playing') {
        event.preventDefault()
        finishRound(worldRef.current.score)
        return
      }

      if (isPauseKey && phaseRef.current === 'playing') {
        keysRef.current.clear()
        setPaused((current) => !current)
        return
      }

      if (isMoveKey && phaseRef.current === 'playing' && !pausedRef.current) {
        keysRef.current.add(key)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [finishRound])

  const startRound = useCallback(() => {
    const nextWorld = createWorld()

    keysRef.current.clear()
    invulnerableUntilRef.current = 0
    worldRef.current = nextWorld
    setWorld(nextWorld)
    setPaused(false)
    setPhase('playing')
  }, [])

  useEffect(() => {
    if (phase !== 'playing') {
      return
    }

    let animationFrame = 0
    let lastTime = performance.now()

    const tick = (now: number) => {
      const elapsed = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      if (pausedRef.current) {
        animationFrame = requestAnimationFrame(tick)
        return
      }

      const previous = worldRef.current
      const currentLevel = getLevel(previous.score)
      const hazardSpeedMultiplier = getHazardSpeedMultiplier(currentLevel)
      const next: World = {
        ...previous,
        player: { ...previous.player },
        fragments: previous.fragments.map((fragment) => ({ ...fragment })),
        hazards: previous.hazards.map((hazard) => ({ ...hazard })),
        timeRemaining: Math.max(0, previous.timeRemaining - elapsed),
        hitFeedback:
          previous.hitFeedback && previous.hitFeedback.expiresAt > now
            ? { ...previous.hitFeedback }
            : null,
      }

      const keys = keysRef.current
      const dx =
        (keys.has('arrowright') || keys.has('d') ? 1 : 0) -
        (keys.has('arrowleft') || keys.has('a') ? 1 : 0)
      const dy =
        (keys.has('arrowdown') || keys.has('s') ? 1 : 0) -
        (keys.has('arrowup') || keys.has('w') ? 1 : 0)
      const length = Math.hypot(dx, dy) || 1

      next.player.x = clamp(
        next.player.x + (dx / length) * PLAYER_SPEED * elapsed,
        0,
        ARENA_WIDTH - PLAYER_SIZE,
      )
      next.player.y = clamp(
        next.player.y + (dy / length) * PLAYER_SPEED * elapsed,
        0,
        ARENA_HEIGHT - PLAYER_SIZE,
      )

      next.hazards = next.hazards.map((hazard) => {
        let x = hazard.x + hazard.vx * hazardSpeedMultiplier * elapsed
        let y = hazard.y + hazard.vy * hazardSpeedMultiplier * elapsed
        let vx = hazard.vx
        let vy = hazard.vy

        if (x <= 0 || x >= ARENA_WIDTH - HAZARD_SIZE) {
          vx *= -1
          x = clamp(x, 0, ARENA_WIDTH - HAZARD_SIZE)
        }

        if (y <= 0 || y >= ARENA_HEIGHT - HAZARD_SIZE) {
          vy *= -1
          y = clamp(y, 0, ARENA_HEIGHT - HAZARD_SIZE)
        }

        return { ...hazard, x, y, vx, vy }
      })

      next.fragments = next.fragments.map((fragment) => {
        if (isTouching(next.player, PLAYER_SIZE, fragment, FRAGMENT_SIZE)) {
          next.score += 1
          return { ...fragment, ...randomPoint(FRAGMENT_SIZE) }
        }

        return fragment
      })

      const nextLevel = getLevel(next.score)
      const hitHazard = next.hazards.some((hazard) =>
        isTouching(next.player, PLAYER_SIZE, hazard, HAZARD_SIZE),
      )
      const isInvulnerable = now < invulnerableUntilRef.current

      if (hitHazard && !isInvulnerable) {
        const hitPenalty = getHitPenalty(nextLevel)

        next.lives -= 1
        next.timeRemaining = Math.max(0, next.timeRemaining - hitPenalty)
        next.hitFeedback = {
          id: feedbackIdRef.current,
          text: `-${hitPenalty}s`,
          expiresAt: now + HIT_FEEDBACK_MS,
          x: next.player.x,
          y: Math.max(0, next.player.y - 34),
        }
        feedbackIdRef.current += 1
        invulnerableUntilRef.current = now + INVULNERABLE_MS
      }

      next.invulnerable = now < invulnerableUntilRef.current

      worldRef.current = next
      setWorld(next)

      if (next.timeRemaining <= 0 || next.lives <= 0) {
        finishRound(next.score)
        return
      }

      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(animationFrame)
  }, [finishRound, phase])

  const currentLevel = getLevel(world.score)
  const themeLabel = theme === 'dark' ? 'light theme' : 'dark theme'

  return (
    <main className="app-shell" data-theme={theme} aria-labelledby="page-title">
      <button
        className="theme-toggle"
        type="button"
        onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        aria-label={`Switch to ${themeLabel}`}
      >
        {theme === 'dark' ? (
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M20 15.5A8.2 8.2 0 0 1 8.5 4 8.7 8.7 0 1 0 20 15.5Z" />
          </svg>
        )}
      </button>

      {phase === 'start' && (
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

            <button className="primary-button" type="button" onClick={startRound}>
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
      )}

      {phase === 'playing' && (
        <section className="game-layout" aria-label="404 Arcade play area">
          <header className="hud">
            <div>
              <span>Score</span>
              <strong>{world.score}</strong>
            </div>
            <div>
              <span>Lives</span>
              <strong className="lives-hearts" aria-label={`${world.lives} lives`}>
                {'\u2665'.repeat(world.lives)}
              </strong>
            </div>
            <div>
              <span>Time</span>
              <strong>{Math.ceil(world.timeRemaining)}</strong>
            </div>
            <div>
              <span>Level</span>
              <strong>{currentLevel}</strong>
            </div>
          </header>

          <p className="controls-hint">
            Move: WASD / Arrows {'\u00b7'} Pause: P or Space {'\u00b7'} Quit: Q
          </p>

          <div className="arena">
            <div className="arena__grid" />

            {world.fragments.map((fragment) => (
              <div
                className="fragment"
                key={fragment.id}
                style={{
                  left: `${(fragment.x / ARENA_WIDTH) * 100}%`,
                  top: `${(fragment.y / ARENA_HEIGHT) * 100}%`,
                  width: `${(FRAGMENT_SIZE / ARENA_WIDTH) * 100}%`,
                  height: `${(FRAGMENT_SIZE / ARENA_HEIGHT) * 100}%`,
                }}
              >
                404
              </div>
            ))}

            {world.hazards.map((hazard) => (
              <div
                className="hazard"
                key={hazard.id}
                style={{
                  left: `${(hazard.x / ARENA_WIDTH) * 100}%`,
                  top: `${(hazard.y / ARENA_HEIGHT) * 100}%`,
                  width: `${(HAZARD_SIZE / ARENA_WIDTH) * 100}%`,
                  height: `${(HAZARD_SIZE / ARENA_HEIGHT) * 100}%`,
                }}
              >
                !
              </div>
            ))}

            {world.hitFeedback && (
              <div
                className="hit-feedback"
                key={world.hitFeedback.id}
                style={{
                  left: `${(world.hitFeedback.x / ARENA_WIDTH) * 100}%`,
                  top: `${(world.hitFeedback.y / ARENA_HEIGHT) * 100}%`,
                }}
              >
                {world.hitFeedback.text}
              </div>
            )}

            <div
              className={`player${world.invulnerable ? ' player--safe' : ''}`}
              style={{
                left: `${(world.player.x / ARENA_WIDTH) * 100}%`,
                top: `${(world.player.y / ARENA_HEIGHT) * 100}%`,
                width: `${(PLAYER_SIZE / ARENA_WIDTH) * 100}%`,
                height: `${(PLAYER_SIZE / ARENA_HEIGHT) * 100}%`,
              }}
            />

            {paused && (
              <div className="pause-overlay" role="status" aria-live="polite">
                <strong>Paused</strong>
                <span>Press P or Space to resume</span>
                <span>Press Q to quit the round</span>
              </div>
            )}
          </div>
        </section>
      )}

      {phase === 'gameOver' && (
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
          <button className="primary-button" type="button" onClick={startRound}>
            Restart
          </button>
        </section>
      )}
    </main>
  )
}

export default App
