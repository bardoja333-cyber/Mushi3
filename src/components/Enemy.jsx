import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { useGame } from '../context/GameContext'

// Ворог рухається по ділянці і перемагається правильною мелодією.
// TODO: (я) додати складніші мелодії, пошкодження за помилки і різні типи ворогів
function Enemy({ position = [3, 1, 0], melody = ['do', 're', 'mi'], playerRef, onDefeat }) {
  const { fluteNotes, loseLife, status, currentLevel } = useGame()
  const meshRef = useRef(null)
  const basePosition = useRef([...position])
  // Випадкове зміщення рахуємо один раз (useState із функцією), а не при кожному рендері
  const [offset] = useState(() => Math.random() * Math.PI * 2)
  const cooldown = useRef(0)
  const [isDefeated, setIsDefeated] = useState(false)

  useFrame((state, delta) => {
    if (!meshRef.current || isDefeated || status !== 'playing') return

    const elapsed = state.clock.elapsedTime
    const swayX = Math.sin(elapsed * 1.5 + offset) * 1.1
    const swayZ = Math.cos(elapsed * 1.6 + offset) * 0.8

    meshRef.current.position.x = basePosition.current[0] + swayX
    meshRef.current.position.z = basePosition.current[2] + swayZ

    if (!playerRef?.current) return

    const playerPosition = playerRef.current.position
    const distance = Math.hypot(
      playerPosition.x - meshRef.current.position.x,
      playerPosition.z - meshRef.current.position.z,
    )

    if (distance < 1.1) {
      const melodyMatch =
        fluteNotes.length >= melody.length &&
        fluteNotes.slice(-melody.length).every((note, index) => note === melody[index])

      if (melodyMatch) {
        setIsDefeated(true)
        onDefeat?.()
        return
      }

      cooldown.current -= delta
      if (cooldown.current <= 0) {
        loseLife(currentLevel === 2 ? 'fight-level-2' : 'fight-level-1')
        cooldown.current = 1.2
      }
    }
  })

  if (isDefeated) return null

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="purple" />
    </mesh>
  )
}

export default Enemy
