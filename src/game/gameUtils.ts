import type { Fragment, Hazard, Point, SavedStats, World } from './types'

export const ARENA_WIDTH = 900
export const ARENA_HEIGHT = 540
export const PLAYER_SIZE = 28
export const FRAGMENT_SIZE = 42
export const HAZARD_SIZE = 38
export const ROUND_SECONDS = 90
export const STARTING_LIVES = 3
export const PLAYER_SPEED = 320
export const INVULNERABLE_MS = 1400
export const HIT_FEEDBACK_MS = 850

const STORAGE_KEY = '404-arcade-progress'

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const randomPoint = (size: number): Point => ({
  x: Math.random() * (ARENA_WIDTH - size),
  y: Math.random() * (ARENA_HEIGHT - size),
})

export const isTouching = (a: Point, aSize: number, b: Point, bSize: number) =>
  a.x < b.x + bSize &&
  a.x + aSize > b.x &&
  a.y < b.y + bSize &&
  a.y + aSize > b.y

export const getLevel = (score: number) => Math.min(Math.floor(score / 50) + 1, 5)

export const getHitPenalty = (level: number) => level + 1

export const getHazardSpeedMultiplier = (level: number) => 1 + (level - 1) * 0.14

export const loadSavedStats = (): SavedStats => {
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

export const saveStats = (stats: SavedStats) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
}

export const createFragments = (): Fragment[] =>
  Array.from({ length: 7 }, (_, id) => ({
    id,
    ...randomPoint(FRAGMENT_SIZE),
  }))

export const createHazards = (): Hazard[] =>
  Array.from({ length: 5 }, (_, id) => {
    const direction = id % 2 === 0 ? 1 : -1

    return {
      id,
      ...randomPoint(HAZARD_SIZE),
      vx: direction * (42 + id * 8),
      vy: -direction * (34 + id * 6),
    }
  })

export const createWorld = (): World => ({
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

export const toArenaPercent = (value: number, total: number) => `${(value / total) * 100}%`
