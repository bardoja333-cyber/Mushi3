import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Loader } from '@react-three/drei'
import RhythmGame from './RhythmGame'
import Level1 from '../levels/Level1'
import { useGame } from '../context/GameContext'

// Тут створюється 3D-сцена: камера, світло і поточний рівень.
// Усе, що всередині <Canvas>, — це 3D-об'єкти (three.js).
function Game() {
  const { resetVersion } = useGame()

  return (
    <>
      <Canvas
        camera={{ position: [0, 5, 10], fov: 60 }}
        dpr={[1, 1.25]}
        gl={{ antialias: false, powerPreference: 'low-power' }}
      >
        {/* Світло */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1} />

        {/* Поки вантажиться модель рівня, Suspense чекає, а <Loader /> показує відсотки */}
        <Suspense fallback={null}>
          <Level1 key={resetVersion} />
        </Suspense>
      </Canvas>

      {/* Міні-гра з нотами (HTML поверх сцени), видно тільки в статусі 'rhythm' */}
      <RhythmGame />

      {/* Екран завантаження (drei) — рахує прогрес усіх useGLTF */}
      <Loader dataInterpolation={(percent) => `Завантаження ${percent.toFixed(0)}%`} />
    </>
  )
}

export default Game
