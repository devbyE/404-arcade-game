export type Phase = 'start' | 'playing' | 'gameOver'

export type Theme = 'dark' | 'light'

export type Point = {
  x: number
  y: number
}

export type Fragment = Point & {
  id: number
}

export type Hazard = Point & {
  id: number
  vx: number
  vy: number
}

export type HitFeedback = Point & {
  id: number
  text: string
  expiresAt: number
}

export type World = {
  player: Point
  fragments: Fragment[]
  hazards: Hazard[]
  score: number
  lives: number
  timeRemaining: number
  invulnerable: boolean
  hitFeedback: HitFeedback | null
}

export type SavedStats = {
  bestScore: number
  highestLevel: number
  gamesPlayed: number
}
