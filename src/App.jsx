import { useEffect, useRef, useState } from 'react'
import Game from './components/Game'
import Hud from './components/Hud'
import Lobby from './components/Lobby'
import { GameProvider } from './context/GameContext'

function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [tutorialImage, setTutorialImage] = useState(null)
  const fightMusicRef = useRef(null)
  const forestAmbienceRef = useRef(null)
  const desertAmbienceRef = useRef(null)
  const lavaAmbienceRef = useRef(null)

  const startGame = () => {
    const forestAmbience = forestAmbienceRef.current
    if (forestAmbience) {
      forestAmbience.volume = 0.35
      forestAmbience.play().catch((error) => {
        console.error('Could not play the forest ambience:', error)
      })
    }

    const fightMusic = fightMusicRef.current
    if (fightMusic) {
      const originalVolume = fightMusic.volume
      fightMusic.volume = 0
      fightMusic.play().then(() => {
        fightMusic.pause()
        fightMusic.currentTime = 0
        fightMusic.volume = originalVolume
      }).catch(() => {
        fightMusic.volume = originalVolume
      })
    }

    setIsPlaying(true)
  }

  useEffect(() => {
    const handleLevelReady = () => setTutorialImage('/tutorialmove.png')
    const handleFightTutorial = () => setTutorialImage('/tutorialfight.png')
    window.addEventListener('mushi:level-ready', handleLevelReady)
    window.addEventListener('mushi:fight-tutorial', handleFightTutorial)

    return () => {
      window.removeEventListener('mushi:level-ready', handleLevelReady)
      window.removeEventListener('mushi:fight-tutorial', handleFightTutorial)
    }
  }, [])

  useEffect(() => {
    if (!tutorialImage) return

    const timeout = window.setTimeout(() => setTutorialImage(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [tutorialImage])

  return (
    <GameProvider>
      <audio ref={fightMusicRef} src="/level1-fight.mp3" preload="auto" />
      <audio ref={forestAmbienceRef} src="/forest-ambience.wav" preload="auto" loop />
      <audio ref={desertAmbienceRef} src="/desert-ambience.wav" preload="auto" loop />
      <audio ref={lavaAmbienceRef} src="/lava-loop.mp3" preload="auto" loop />
      {isPlaying ? (
        <>
          <Game
            fightMusicRef={fightMusicRef}
            forestAmbienceRef={forestAmbienceRef}
            desertAmbienceRef={desertAmbienceRef}
            lavaAmbienceRef={lavaAmbienceRef}
          />
          <Hud />
          {tutorialImage && (
            <div className="level-tutorial" aria-hidden="true">
              <img src={tutorialImage} alt="" draggable="false" />
            </div>
          )}
        </>
      ) : (
        <Lobby onStart={startGame} />
      )}
    </GameProvider>
  )
}

export default App
