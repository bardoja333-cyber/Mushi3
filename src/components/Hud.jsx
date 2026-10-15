import DeathScreen from './DeathScreen'
import { useGame } from '../context/GameContext'

// HUD — звичайний HTML поверх 3D-сцени.
function Hud() {
  const { lives, score, fluteNotes, status, resetGame } = useGame()

  if (status === 'game-over') return <DeathScreen />

  return (
    <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', fontSize: 24 }}>
      <div>Життя: {lives}</div>
      <div>Очки: {score}</div>
      <div>Ноти: {fluteNotes.length ? fluteNotes.join(' - ') : '—'}</div>

      {status === 'victory' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(20, 40, 20, 0.85)',
            fontSize: 32,
          }}
        >
          <div>Перемога!</div>
          <button type="button" onClick={resetGame} style={{ marginTop: 20, fontSize: 20 }}>
            Грати ще
          </button>
        </div>
      )}
    </div>
  )
}

export default Hud
