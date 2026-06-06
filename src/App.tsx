import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

type Phase = 'start' | 'playing' | 'gameOver'

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

type World = {
  player: Point
  fragments: Fragment[]
  hazards: Hazard[]
  score: number
  lives: number
  timeRemaining: number
  invulnerable: boolean
}

const ARENA_WIDTH = 900
const ARENA_HEIGHT = 540
const PLAYER_SIZE = 28
const FRAGMENT_SIZE = 42
const HAZARD_SIZE = 38
const ROUND_SECONDS = 60
const STARTING_LIVES = 3
const PLAYER_SPEED = 320
const INVULNERABLE_MS = 1400

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
})

function App() {
  const [phase, setPhase] = useState<Phase>('start')
  const [world, setWorld] = useState<World>(() => createWorld())
  const [finalScore, setFinalScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const worldRef = useRef(world)
  const keysRef = useRef(new Set<string>())
  const invulnerableUntilRef = useRef(0)

  useEffect(() => {
    worldRef.current = world
  }, [world])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(
          event.key,
        )
      ) {
        event.preventDefault()
        keysRef.current.add(event.key.toLowerCase())
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
  }, [])

  const startRound = useCallback(() => {
    const nextWorld = createWorld()

    keysRef.current.clear()
    invulnerableUntilRef.current = 0
    worldRef.current = nextWorld
    setWorld(nextWorld)
    setPhase('playing')
  }, [])

  useEffect(() => {
    if (phase !== 'playing') {
      return
    }

    let animationFrame = 0
    let lastTime = performance.now()
    const roundStartedAt = lastTime

    const endRound = (score: number) => {
      setFinalScore(score)
      setBestScore((currentBest) => Math.max(currentBest, score))
      setPhase('gameOver')
    }

    const tick = (now: number) => {
      const elapsed = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      const previous = worldRef.current
      const next: World = {
        ...previous,
        player: { ...previous.player },
        fragments: previous.fragments.map((fragment) => ({ ...fragment })),
        hazards: previous.hazards.map((hazard) => ({ ...hazard })),
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
        let x = hazard.x + hazard.vx * elapsed
        let y = hazard.y + hazard.vy * elapsed
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

      const hitHazard = next.hazards.some((hazard) =>
        isTouching(next.player, PLAYER_SIZE, hazard, HAZARD_SIZE),
      )
      const isInvulnerable = now < invulnerableUntilRef.current

      if (hitHazard && !isInvulnerable) {
        next.lives -= 1
        invulnerableUntilRef.current = now + INVULNERABLE_MS
      }

      next.invulnerable = now < invulnerableUntilRef.current
      next.timeRemaining = Math.max(
        0,
        ROUND_SECONDS - (now - roundStartedAt) / 1000,
      )

      worldRef.current = next
      setWorld(next)

      if (next.timeRemaining <= 0 || next.lives <= 0) {
        endRound(next.score)
        return
      }

      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(animationFrame)
  }, [phase])

  return (
    <main className="app-shell" aria-labelledby="page-title">
      {phase === 'start' && (
        <section className="screen screen--intro">
          <p className="eyebrow">System route missing</p>
          <h1 id="page-title">404 Arcade Game</h1>
          <p className="subtitle">
            Collect lost files. Avoid the bugs. Rebuild the route.
          </p>
          <button className="primary-button" type="button" onClick={startRound}>
            Start Game
          </button>
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
              <strong>{world.lives}</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>{Math.ceil(world.timeRemaining)}</strong>
            </div>
          </header>

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

            <div
              className={`player${world.invulnerable ? ' player--safe' : ''}`}
              style={{
                left: `${(world.player.x / ARENA_WIDTH) * 100}%`,
                top: `${(world.player.y / ARENA_HEIGHT) * 100}%`,
                width: `${(PLAYER_SIZE / ARENA_WIDTH) * 100}%`,
                height: `${(PLAYER_SIZE / ARENA_HEIGHT) * 100}%`,
              }}
            />
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
              <span>Session best</span>
              <strong>{bestScore}</strong>
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
