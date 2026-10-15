import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Raycaster, Vector3 } from 'three'

const MIN_DISTANCE = 0.4
const MAX_DISTANCE = 2.4
const INITIAL_DISTANCE = 1.2
const CAMERA_WALL_GAP = 0.2
const MIN_CAMERA_GAP = 0.25

// Крупний план обличчя Муші (міні-гра). Змінюй числа, щоб підігнати кадр.
// FACE_OFFSET — де стоїть камера відносно героя, FACE_LOOK_Y — на якій висоті дивиться.
const FACE_OFFSET = [1, 0.15, 0]
const FACE_LOOK_Y = 0

// Камера їде за героєм і обертається за ПКМ.
function CameraFollow({
  targetRef,
  cameraYawRef,
  collisionMeshes,
  closeUp = false,
  combatView = false,
  minimumTargetY = -Infinity,
  initialPitch = 0.45,
}) {
  const yaw = cameraYawRef
  const pitch = useRef(initialPitch)
  const distance = useRef(INITIAL_DISTANCE)
  const zoomDistance = useRef(INITIAL_DISTANCE)
  const isRotating = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })

  // blend: 0 — звичайна камера, 1 — крупний план; плавно рухається між ними
  const blend = useRef(0)
  const normalPosition = useRef(new Vector3())
  const facePosition = useRef(new Vector3())
  const normalLook = useRef(new Vector3())
  const faceLook = useRef(new Vector3())
  const targetWorldPosition = useRef(new Vector3())
  const cameraRaycaster = useRef(new Raycaster())
  const cameraDirection = useRef(new Vector3())

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (event.button !== 2) return
      isRotating.current = true
      lastPointer.current = { x: event.clientX, y: event.clientY }
    }

    const handlePointerMove = (event) => {
      if (!isRotating.current) return

      const dx = event.clientX - lastPointer.current.x
      const dy = event.clientY - lastPointer.current.y

      yaw.current -= dx * 0.005
      pitch.current = Math.max(0.25, Math.min(1.05, pitch.current + dy * 0.004))

      lastPointer.current = { x: event.clientX, y: event.clientY }
    }

    const handleWheel = (event) => {
      event.preventDefault()
      distance.current = Math.max(
        MIN_DISTANCE,
        Math.min(MAX_DISTANCE, distance.current + event.deltaY * 0.01),
      )
    }

    const handlePointerUp = () => {
      isRotating.current = false
    }

    const preventContextMenu = (event) => event.preventDefault()

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('contextmenu', preventContextMenu)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [yaw])

  useFrame((state, delta) => {
    const target = targetRef.current
    if (!target) return
    const targetPosition = target.getWorldPosition(targetWorldPosition.current)
    const cameraTargetY = Math.max(targetPosition.y, minimumTargetY)
    const cameraDistance = combatView
      ? Math.max(MIN_DISTANCE, zoomDistance.current * 0.65)
      : zoomDistance.current

    blend.current += ((closeUp ? 1 : 0) - blend.current) * Math.min(1, delta * 3)
    zoomDistance.current += (distance.current - zoomDistance.current) * Math.min(1, delta * 5)
    const combatSideOffset = combatView ? 0.45 : 0

    normalPosition.current.set(
      targetPosition.x +
        Math.sin(yaw.current) * Math.cos(pitch.current) * cameraDistance +
        Math.cos(yaw.current) * combatSideOffset,
      cameraTargetY + Math.sin(pitch.current) * cameraDistance,
      targetPosition.z +
        Math.cos(yaw.current) * Math.cos(pitch.current) * cameraDistance -
        Math.sin(yaw.current) * combatSideOffset,
    )
    normalLook.current.set(targetPosition.x, cameraTargetY + 0.09, targetPosition.z)

    facePosition.current.set(
      targetPosition.x + FACE_OFFSET[0],
      cameraTargetY + FACE_OFFSET[1],
      targetPosition.z + FACE_OFFSET[2],
    )
    faceLook.current.set(targetPosition.x, cameraTargetY + FACE_LOOK_Y, targetPosition.z)

    state.camera.position.lerpVectors(normalPosition.current, facePosition.current, blend.current)

    const look = normalLook.current.lerp(faceLook.current, blend.current)

    if (collisionMeshes?.length) {
      cameraDirection.current.subVectors(state.camera.position, look)
      const cameraDistance = cameraDirection.current.length()

      if (cameraDistance > MIN_CAMERA_GAP) {
        cameraDirection.current.normalize()
        cameraRaycaster.current.set(look, cameraDirection.current)
        cameraRaycaster.current.far = cameraDistance

        const obstruction = cameraRaycaster.current.intersectObjects(collisionMeshes, false)[0]
        if (obstruction) {
          const safeDistance = Math.max(MIN_CAMERA_GAP, obstruction.distance - CAMERA_WALL_GAP)
          state.camera.position.copy(look).addScaledVector(cameraDirection.current, safeDistance)
        }
      }
    }

    state.camera.lookAt(look)
  })

  return null
}

export default CameraFollow
