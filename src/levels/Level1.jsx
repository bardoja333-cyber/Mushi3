import { useFrame } from '@react-three/fiber'
import { Environment, useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import Player from '../components/Player'
import CameraFollow from '../components/CameraFollow'
import { useGame } from '../context/GameContext'

// Починаємо вантажити важку модель рівня ще в лобі, щоб старт гри був швидшим
useGLTF.preload('/level1.glb')

// Меші моделі, по яких НЕ можна ходити (великі плоскі "квадрати" в моделі)
// Увага: three.js прибирає крапки з імен, тому 'Plane.001' з Blender тут це 'Plane001'
const NO_COLLISION = ['Plane001', 'Plane004']
const NON_COLLIDING_MATERIALS = new Set([
  'Material.001',
  'Material.002',
  'Material.003',
  'Material.004',
  'Material.005',
  'Material.006',
  'Material.007',
  'Material.008',
].map((name) => name.replaceAll('.', '')))

// Якщо гравець упав нижче цієї висоти (річка) — рівень починається заново
const FALL_LIMIT_Y = -0.35
const LEVEL_SCALE = 0.025
const LEVEL_POSITION = [7, 0, 0]
const RIVER_LOG_MATERIALS = new Set(['wood.007', 'Material.022'])
const RIVER_LOG_LOWERING = 1.2
const RIVER_LOG_CORE_LIFT = 1.2

const FIGHT_TRIGGER_ANGLE = 1.38
const FIGHT_TRIGGER_POSITION = [4.77, 0, 2.35]
const FIGHT_TRIGGER_ROTATION = [0, FIGHT_TRIGGER_ANGLE, 0]
const FIGHT_TRIGGER_HALF_LENGTH = 1.1
const FIGHT_TRIGGER_FORWARD = [Math.sin(FIGHT_TRIGGER_ANGLE), Math.cos(FIGHT_TRIGGER_ANGLE)]
const FIGHT_TRIGGER_SIDE = [Math.cos(FIGHT_TRIGGER_ANGLE), -Math.sin(FIGHT_TRIGGER_ANGLE)]
const WATER_SPLASH_PATHS = ['/water-splash-1.wav', '/water-splash-2.wav']
const waterSplashSounds = WATER_SPLASH_PATHS.map((path) => {
  const audio = new Audio(path)
  audio.volume = 0.45
  return audio
})

function playWaterSplash() {
  const sound = waterSplashSounds[Math.floor(Math.random() * waterSplashSounds.length)]
  sound.currentTime = 0
  sound.play().catch((error) => {
    console.error('Could not play the water splash sound:', error)
  })
}

// Перший рівень: лісова стежка та фініш.
// TODO: (я) розширити сценарій на другий і третій рівні з новими механіками і локаціями
function Level1({ resetVersion }) {
  const level = useGLTF('/level1.glb')
  const playerRef = useRef()
  const playerWorldPosition = useRef(new Vector3())
  const fightTriggeredRef = useRef(false)
  const riverDeathTriggeredRef = useRef(false)
  const levelAdvanceTriggeredRef = useRef(false)
  const cameraYawRef = useRef(-0.55)
  const { setStatus, status, enemiesDefeated, loseLifeAndRestartLevel, advanceLevel } = useGame()
  const finishPosition = [2.5, 0.5, 2]

  useEffect(() => {
    fightTriggeredRef.current = false
    riverDeathTriggeredRef.current = false
    levelAdvanceTriggeredRef.current = false
    cameraYawRef.current = -0.55
  }, [resetVersion])

  const displayScene = useMemo(() => {
    const scene = level.scene.clone(true)

    scene.traverse((object) => {
      if (!object.isMesh) return

      const materials = Array.isArray(object.material) ? object.material : [object.material]

      if (materials.some((material) => RIVER_LOG_MATERIALS.has(material?.name))) {
        object.position.y -= RIVER_LOG_LOWERING
        if (materials.some((material) => material?.name === 'Material.022')) {
          object.position.y += RIVER_LOG_CORE_LIFT
        }
      }
    })

    return scene
  }, [level.scene])

  const collisionScene = useMemo(() => {
    const scene = displayScene.clone(true)
    const excludedMeshes = []
    scene.updateMatrixWorld(true)

    scene.traverse((object) => {
      if (!object.isMesh) return

      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const isRock = materials.some((material) =>
        ['rock1', 'rock2'].includes(material?.name),
      )
      const isWalkableSurface =
        object.name.startsWith('Plane') && !NO_COLLISION.includes(object.name)
      const isFoliage =
        object.name.startsWith('Sphere') ||
        object.name.startsWith('Cone') ||
        materials.some((material) =>
          NON_COLLIDING_MATERIALS.has(material?.name?.replaceAll('.', '')),
        )
      const isObstacle =
        !isFoliage &&
        (object.name.startsWith('Cube') || object.name.startsWith('Cylinder'))

      let parent = object
      let isVisible = true
      while (parent) {
        if (!parent.visible) {
          isVisible = false
          break
        }
        parent = parent.parent
      }

      if (
        !isVisible ||
        NO_COLLISION.includes(object.name) ||
        isFoliage ||
        (!isRock && !isWalkableSurface && !isObstacle)
      ) {
        excludedMeshes.push(object)
      }
    })

    excludedMeshes.forEach((object) => object.removeFromParent())
    return scene
  }, [displayScene])

  // Camera collision meshes keep the camera from clipping into large level geometry.
  const { cameraMeshes } = useMemo(() => {
    const ground = []
    const walls = []
    displayScene.updateMatrixWorld(true)

    displayScene.traverse((object) => {
      if (!object.isMesh) return

      object.castShadow = true
      object.receiveShadow = true

      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const isRock = materials.some((material) =>
        ['rock1', 'rock2'].includes(material?.name),
      )
      const isWalkableSurface =
        object.name.startsWith('Plane') && !NO_COLLISION.includes(object.name)

      if (isRock || isWalkableSurface) ground.push(object)
      if (isRock || object.name.startsWith('Cube') || object.name.startsWith('Cylinder')) {
        walls.push(object)
      }
    })

    return {
      cameraMeshes: [...new Set([...ground, ...walls])],
    }
  }, [displayScene])

  useFrame(() => {
    if (!playerRef.current) return

    const playerPosition = playerRef.current.getWorldPosition(playerWorldPosition.current)

    if (status === 'playing' && !enemiesDefeated && !fightTriggeredRef.current) {
      const sideDistance =
        (playerPosition.x - FIGHT_TRIGGER_POSITION[0]) * FIGHT_TRIGGER_SIDE[0] +
        (playerPosition.z - FIGHT_TRIGGER_POSITION[2]) * FIGHT_TRIGGER_SIDE[1]
      const forwardDistance =
        (playerPosition.x - FIGHT_TRIGGER_POSITION[0]) * FIGHT_TRIGGER_FORWARD[0] +
        (playerPosition.z - FIGHT_TRIGGER_POSITION[2]) * FIGHT_TRIGGER_FORWARD[1]
      const touchedFightTrigger =
        Math.abs(forwardDistance) <= 0.2 &&
        Math.abs(sideDistance) <= FIGHT_TRIGGER_HALF_LENGTH + 0.25

      if (touchedFightTrigger) {
        fightTriggeredRef.current = true
        window.dispatchEvent(new Event('mushi:fight-tutorial'))
        setStatus('rhythm')
      }
    }

    const isActive = status === 'playing' || status === 'rhythm'
    if (isActive && !riverDeathTriggeredRef.current && playerPosition.y < FALL_LIMIT_Y) {
      riverDeathTriggeredRef.current = true
      playWaterSplash()
      loseLifeAndRestartLevel('river')
      return
    }

    if (status !== 'playing') return

    // Фініш рахується тільки після того, як вороги переможені
    const victoryReached =
      enemiesDefeated &&
      playerPosition.x > finishPosition[0] - 1 &&
      playerPosition.z > finishPosition[2] - 1.5 &&
      playerPosition.z < finishPosition[2] + 1.5

    if (victoryReached && !levelAdvanceTriggeredRef.current) {
      levelAdvanceTriggeredRef.current = true
      advanceLevel()
    }
  })

  return (
    <>
      <Environment files="/level1sky.hdr" background />
      <fog attach="fog" args={['#8c9a8b', 14, 42]} />

      <primitive object={displayScene} position={LEVEL_POSITION} scale={LEVEL_SCALE} />

      <RigidBody type="fixed" colliders="trimesh" includeInvisible>
        <primitive
          object={collisionScene}
          position={LEVEL_POSITION}
          scale={LEVEL_SCALE}
          visible={false}
        />
      </RigidBody>

      <group
        position={FIGHT_TRIGGER_POSITION}
        rotation={FIGHT_TRIGGER_ROTATION}
        visible={false}
      >
        <mesh position={[0, 0.02, 0]} renderOrder={1}>
          <boxGeometry args={[FIGHT_TRIGGER_HALF_LENGTH * 2, 0.24, 0.08]} />
          <meshBasicMaterial
            color="#008cff"
            transparent
            opacity={0.4}
            depthTest
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      <Player
        key={`player-${resetVersion}`}
        ref={playerRef}
        cameraYawRef={cameraYawRef}
      />

      {/* Під час міні-гри (status 'rhythm') камера наближається до обличчя Муші */}
      <CameraFollow
        targetRef={playerRef}
        cameraYawRef={cameraYawRef}
        collisionMeshes={cameraMeshes}
        combatView={status === 'rhythm'}
      />
    </>
  )
}

export default Level1
