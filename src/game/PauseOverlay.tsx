function PauseOverlay() {
  return (
    <div className="pause-overlay" role="status" aria-live="polite">
      <strong>Paused</strong>
      <span>Press P or Space to resume</span>
      <span>Press Q to quit the round</span>
    </div>
  )
}

export default PauseOverlay
