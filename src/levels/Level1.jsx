import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import { Box3, Matrix4, Vector3 } from 'three'
import Player from '../components/Player'
import CameraFollow from '../components/CameraFollow'
import { useGame } from '../context/GameContext'

// Починаємо вантажити важку модель рівня ще в лобі, щоб старт гри був швидшим
useGLTF.preload('/level1.glb')

// Меші моделі, по яких НЕ можна ходити (великі плоскі "квадрати" в моделі)
// Увага: three.js прибирає крапки з імен, тому 'Plane.001' з Blender тут це 'Plane001'
const NO_COLLISION = ['Plane001', 'Plane004']

// Якщо гравець упав нижче цієї висоти (річка) — рівень починається заново
const FALL_LIMIT_Y = -0.35
const LEVEL_SCALE = 0.025
const LEVEL_POSITION = [7, 0, 0]
const LOG_PLATFORM_MARGIN = 0.75

const ENEMY_TRIGGER_DISTANCE = 1.5

// Тимчасові вороги (кубики), які зникають після міні-гри
// TODO: (я) замінити на моделі вовків і розставити як потрібно
const ENEMY_POSITIONS = [
  [1.8, 0.5, 1],
  [2.5, 0.5, 1.2],
  [3.2, 0.5, 1],
]

// Ворог-кубик: коли ворогів переможено, він зменшується і зникає
function EnemyBox({ position, defeated }) {
  const meshRef = useRef(null)

  useFrame((_, delta) => {
    if (!defeated || !meshRef.current) return

    const nextScale = Math.max(0, meshRef.current.scale.x - delta * 1.5)
    meshRef.current.scale.setScalar(nextScale)
    meshRef.current.rotation.y += delta * 8
    meshRef.current.visible = nextScale > 0
  })

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshStandardMaterial color="purple" />
    </mesh>
  )
}

// Перший рівень: лісова стежка та фініш.
// TODO: (я) розширити сценарій на другий і третій рівні з новими механіками і локаціями
function Level1() {
  const level = useGLTF('/level1.glb')
  const playerRef = useRef()
  const cameraYawRef = useRef(-0.55)
  const enemyEncounterActive = useRef(false)
  const { setStatus, status, enemiesDefeated, resetGame } = useGame()
  const finishPosition = [2.5, 0.5, 2]

  // Для землі й каменів переходу використовуємо їхню геометрію, а воду виключаємо.
  const { groundMeshes, wallMeshes, cameraMeshes, logPlatforms } = useMemo(() => {
    const ground = []
    const walls = []
    const platforms = []
    level.scene.updateMatrixWorld(true)
    const modelMatrixInverse = new Matrix4().copy(level.scene.matrixWorld).invert()

    level.scene.traverse((object) => {
      if (!object.isMesh) return

      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const isRock = materials.some((material) =>
        ['rock1', 'rock2'].includes(material?.name),
      )
      const isRiverLog = materials.some((material) => material?.name === 'wood.007')
      const isWalkableSurface =
        object.name.startsWith('Plane') && !NO_COLLISION.includes(object.name)

      if (isRock || isWalkableSurface) ground.push(object)
      if (object.name.startsWith('Cube') || object.name.startsWith('Cylinder')) {
        walls.push(object)
      }

      if (isRiverLog) {
        const bounds = new Box3()
          .setFromObject(object)
          .applyMatrix4(modelMatrixInverse)
        const center = bounds.getCenter(new Vector3())
        const size = bounds.getSize(new Vector3())
        const platformSide = Math.max(size.x, size.z) * LEVEL_SCALE + LOG_PLATFORM_MARGIN
        platforms.push({
          position: [
            center.x * LEVEL_SCALE + LEVEL_POSITION[0],
            center.y * LEVEL_SCALE + LEVEL_POSITION[1],
            center.z * LEVEL_SCALE + LEVEL_POSITION[2],
          ],
          size: [
            platformSide,
            size.y * LEVEL_SCALE,
            platformSide,
          ],
        })
      }
    })

    return {
      groundMeshes: ground,
      wallMeshes: walls,
      cameraMeshes: [...new Set([...ground, ...walls])],
      logPlatforms: platforms,
    }
  }, [level.scene])

  useFrame(() => {
    if (!playerRef.current) return

    const playerPosition = playerRef.current.position

    if (status !== 'playing') return

    // Упав у річку — рівень заново
    if (playerPosition.y < FALL_LIMIT_Y) {
      resetGame()
      return
    }

    // Наблизився до ворога — запускаємо міні-гру
    const nearEnemy = ENEMY_POSITIONS.some(([enemyX, , enemyZ]) => {
      const distanceX = playerPosition.x - enemyX
      const distanceZ = playerPosition.z - enemyZ
      return distanceX * distanceX + distanceZ * distanceZ < ENEMY_TRIGGER_DISTANCE ** 2
    })

    if (!nearEnemy) enemyEncounterActive.current = false

    if (!enemiesDefeated && nearEnemy && !enemyEncounterActive.current) {
      enemyEncounterActive.current = true
      setStatus('rhythm')
      return
    }

    // Фініш рахується тільки після того, як вороги переможені
    const victoryReached =
      enemiesDefeated &&
      playerPosition.x > finishPosition[0] - 1 &&
      playerPosition.z > finishPosition[2] - 1.5 &&
      playerPosition.z < finishPosition[2] + 1.5

    if (victoryReached) {
      setStatus('victory')
    }
  })

  return (
    <>
      <primitive object={level.scene} position={LEVEL_POSITION} scale={LEVEL_SCALE} />

      {ENEMY_POSITIONS.map((position, index) => (
        <EnemyBox key={index} position={position} defeated={enemiesDefeated} />
      ))}

      <mesh position={finishPosition}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={0.5} />
      </mesh>

      <Player
        ref={playerRef}
        platforms={logPlatforms}
        groundMeshes={groundMeshes}
        wallMeshes={wallMeshes}
        cameraYawRef={cameraYawRef}
      />

      {/* Під час міні-гри (status 'rhythm') камера наближається до обличчя Муші */}
      <CameraFollow
        targetRef={playerRef}
        cameraYawRef={cameraYawRef}
        collisionMeshes={cameraMeshes}
        closeUp={status === 'rhythm'}
      />
    </>
  )
}

export default Level1
