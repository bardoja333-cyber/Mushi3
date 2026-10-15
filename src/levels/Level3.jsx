import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { Box3, Float32BufferAttribute, Raycaster, Vector3 } from 'three'
import Player from '../components/Player'
import CameraFollow from '../components/CameraFollow'
import { useGame } from '../context/GameContext'

useGLTF.preload('/level3.glb')

const LEVEL_SCALE = 0.0045
const START_ROTATION = Math.PI / 2
const START_CAMERA_YAW = -0.66
const START_CAMERA_PITCH = 0.95
const LAVA_DEATH_GAP = 0.1
const FINAL_FIGHT_PLATE_POSITION = [0.55, 1.87, -0.55]
const FINAL_FIGHT_PLATE_SIZE = [0.48, 0.24]

function Level3({ resetVersion }) {
  const level = useGLTF('/level3.glb')
  const playerRef = useRef()
  const playerPositionRef = useRef(new Vector3())
  const lavaDeathTriggeredRef = useRef(false)
  const finalFightTriggeredRef = useRef(false)
  const cameraYawRef = useRef(START_CAMERA_YAW)
  const { status, loseLifeAndRestartLevel, setStatus } = useGame()

  useEffect(() => {
    lavaDeathTriggeredRef.current = false
    finalFightTriggeredRef.current = false
  }, [resetVersion])

  const { displayScene, startPosition, lavaBounds } = useMemo(() => {
    const scene = level.scene.clone(true)
    scene.scale.setScalar(LEVEL_SCALE)
    scene.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(scene)
    const center = bounds.getCenter(new Vector3())
    scene.position.set(-center.x, -bounds.min.y, -center.z)
    scene.updateMatrixWorld(true)
    scene.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const updatedMaterials = materials.map((material) => {
        if (!material.name?.toLowerCase().includes('lava') || !material.emissive) return material
        const glowingMaterial = material.clone()
        glowingMaterial.emissive.set('#ff4a08')
        glowingMaterial.emissiveIntensity = 1.8
        return glowingMaterial
      })
      object.material = Array.isArray(object.material) ? updatedMaterials : updatedMaterials[0]
    })

    const meshes = []
    const flagMeshes = []
    scene.traverse((object) => {
      if (!object.isMesh) return
      meshes.push(object)
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      if (materials.some((material) => (
        material.color &&
        material.color.r > 0.5 &&
        material.color.r > material.color.g * 1.5 &&
        material.color.r > material.color.b * 1.5
      ))) flagMeshes.push(object)
    })
    if (!flagMeshes.length) {
      throw new Error('Cannot find the red flag for the level-three spawn point')
    }

    const lavaBounds = new Box3()
    scene.traverse((object) => {
      if (!object.isMesh) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      if (materials.some((material) => material.name?.toLowerCase() === 'lava')) {
        lavaBounds.expandByObject(object)
      }
    })
    if (lavaBounds.isEmpty()) {
      throw new Error('Cannot find the lava surface for the level-three death trigger')
    }

    const flagBounds = new Box3()
    flagMeshes.forEach((flag) => flagBounds.expandByObject(flag))
    const flagCenter = flagBounds.getCenter(new Vector3())
    const raycaster = new Raycaster()
    const rayDirection = new Vector3(0, -1, 0)
    const candidates = []
    for (const radius of [0.132, 0.192, 0.252]) {
      for (let index = 0; index < 16; index += 1) {
        const angle = index * Math.PI / 8
        const x = flagCenter.x + Math.cos(angle) * radius
        const z = flagCenter.z + Math.sin(angle) * radius
        raycaster.set(new Vector3(x, flagBounds.max.y + 0.9, z), rayDirection)
        const hit = raycaster.intersectObjects(meshes, true).find((intersection) => {
          if (!intersection.face || Math.abs(intersection.point.y - flagCenter.y) > 0.45) return false
          const normal = intersection.face.normal.clone().transformDirection(intersection.object.matrixWorld)
          return normal.y > 0.8
        })
        if (hit) {
          candidates.push({
            position: [hit.point.x, hit.point.y + 0.03, hit.point.z],
            height: hit.point.y,
            distance: Math.hypot(hit.point.x - flagCenter.x, hit.point.z - flagCenter.z),
          })
        }
      }
    }

    candidates.sort((first, second) => Math.abs(first.distance - 0.192) - Math.abs(second.distance - 0.192) || second.height - first.height)
    if (!candidates.length) {
      throw new Error('Cannot find a walkable top surface on the main stone')
    }

    return {
      displayScene: scene,
      startPosition: candidates[0].position,
      lavaBounds,
    }
  }, [level.scene])
  useFrame(() => {
    if (
      (status !== 'playing' && status !== 'rhythm') ||
      lavaDeathTriggeredRef.current ||
      !playerRef.current
    ) return

    const position = playerRef.current.getWorldPosition(playerPositionRef.current)

    if (status === 'playing' && !finalFightTriggeredRef.current) {
      const touchedFightPlate =
        Math.abs(position.x - FINAL_FIGHT_PLATE_POSITION[0]) <= FINAL_FIGHT_PLATE_SIZE[0] / 2 + 0.08 &&
        Math.abs(position.z - FINAL_FIGHT_PLATE_POSITION[2]) <= FINAL_FIGHT_PLATE_SIZE[1] / 2 + 0.08 &&
        Math.abs(position.y - FINAL_FIGHT_PLATE_POSITION[1]) <= 0.45

      if (touchedFightPlate) {
        finalFightTriggeredRef.current = true
        window.dispatchEvent(new Event('mushi:fight-tutorial'))
        setStatus('rhythm')
      }
    }

    const isOverLava =
      position.x >= lavaBounds.min.x &&
      position.x <= lavaBounds.max.x &&
      position.z >= lavaBounds.min.z &&
      position.z <= lavaBounds.max.z

    if (isOverLava && position.y < lavaBounds.min.y - LAVA_DEATH_GAP) {
      lavaDeathTriggeredRef.current = true
      loseLifeAndRestartLevel('lava')
    }
  })

  const collisionScene = useMemo(() => {
    const scene = displayScene.clone(true)
    const excludedMeshes = []

    scene.traverse((object) => {
      if (!object.isMesh) return

      const materials = Array.isArray(object.material) ? object.material : [object.material]
      if (materials.some((material) => material.name?.toLowerCase().includes('lava'))) {
        excludedMeshes.push(object)
        return
      }

      const geometry = object.geometry.clone()
      const position = geometry.getAttribute('position')
      if (!position) {
        throw new Error(`Cannot create a level collider for "${object.name}": missing positions`)
      }

      const positions = new Float32Array(position.count * 3)
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

  return (
    <>
      <fog attach="fog" args={['#35120f', 0.6, 4.5]} />
      <ambientLight intensity={0.18} color="#8e4a3b" />
      <directionalLight position={[-4, 8, 5]} intensity={0.55} color="#b74f2e" />

      <primitive object={displayScene} />

      <RigidBody type="fixed" colliders="trimesh" includeInvisible>
        <primitive object={collisionScene} visible={false} />
      </RigidBody>

      <mesh
        position={FINAL_FIGHT_PLATE_POSITION}
        renderOrder={10}
        visible={false}
      >
        <boxGeometry args={[FINAL_FIGHT_PLATE_SIZE[0], 0.08, FINAL_FIGHT_PLATE_SIZE[1]]} />
        <meshBasicMaterial
          color="#ff22dd"
          transparent
          opacity={0.85}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <Player
        key={`player-${resetVersion}`}
        ref={playerRef}
        cameraYawRef={cameraYawRef}
        startPosition={startPosition}
        startRotation={START_ROTATION}
        modelScale={0.02625}
        movementSpeed={0.701700181875 * 1.3}
      />

      <CameraFollow
        targetRef={playerRef}
        cameraYawRef={cameraYawRef}
        initialPitch={START_CAMERA_PITCH}
        combatView={status === 'rhythm'}
      />
    </>
  )
}

export default Level3
