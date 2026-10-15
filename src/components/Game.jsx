import { Suspense, useEffect, useMemo } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Environment, Loader } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { EquirectangularReflectionMapping, SRGBColorSpace, TextureLoader } from 'three'
import RhythmGame from './RhythmGame'
import Level1 from '../levels/Level1'
import Level2 from '../levels/Level2'
import Level3 from '../levels/Level3'
import { useGame } from '../context/GameContext'

function startDesertAmbience(audio) {
  audio.volume = 0.8
  if (audio.paused) {
    audio.play().catch((error) => {
      console.error('Could not play the desert ambience:', error)
    })
  }
}

function stopDesertAmbience(audio) {
  audio.pause()
  audio.currentTime = 0
}

function startLavaAmbience(audio) {
  audio.volume = 0.3
  if (audio.paused) {
    audio.play().catch((error) => {
      console.error('Could not play the lava ambience:', error)
    })
  }
}

function stopLavaAmbience(audio) {
  audio.pause()
  audio.currentTime = 0
}

function Level3Environment() {
  const skyTexture = useLoader(TextureLoader, '/level3-sky.png')
  const environmentTexture = useMemo(() => {
    const texture = skyTexture.clone()
    texture.mapping = EquirectangularReflectionMapping
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }, [skyTexture])

  useEffect(() => () => environmentTexture.dispose(), [environmentTexture])

  return <Environment map={environmentTexture} background />
}

function SignalLevelReady() {
  useEffect(() => {
    let secondFrame
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        window.dispatchEvent(new Event('mushi:level-ready'))
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame) cancelAnimationFrame(secondFrame)
    }
  }, [])

  return null
}

// Тут створюється 3D-сцена: камера, світло і поточний рівень.
// Усе, що всередині <Canvas>, — це 3D-об'єкти (three.js).
function Game({ fightMusicRef, forestAmbienceRef, desertAmbienceRef, lavaAmbienceRef }) {
  const { resetVersion, currentLevel, status } = useGame()

  useEffect(() => {
    const ambience = forestAmbienceRef?.current
    if (!ambience) return

    if (currentLevel === 1 && (status === 'playing' || status === 'rhythm')) {
      if (ambience.paused) {
        ambience.play().catch((error) => {
          console.error('Could not play the forest ambience:', error)
        })
      }
      return
    }

    ambience.pause()
  }, [currentLevel, forestAmbienceRef, status])

  useEffect(() => {
    const ambience = desertAmbienceRef?.current
    if (!ambience) return

    if (currentLevel === 2 && (status === 'playing' || status === 'rhythm')) {
      startDesertAmbience(ambience)
      return
    }

    stopDesertAmbience(ambience)
  }, [currentLevel, desertAmbienceRef, status])

  useEffect(() => {
    const ambience = lavaAmbienceRef?.current
    if (!ambience) return

    if (currentLevel === 3 && (status === 'playing' || status === 'rhythm')) {
      startLavaAmbience(ambience)
      return
    }

    stopLavaAmbience(ambience)
  }, [currentLevel, lavaAmbienceRef, status])

  return (
    <>
      <Canvas
        camera={{ position: [0, 5, 10], fov: 60 }}
        dpr={[0.75, 1]}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        shadows="variance"
      >
        <Physics colliders={false} gravity={[0, -9.81, 0]}>
          {/* Світло */}
          <ambientLight intensity={currentLevel === 3 ? 0.12 : 0.45} />
          <directionalLight
            position={[5, 10, 5]}
            intensity={currentLevel === 3 ? 0.4 : 1.4}
            castShadow
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
            shadow-camera-near={0.5}
            shadow-camera-far={32}
            shadow-camera-left={-12}
            shadow-camera-right={12}
            shadow-camera-top={12}
            shadow-camera-bottom={-12}
            shadow-bias={0.0001}
            shadow-normalBias={0.02}
            shadow-radius={3}
          />

          {/* Поки вантажиться модель рівня, Suspense чекає, а <Loader /> показує відсотки */}
          <Suspense fallback={null}>
            {currentLevel === 1 && <Level1 resetVersion={resetVersion} />}
            {currentLevel === 2 && <Level2 resetVersion={resetVersion} />}
            {currentLevel === 3 && (
              <>
                <Level3Environment />
                <Level3 resetVersion={resetVersion} />
              </>
            )}
            <SignalLevelReady />
          </Suspense>
        </Physics>

        <EffectComposer multisampling={0}>
          <Bloom intensity={0.22} luminanceThreshold={1.15} mipmapBlur />
        </EffectComposer>
      </Canvas>

      {/* Міні-гра з нотами (HTML поверх сцени), видно тільки в статусі 'rhythm' */}
      <RhythmGame fightMusicRef={fightMusicRef} />

      {/* Екран завантаження (drei) — рахує прогрес усіх useGLTF */}
      <Loader dataInterpolation={(percent) => `Завантаження ${percent.toFixed(0)}%`} />
    </>
  )
}

export default Game
