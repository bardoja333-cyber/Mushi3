import { createContext, useCallback, useContext, useState } from 'react'

// Загальний стан гри: рівень, життя, очки, історія нот і стан рівня.
// Будь-який компонент може його отримати: const { lives, score, status } = useGame()
const GameContext = createContext(null)

export function GameProvider({ children }) {
  const [lives, setLives] = useState(3)
  const [score, setScore] = useState(0)
  const [fluteNotes, setFluteNotes] = useState([])
  // status: 'playing' | 'rhythm' (міні-гра) | 'game-over' | 'victory'
  const [status, setStatus] = useState('playing')
  const [deathReason, setDeathReason] = useState(null)
  const [enemiesDefeated, setEnemiesDefeated] = useState(false)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [resetVersion, setResetVersion] = useState(0)

  const loseLife = useCallback((reason) => {
    setDeathReason(reason)
    setLives((old) => Math.max(0, old - 1))
    setStatus('game-over')
  }, [])

  const loseLifeAndRestartLevel = useCallback((reason) => {
    const remainingLives = Math.max(0, lives - 1)
    setLives(remainingLives)
    setScore(0)
    setFluteNotes([])
    setDeathReason(reason)
    setStatus('game-over')
    setEnemiesDefeated(false)
  }, [lives])

  const addScore = useCallback((points) => {
    setScore((old) => old + points)
  }, [])

  const addFluteNote = useCallback((note) => {
    setFluteNotes((old) => [...old, note].slice(-5))
  }, [])

  const restartLevel = useCallback(() => {
    setLives(3)
    setScore(0)
    setFluteNotes([])
    setStatus('playing')
    setDeathReason(null)
    setEnemiesDefeated(false)
    setResetVersion((old) => old + 1)
  }, [])

  const resetGame = useCallback(() => {
    restartLevel()
  }, [restartLevel])

  const advanceLevel = useCallback(() => {
    setCurrentLevel((level) => Math.min(level + 1, 3))
    restartLevel()
  }, [restartLevel])

  const selectLevel = useCallback((level) => {
    setCurrentLevel(level)
    restartLevel()
  }, [restartLevel])

  return (
    <GameContext.Provider
      value={{
        lives,
        score,
        fluteNotes,
        status,
        deathReason,
        enemiesDefeated,
        currentLevel,
        resetVersion,
        loseLife,
        loseLifeAndRestartLevel,
        addScore,
        addFluteNote,
        resetGame,
        restartLevel,
        advanceLevel,
        selectLevel,
        setStatus,
        setEnemiesDefeated,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame() {
  return useContext(GameContext)
}
