import { useCallback, useEffect, useRef, useState } from 'react'
import GameOverScreen from './GameOverScreen'
import Hud from './Hud'
import PauseOverlay from './PauseOverlay'
import StartScreen from './StartScreen'
import type { Phase, Theme, World } from './types'
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  FRAGMENT_SIZE,
  HAZARD_SIZE,
  HIT_FEEDBACK_MS,
  INVULNERABLE_MS,
  PLAYER_SIZE,
  PLAYER_SPEED,
  clamp,
  createWorld,
  getHazardSpeedMultiplier,
  getHitPenalty,
  getLevel,
  isTouching,
  loadSavedStats,
  randomPoint,
  saveStats,
  toArenaPercent,
} from './gameUtils'
import '../styles/game.css'

function Game() {
  const [phase, setPhase] = useState<Phase>('start')
  const [theme, setTheme] = useState<Theme>('dark')
  const [world, setWorld] = useState<World>(() => createWorld())
  const [paused, setPaused] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [finalLevel, setFinalLevel] = useState(1)
  const [stats, setStats] = useState(() => loadSavedStats())
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

      {phase === 'start' && <StartScreen stats={stats} onStart={startRound} />}

      {phase === 'playing' && (
        <section className="game-layout" aria-label="404 Arcade play area">
          <Hud
            score={world.score}
            lives={world.lives}
            timeRemaining={world.timeRemaining}
            level={currentLevel}
          />

          <div className="arena">
            <div className="arena__grid" />

            {world.fragments.map((fragment) => (
              <div
                className="fragment"
                key={fragment.id}
                style={{
                  left: toArenaPercent(fragment.x, ARENA_WIDTH),
                  top: toArenaPercent(fragment.y, ARENA_HEIGHT),
                  width: toArenaPercent(FRAGMENT_SIZE, ARENA_WIDTH),
                  height: toArenaPercent(FRAGMENT_SIZE, ARENA_HEIGHT),
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
                  left: toArenaPercent(hazard.x, ARENA_WIDTH),
                  top: toArenaPercent(hazard.y, ARENA_HEIGHT),
                  width: toArenaPercent(HAZARD_SIZE, ARENA_WIDTH),
                  height: toArenaPercent(HAZARD_SIZE, ARENA_HEIGHT),
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
                  left: toArenaPercent(world.hitFeedback.x, ARENA_WIDTH),
                  top: toArenaPercent(world.hitFeedback.y, ARENA_HEIGHT),
                }}
              >
                {world.hitFeedback.text}
              </div>
            )}

            <div
              className={`player${world.invulnerable ? ' player--safe' : ''}`}
              style={{
                left: toArenaPercent(world.player.x, ARENA_WIDTH),
                top: toArenaPercent(world.player.y, ARENA_HEIGHT),
                width: toArenaPercent(PLAYER_SIZE, ARENA_WIDTH),
                height: toArenaPercent(PLAYER_SIZE, ARENA_HEIGHT),
              }}
            />

            {paused && <PauseOverlay />}
          </div>
        </section>
      )}

      {phase === 'gameOver' && (
        <GameOverScreen
          finalScore={finalScore}
          finalLevel={finalLevel}
          stats={stats}
          onRestart={startRound}
        />
      )}
    </main>
  )
}

export default Game
