import { useEffect, useRef, useState } from 'react'
import './Lobby.css'

function Lobby({ onStart }) {
  const [page, setPage] = useState('menu')
  const [isLobbyReady, setIsLobbyReady] = useState(false)
  const musicRef = useRef(null)

  useEffect(() => {
    const music = musicRef.current
    if (!music) return

    music.volume = 0.35
    music.play().catch(() => {})
  }, [])

  const handleButtonClick = (action) => {
    const clickSound = new Audio('/mixkit-gate-latch-click-1924.wav')
    clickSound.volume = 0.7
    clickSound.play().catch(() => {})

    if (musicRef.current?.paused) {
      musicRef.current.play().catch(() => {})
    }

    action()
  }

  const handleExit = () => {
    const clickSound = new Audio('/mixkit-gate-latch-click-1924.wav')
    clickSound.volume = 0.7

    const exitGame = () => {
      musicRef.current?.pause()
      window.close()
      window.setTimeout(() => {
        if (!window.closed) window.location.replace('about:blank')
      }, 100)
    }

    clickSound.addEventListener('ended', exitGame, { once: true })
    clickSound.addEventListener('error', exitGame, { once: true })
    clickSound.play().catch(exitGame)
  }

  return (
    <main className="lobby">
      <video
        className="lobby-background-video"
        src="/lobbyvideoloop.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setIsLobbyReady(true)}
        onError={() => setIsLobbyReady(true)}
        aria-hidden="true"
      />
      <div className="lobby-video-shade" aria-hidden="true" />
      <div
        className={`lobby-intro-cover${isLobbyReady ? ' lobby-intro-cover--revealing' : ''}`}
        aria-hidden="true"
      />
      <audio ref={musicRef} src="/Lobby_lobby.mp3" loop preload="auto" />

      {page === 'credits' ? (
        <button
          className="lobby-credits-image"
          type="button"
          onClick={() => handleButtonClick(() => setPage('menu'))}
          aria-label="Back to Menu"
        >
          <img src="/credits.png" alt="" draggable="false" />
        </button>
      ) : (
        <div className="lobby-screen">
          <nav className="lobby-menu" aria-label="Main Menu">
            <button
              className="lobby-action-button lobby-button-start"
              type="button"
              onClick={() => handleButtonClick(onStart)}
              aria-label="Start Game"
            >
              <img src="/startbutton.png" alt="" draggable="false" />
            </button>
            <button
              className="lobby-action-button lobby-button-credits"
              type="button"
              onClick={() => handleButtonClick(() => setPage('credits'))}
              aria-label="Credits"
            >
              <img src="/creditsbutton.png" alt="" draggable="false" />
            </button>
            <button
              className="lobby-action-button lobby-button-exit"
              type="button"
              onClick={handleExit}
              aria-label="Exit Game"
            >
              <img src="/exitbutton.png" alt="" draggable="false" />
            </button>
          </nav>
        </div>
      )}
    </main>
  )
}

export default Lobby
