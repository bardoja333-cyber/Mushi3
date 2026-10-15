import { useFrame } from '@react-three/fiber'
import { Environment, useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { Float32BufferAttribute, Vector3 } from 'three'
import Player from '../components/Player'
import CameraFollow from '../components/CameraFollow'
import { useGame } from '../context/GameContext'

useGLTF.preload('/level2.glb')

const LEVEL_SCALE = 0.005
const START_POSITION = [3.0187, 0.0184, 7.2066]
const START_ROTATION = 3.2162
const START_CAMERA_YAW = 0.3098
const FIGHT_TRIGGER_POSITION = [-4.5829, 0, -2.257]
const FIGHT_TRIGGER_ROTATION = 4.7789
const FIGHT_TRIGGER_HALF_LENGTH = 3.5
const PIT_PLATFORM_BOUNDS = {
  minX: -2.82,
  maxX: 2.34,
  minZ: -3.88,
  maxZ: 1.29,
}
const PIT_DEATH_HEIGHT = -0.48
const PIT_MARKER_POSITION = [-0.24, -0.59, -1.295]
const PIT_MARKER_SIZE = [5.16, 0.04, 5.16]
const PLAYER_MODEL_SCALE = 0.02625
const PLAYER_MOVEMENT_SPEED = 0.701700181875 * 1.3
const PLAYER_MODEL_OFFSET_Y = -0.02
// Falls into the canyon pit trigger a life loss and respawn at the level start.
const FALL_LIMIT_Y = -1.5
const GROUND_MATERIALS = new Set(['rock1', 'rock2'])
const NON_COLLIDING_FOLIAGE_MATERIALS = new Set([
  'bush',
  'Material.015',
  'pine',
  'pine.001',
])

function Level2({ resetVersion }) {
  const level = useGLTF('/level2.glb')
  const playerRef = useRef()
  const playerWorldPosition = useRef(new Vector3())
  const fightTriggeredRef = useRef(false)
  const pitDeathTriggeredRef = useRef(false)
  const levelAdvanceTriggeredRef = useRef(false)
  const cameraYawRef = useRef(START_CAMERA_YAW)
  const { setStatus, status, loseLifeAndRestartLevel, advanceLevel } = useGame()

  useEffect(() => {
    fightTriggeredRef.current = false
    pitDeathTriggeredRef.current = false
    levelAdvanceTriggeredRef.current = false
    cameraYawRef.current = START_CAMERA_YAW
  }, [resetVersion])

  const displayScene = useMemo(() => {
    const scene = level.scene.clone(true)
    scene.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
    return scene
  }, [level.scene])

  // TODO: (я) перевір, які ще декорації мають пропускати гравця.
  const collisionScene = useMemo(() => {
    const scene = displayScene.clone(true)
    const excludedMeshes = []

    scene.traverse((object) => {
      if (!object.isMesh) return

      const materials = Array.isArray(object.material) ? object.material : [object.material]
      if (materials.some((material) => NON_COLLIDING_FOLIAGE_MATERIALS.has(material.name))) {
        excludedMeshes.push(object)
        return
      }

      const geometry = object.geometry.clone()
      const position = geometry.getAttribute('position')
      if (!position) {
        throw new Error(`Cannot create a level collider for "${object.name}": missing positions`)
      }

      const positions = new Float32Array(position.count * 3)

      // Rapier expects packed XYZ values; this GLB interleaves positions with normals and UVs.
      for (let index = 0; index < position.count; index += 1) {
        const offset = index * 3
        positions[offset] = position.getX(index)
        positions[offset + 1] = position.getY(index)
        positions[offset + 2] = position.getZ(index)
      }

      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      object.geometry = geometry
    })

    excludedMeshes.forEach((object) => object.removeFromParent())
    return scene
  }, [displayScene])

  const cameraMeshes = useMemo(() => {
    const meshes = []
    displayScene.updateMatrixWorld(true)

    displayScene.traverse((object) => {
      if (!object.isMesh) return

      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const isTerrain =
        object.name.startsWith('Plane') &&
        materials.some((material) => material.name?.startsWith('sand.'))
      const isRock = materials.some((material) => GROUND_MATERIALS.has(material.name))

      if (isTerrain || isRock) meshes.push(object)
    })

    return meshes
  }, [displayScene])

  useFrame(() => {
    if (!playerRef.current) return

    const playerPosition = playerRef.current.getWorldPosition(playerWorldPosition.current)

    if (status === 'playing' && !fightTriggeredRef.current) {
      const sideDistance =
        (playerPosition.x - FIGHT_TRIGGER_POSITION[0]) * Math.cos(FIGHT_TRIGGER_ROTATION) -
        (playerPosition.z - FIGHT_TRIGGER_POSITION[2]) * Math.sin(FIGHT_TRIGGER_ROTATION)
      const forwardDistance =
        (playerPosition.x - FIGHT_TRIGGER_POSITION[0]) * Math.sin(FIGHT_TRIGGER_ROTATION) +
        (playerPosition.z - FIGHT_TRIGGER_POSITION[2]) * Math.cos(FIGHT_TRIGGER_ROTATION)
      const touchedFightTrigger =
        Math.abs(forwardDistance) <= 0.2 &&
        Math.abs(sideDistance) <= FIGHT_TRIGGER_HALF_LENGTH + 0.25

      if (touchedFightTrigger) {
        fightTriggeredRef.current = true
        window.dispatchEvent(new Event('mushi:fight-tutorial'))
        setStatus('rhythm')
      }
    }

    if (status !== 'playing' && status !== 'rhythm') return
    const reachedPitDeathHeight =
      playerPosition.y < PIT_DEATH_HEIGHT &&
      playerPosition.x >= PIT_PLATFORM_BOUNDS.minX &&
      playerPosition.x <= PIT_PLATFORM_BOUNDS.maxX &&
      playerPosition.z >= PIT_PLATFORM_BOUNDS.minZ &&
      playerPosition.z <= PIT_PLATFORM_BOUNDS.maxZ

    if (reachedPitDeathHeight && !pitDeathTriggeredRef.current) {
      pitDeathTriggeredRef.current = true
      loseLifeAndRestartLevel('pit')
      return
    }

    if (status !== 'playing') return

    if (playerPosition.y < FALL_LIMIT_Y && !levelAdvanceTriggeredRef.current) {
      levelAdvanceTriggeredRef.current = true
      advanceLevel()
    }
  })

  return (
    <>
      <Environment files="/level2sky.hdr" background />
      <fog attach="fog" args={['#c7a66a', 4, 24]} />
      <ambientLight intensity={0.8} color="#f4dfbd" />
      <directionalLight position={[-4, 8, 5]} intensity={1.8} color="#ffe0a6" />

      <primitive object={displayScene} scale={LEVEL_SCALE} />

      <RigidBody type="fixed" colliders="trimesh" includeInvisible>
        <primitive object={collisionScene} scale={LEVEL_SCALE} visible={false} />
      </RigidBody>

      <group position={PIT_MARKER_POSITION} visible={false}>
        <mesh>
          <boxGeometry args={PIT_MARKER_SIZE} />
          <meshBasicMaterial
            color="#ff22dd"
            transparent
            opacity={0.45}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      <group
        position={FIGHT_TRIGGER_POSITION}
        rotation={[0, FIGHT_TRIGGER_ROTATION, 0]}
        visible={false}
      >
        <mesh position={[0, 0.02, 0]} renderOrder={10}>
          <boxGeometry args={[FIGHT_TRIGGER_HALF_LENGTH * 2, 0.16, 0.12]} />
          <meshBasicMaterial
            color="#ff22dd"
            transparent
            opacity={0.85}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      <Player
        key={`player-${resetVersion}`}
        ref={playerRef}
        cameraYawRef={cameraYawRef}
        startPosition={START_POSITION}
        startRotation={START_ROTATION}
        modelScale={PLAYER_MODEL_SCALE}
        movementSpeed={PLAYER_MOVEMENT_SPEED}
        modelOffsetY={PLAYER_MODEL_OFFSET_Y}
      />

      <CameraFollow
        targetRef={playerRef}
        cameraYawRef={cameraYawRef}
        collisionMeshes={cameraMeshes}
        minimumTargetY={0.3}
        combatView={status === 'rhythm'}
      />
    </>
  )
}

export default Level2
