import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier, RigidBody, CapsuleCollider } from '@react-three/rapier'
import { Box3, MathUtils } from 'three'
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
const PLAYER_COLLIDER_RADIUS = 0.045
const PLAYER_COLLIDER_HALF_HEIGHT = 0.005
const PLAYER_COLLIDER_CENTER_Y = 0.05
const MOVE_SPEED = 0.701700181875
const JUMP_SPEED = 3.54
const GRAVITY = 18
const CHARACTER_CONTROLLER_OFFSET = 0.002
const MAX_STEP_HEIGHT = 0.04
const MIN_STEP_WIDTH = 0.02
const MAX_SLOPE_CLIMB_ANGLE = Math.PI / 3
const MIN_SLOPE_SLIDE_ANGLE = Math.PI * 0.45
const GROUND_SNAP_DISTANCE = 0.08
const INITIAL_CAMERA_YAW = -0.55
const INITIAL_PLAYER_ROTATION = Math.PI / 2
const PLAYER_START_POSITION = [3, 0.05, -3]
const PLAYER_FORWARD_OFFSET =
  INITIAL_PLAYER_ROTATION - (INITIAL_CAMERA_YAW + Math.PI) + Math.PI / 4

function alignSceneToGround(scene) {
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene)
  scene.position.y -= bounds.min.y
  scene.traverse((object) => {
    if (!object.isMesh) return

    object.castShadow = true
    object.receiveShadow = true
  })
  return scene
}

// Починаємо вантажити моделі одразу при імпорті, а не при кожному рендері компонента
Object.values(MODEL_PATHS).forEach((path) => useGLTF.preload(path))

// Головний герой (гриб Муші), тепер з 3D-моделлю і анімаціями.
const Player = forwardRef(function Player({
  cameraYawRef,
  startPosition = PLAYER_START_POSITION,
  startRotation = INITIAL_PLAYER_ROTATION,
  modelScale = PLAYER_SCALE,
  movementSpeed = MOVE_SPEED,
  modelOffsetY = 0,
}, ref) {
  const keys = useKeyboard()
  const { addFluteNote, status } = useGame()
  const { world } = useRapier()
  const rigidBodyRef = useRef(null)
  const colliderRef = useRef(null)
  const characterControllerRef = useRef(null)
  const footstepsAudioRef = useRef(null)
  const jumpAudioRef = useRef(null)
  const velocityY = useRef(0)
  const isGrounded = useRef(true)
  const [activeAnimation, setActiveAnimation] = useState('idle')

  useEffect(() => {
    if (status !== 'playing') {
      velocityY.current = 0
      setActiveAnimation('idle')
    }
  }, [status])

  useEffect(() => {
    const characterController = world.createCharacterController(CHARACTER_CONTROLLER_OFFSET)
    characterController.enableAutostep(MAX_STEP_HEIGHT, MIN_STEP_WIDTH, false)
    characterController.enableSnapToGround(GROUND_SNAP_DISTANCE)
    characterController.setMaxSlopeClimbAngle(MAX_SLOPE_CLIMB_ANGLE)
    characterController.setMinSlopeSlideAngle(MIN_SLOPE_SLIDE_ANGLE)
    characterControllerRef.current = characterController

    return () => {
      characterController.free()
      characterControllerRef.current = null
    }
  }, [world])

  useEffect(() => {
    const footsteps = new Audio('/footsteps-forest.wav')
    footsteps.loop = true
    footsteps.volume = 0.16
    footsteps.preload = 'auto'
    footstepsAudioRef.current = footsteps

    return () => {
      footsteps.pause()
      footsteps.currentTime = 0
      footstepsAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    const jumpSound = new Audio('/jump.mp3')
    jumpSound.volume = 0.07
    jumpSound.preload = 'auto'
    jumpAudioRef.current = jumpSound

    return () => {
      jumpSound.pause()
      jumpSound.currentTime = 0
      jumpAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    const footsteps = footstepsAudioRef.current
    if (!footsteps) return

    if (status === 'playing' && activeAnimation === 'walk') {
      if (footsteps.paused) {
        footsteps.play().catch((error) => {
          console.error('Could not play the footsteps sound:', error)
        })
      }
      return
    }

    footsteps.pause()
    footsteps.currentTime = 0
  }, [activeAnimation, status])

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

    Object.values(selectedMap || {}).forEach((action) => {
      action.reset().play()
    })
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

  useFrame((_, rawDelta) => {
    if (
      !ref?.current ||
      !rigidBodyRef.current ||
      !colliderRef.current ||
      !characterControllerRef.current ||
      status !== 'playing'
    ) return

    if (world.colliders.len() <= 1) return

    // Обмежуємо delta: після важкого завантаження перший кадр може тривати секунди,
    // і гравець за один кадр пролетів би крізь землю
    const delta = Math.min(rawDelta, 0.05)

    const player = ref.current
    const bodyPosition = rigidBodyRef.current.translation()
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

    const stepX = moveX * movementSpeed * delta
    const stepZ = moveZ * movementSpeed * delta

    const facingAngle = isMoving
      ? Math.atan2(moveX, moveZ) + PLAYER_FORWARD_OFFSET
      : cameraYaw + Math.PI + PLAYER_FORWARD_OFFSET
    const rotationDifference = MathUtils.euclideanModulo(
      facingAngle - player.rotation.y + Math.PI,
      Math.PI * 2,
    ) - Math.PI
    player.rotation.y += rotationDifference * Math.min(1, delta * 10)

    if (keys.Space && isGrounded.current) {
      velocityY.current = JUMP_SPEED
      isGrounded.current = false
      const jumpSound = jumpAudioRef.current
      if (jumpSound) {
        jumpSound.currentTime = 0
        jumpSound.play().catch((error) => {
          console.error('Could not play the jump sound:', error)
        })
      }
    }

    velocityY.current -= GRAVITY * delta
    const characterController = characterControllerRef.current
    characterController.computeColliderMovement(colliderRef.current, {
      x: stepX,
      y: velocityY.current * delta,
      z: stepZ,
    })
    const movement = characterController.computedMovement()
    rigidBodyRef.current.setNextKinematicTranslation({
      x: bodyPosition.x + movement.x,
      y: bodyPosition.y + movement.y,
      z: bodyPosition.z + movement.z,
    })
    isGrounded.current = characterController.computedGrounded()
    if (isGrounded.current && velocityY.current < 0) velocityY.current = 0

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
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      position={startPosition}
      colliders={false}
    >
      <CapsuleCollider
        ref={colliderRef}
        args={[PLAYER_COLLIDER_HALF_HEIGHT, PLAYER_COLLIDER_RADIUS]}
        position={[0, PLAYER_COLLIDER_CENTER_Y, 0]}
      />
      <group
        ref={ref}
        position={[0, modelOffsetY, 0]}
        scale={[modelScale, modelScale, modelScale]}
        rotation={[0, startRotation, 0]}
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
    </RigidBody>
  )
})

export default Player
