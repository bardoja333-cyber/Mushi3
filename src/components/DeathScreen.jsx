import { useEffect } from 'react'
import { useGame } from '../context/GameContext'
import './DeathScreen.css'

const LAVA_FALL_SOUND_DURATION = 1400

const DEATH_SCREEN_IMAGES = {
  pit: '/gameover-fall.png',
  lava: '/gameover-fight-level-2.png',
  river: '/gameover-river.png',
  'fight-level-1': '/gameover-fight-level-1.png',
  'fight-level-2': '/gameover-fight-level-2.png',
}

function DeathScreen() {
  const { deathReason, resetGame } = useGame()
  const image = DEATH_SCREEN_IMAGES[deathReason]

  useEffect(() => {
    let isUnmounted = false
    let deathSoundStarted = false
    const deathSound = new Audio('/death-explosion.mp3')
    deathSound.volume = 0.7
    const playDeathSound = () => {
      if (isUnmounted || deathSoundStarted) return
      deathSoundStarted = true
      deathSound.play().catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Could not play the death sound:', error)
        }
      })
    }
    let lavaFallSound
    let lavaSoundTimeout

    if (deathReason === 'lava') {
      lavaFallSound = new Audio('/lava-loop.mp3')
      lavaFallSound.loop = false
      lavaFallSound.volume = 0.7
      lavaFallSound.addEventListener('ended', playDeathSound, { once: true })
      lavaFallSound.addEventListener('error', playDeathSound, { once: true })
      lavaFallSound.play().catch((error) => {
        if (isUnmounted || error.name === 'AbortError') return
        console.error('Could not play the lava fall sound:', error)
        playDeathSound()
      })
      lavaSoundTimeout = window.setTimeout(() => {
        lavaFallSound.pause()
        playDeathSound()
      }, LAVA_FALL_SOUND_DURATION)
    } else {
      playDeathSound()
    }

    return () => {
      isUnmounted = true
      window.clearTimeout(lavaSoundTimeout)
      if (lavaFallSound) {
        lavaFallSound.pause()
        lavaFallSound.currentTime = 0
      }
      deathSound.pause()
      deathSound.currentTime = 0
    }
  }, [deathReason])

  const restart = () => {
    const clickSound = new Audio('/mixkit-gate-latch-click-1924.wav')
    clickSound.volume = 0.7
    clickSound.play().catch((error) => {
      console.error('Could not play the button click sound:', error)
    })
    resetGame()
  }

  if (!image) {
    throw new Error(`Missing game-over screen for death reason "${deathReason}"`)
  }

  return (
    <main className="death-screen" aria-label="Кінець гри">
      <img className="death-screen-background" src={image} alt="" />
      <button className="death-screen-restart" type="button" onClick={restart} aria-label="Почати знову">
        <img src="/start-again.png" alt="" draggable="false" />
      </button>
    </main>
  )
}

export default DeathScreen
