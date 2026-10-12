import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box3, MathUtils, Raycaster, Vector3 } from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useGame } from '../context/GameContext'
import useKeyboard from '../hooks/useKeyboard'
import playSound from '../audio/playNote'

const noteKeys = [
  ['Digit1', 'do'],
  ['Digit2', 're'],
  ['Digit3', 'mi'],
]

const MODEL_PATHS = {
  idle: '/Mushy%20IDLE.glb',
  walk: '/Mushy%20WALK.glb',
  jump: '/Mushy%20JUMP.glb',
  fall: '/Mushy%20FALL.glb',
}

const PLAYER_SCALE = 0.01
const PLAYER_GROUND_OFFSET = 0
const GROUND_RAY_HEIGHT = 2
const MOVE_SPEED = 0.75
const JUMP_SPEED = 3.54
const GRAVITY = 18
const INITIAL_CAMERA_YAW = -0.55
const INITIAL_PLAYER_ROTATION = Math.PI / 2
const PLAYER_START_POSITION = [3, 0.05, -3]
const PLAYER_FORWARD_OFFSET =
  INITIAL_PLAYER_ROTATION - (INITIAL_CAMERA_YAW + Math.PI)

function alignSceneToGround(scene) {
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene)
  scene.position.y -= bounds.min.y
  return scene
}

// Починаємо вантажити моделі одразу при імпорті, а не при кожному рендері компонента
Object.values(MODEL_PATHS).forEach((path) => useGLTF.preload(path))

// Головний герой (гриб Муші), тепер з 3D-моделлю і анімаціями.
const Player = forwardRef(function Player({ platforms = [], groundMeshes, wallMeshes, cameraYawRef }, ref) {
  const keys = useKeyboard()
  const { addFluteNote, status } = useGame()
  const velocityY = useRef(0)
  const isGrounded = useRef(true)
  const jumpInProgress = useRef(false)
  const jumpStartY = useRef(PLAYER_START_POSITION[1])
  const standingPlatform = useRef(-1)
  const [activeAnimation, setActiveAnimation] = useState('idle')

  // Промінь, який летить вниз від гравця і шукає землю в моделі рівня
  const raycaster = useRef(new Raycaster())
  const rayOrigin = useRef(new Vector3())
  const rayDown = useRef(new Vector3(0, -1, 0))

  // Другий промінь — горизонтальний, щоб гравець не проходив крізь скелі та дерева
  const wallRaycaster = useRef(new Raycaster(undefined, undefined, 0, 0.45))
  const wallDirection = useRef(new Vector3())

  const idleModel = useGLTF(MODEL_PATHS.idle)
  const walkModel = useGLTF(MODEL_PATHS.walk)
  const jumpModel = useGLTF(MODEL_PATHS.jump)
  const fallModel = useGLTF(MODEL_PATHS.fall)

  const idleRef = useRef(null)
  const walkRef = useRef(null)
  const jumpRef = useRef(null)
  const fallRef = useRef(null)

  const idleScene = useMemo(
    () => alignSceneToGround(idleModel.scene.clone()),
    [idleModel.scene],
  )
  const walkScene = useMemo(
    () => alignSceneToGround(walkModel.scene.clone()),
    [walkModel.scene],
  )
  const jumpScene = useMemo(
    () => alignSceneToGround(jumpModel.scene.clone()),
    [jumpModel.scene],
  )
  const fallScene = useMemo(
    () => alignSceneToGround(fallModel.scene.clone()),
    [fallModel.scene],
  )

  const { actions: idleActions } = useAnimations(idleModel.animations, idleRef)
  const { actions: walkActions } = useAnimations(walkModel.animations, walkRef)
  const { actions: jumpActions } = useAnimations(jumpModel.animations, jumpRef)
  const { actions: fallActions } = useAnimations(fallModel.animations, fallRef)

  useEffect(() => {
    const actionMaps = [idleActions, walkActions, jumpActions, fallActions]
    actionMaps.forEach((actionMap) => {
      Object.values(actionMap).forEach((action) => {
        action.stop()
      })
    })

    const selectedMap = {
      idle: idleActions,
      walk: walkActions,
      jump: jumpActions,
      fall: fallActions,
    }[activeAnimation]

    const selectedAction = Object.values(selectedMap || {})[0]
    if (selectedAction) {
      selectedAction.reset().play()
    }
  }, [activeAnimation, idleActions, walkActions, jumpActions, fallActions])

  useEffect(() => {
    const playPressedNote = (event) => {
      if (event.repeat || status !== 'playing') return

      const note = noteKeys.find(([key]) => key === event.code)?.[1]
      if (!note) return

      playSound(note)
      addFluteNote(note)
    }

    window.addEventListener('keydown', playPressedNote)
    return () => window.removeEventListener('keydown', playPressedNote)
  }, [addFluteNote, status])

  // true, якщо в напрямку (dirX, dirZ) за 0.45 одиниці є стіна (скеля, дерево)
  const isBlocked = (player, dirX, dirZ) => {
    if (!wallMeshes) return false

    // Промінь на рівні "колін": нижчі за 0.5 камінці гравець просто переступає
    const collisionY = jumpInProgress.current ? jumpStartY.current : player.position.y
    rayOrigin.current.set(player.position.x, collisionY - 0.4, player.position.z)
    wallDirection.current.set(dirX, 0, dirZ)
    wallRaycaster.current.set(rayOrigin.current, wallDirection.current)

    const hits = wallRaycaster.current.intersectObjects(wallMeshes, false)

    // Ігноруємо майже горизонтальні поверхні (це земля, а не стіна)
    return hits.some((hit) => {
      if (!hit.face) return true
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      return Math.abs(normal.y) < 0.7
    })
  }

  useFrame((_, rawDelta) => {
    if (!ref || !ref.current || status !== 'playing') return

    // Обмежуємо delta: після важкого завантаження перший кадр може тривати секунди,
    // і гравець за один кадр пролетів би крізь землю
    const delta = Math.min(rawDelta, 0.05)

    const player = ref.current
    const forwardInput = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0)
    const strafeInput = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)
    const cameraYaw = cameraYawRef?.current ?? INITIAL_CAMERA_YAW
    const forwardX = -Math.sin(cameraYaw)
    const forwardZ = -Math.cos(cameraYaw)
    const rightX = Math.cos(cameraYaw)
    const rightZ = -Math.sin(cameraYaw)
    let moveX = forwardX * forwardInput + rightX * strafeInput
    let moveZ = forwardZ * forwardInput + rightZ * strafeInput
    const moveLength = Math.hypot(moveX, moveZ)
    const isMoving = moveLength > 0.01

    if (isMoving) {
      moveX /= moveLength
      moveZ /= moveLength
    }

    // Рухаємось окремо по X і Z, тому біля стіни можна ковзати вздовж неї
    const stepX = moveX * MOVE_SPEED * delta
    const stepZ = moveZ * MOVE_SPEED * delta

    if (stepX !== 0 && !isBlocked(player, Math.sign(stepX), 0)) {
      player.position.x += stepX
    }
    if (stepZ !== 0 && !isBlocked(player, 0, Math.sign(stepZ))) {
      player.position.z += stepZ
    }

    const facingAngle = cameraYaw + Math.PI + PLAYER_FORWARD_OFFSET
      ? Math.atan2(moveX, moveZ) + PLAYER_FORWARD_OFFSET
      : cameraYaw + Math.PI + PLAYER_FORWARD_OFFSET
    const rotationDifference = MathUtils.euclideanModulo(
      facingAngle - player.rotation.y + Math.PI,
      Math.PI * 2,
    ) - Math.PI
    player.rotation.y += rotationDifference * Math.min(1, delta * 10)

    const previousY = player.position.y
    velocityY.current -= GRAVITY * delta
    player.position.y += velocityY.current * delta

    const platformIndex = platforms.findIndex((platform, index) => {
      const halfW = platform.size[0] / 2
      const halfD = platform.size[2] / 2
      const topY = platform.position[1] + platform.size[1] / 2 + PLAYER_GROUND_OFFSET
      const insidePlatform =
        player.position.x >= platform.position[0] - halfW &&
        player.position.x <= platform.position[0] + halfW &&
        player.position.z >= platform.position[2] - halfD &&
        player.position.z <= platform.position[2] + halfD
      const landingOnPlatform =
        jumpInProgress.current &&
        previousY >= topY &&
        player.position.y <= topY &&
        velocityY.current <= 0
      const stayingOnPlatform =
        standingPlatform.current === index &&
        velocityY.current <= 0 &&
        player.position.y <= topY + 0.1 &&
        player.position.y >= topY - 0.2

      return insidePlatform && (landingOnPlatform || stayingOnPlatform)
    })
    const platformTop = platformIndex >= 0 ? platforms[platformIndex] : null

    // Шукаємо землю під гравцем: тільки там, де в моделі є меш (порожнеча = падіння)
    let groundY = null
    if (groundMeshes) {
      rayOrigin.current.set(player.position.x, player.position.y + GROUND_RAY_HEIGHT, player.position.z)
      raycaster.current.set(rayOrigin.current, rayDown.current)
      const hits = raycaster.current.intersectObjects(groundMeshes, false)
      if (hits.length > 0) {
        groundY = hits[0].point.y + PLAYER_GROUND_OFFSET
      }
    }

    if (platformTop) {
      player.position.y =
        platformTop.position[1] + platformTop.size[1] / 2 + PLAYER_GROUND_OFFSET
      velocityY.current = 0
      isGrounded.current = true
      jumpInProgress.current = false
      standingPlatform.current = platformIndex
    } else if (groundY !== null && player.position.y <= groundY && velocityY.current <= 0) {
      player.position.y = groundY
      velocityY.current = 0
      isGrounded.current = true
      jumpInProgress.current = false
      standingPlatform.current = -1
    } else {
      isGrounded.current = false
      standingPlatform.current = -1
    }

    if (keys.Space && isGrounded.current) {
      velocityY.current = JUMP_SPEED
      isGrounded.current = false
      jumpInProgress.current = true
      jumpStartY.current = player.position.y
      standingPlatform.current = -1
    }

    const nextAnimation = !isGrounded.current
      ? velocityY.current > 0
        ? 'jump'
        : 'fall'
      : isMoving
        ? 'walk'
        : 'idle'

    if (nextAnimation !== activeAnimation) {
      setActiveAnimation(nextAnimation)
    }
  })

  return (
    <group
      ref={ref}
      position={PLAYER_START_POSITION}
      scale={[PLAYER_SCALE, PLAYER_SCALE, PLAYER_SCALE]}
      rotation={[0, INITIAL_PLAYER_ROTATION, 0]}
    >
      <group ref={idleRef} visible={activeAnimation === 'idle'}>
        <primitive object={idleScene} />
      </group>
      <group ref={walkRef} visible={activeAnimation === 'walk'}>
        <primitive object={walkScene} />
      </group>
      <group ref={jumpRef} visible={activeAnimation === 'jump'}>
        <primitive object={jumpScene} />
      </group>
      <group ref={fallRef} visible={activeAnimation === 'fall'}>
        <primitive object={fallScene} />
      </group>
    </group>
  )
})

export default Player
