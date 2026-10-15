import { useEffect, useRef, useState } from 'react'
import { useGame } from '../context/GameContext'

const LANES = [
  { code: 'ArrowLeft', color: '#ff6a59', icon: '/rhythm-arrows/red-arrow.png', holdFilter: 'hue-rotate(240deg)', direction: 90 },
  { code: 'ArrowUp', color: '#ffae3d', icon: '/rhythm-arrows/orange-arrow.png', holdFilter: 'hue-rotate(270deg)', direction: 270 },
  { code: 'ArrowDown', color: '#3aa1ff', icon: '/rhythm-arrows/blue-arrow.png', holdFilter: 'hue-rotate(100deg)', direction: 270 },
  { code: 'ArrowRight', color: '#42d985', icon: '/rhythm-arrows/green-arrow.png', holdFilter: 'none', direction: 90 },
]

function CrystalArrow({ icon, color, size = 56, direction = 0, opacity = 1, pressed = false }) {
  return (
    <img
      src={icon}
      alt=""
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        opacity,
        transform: `rotate(${direction}deg) scale(${pressed ? 1.08 : 1})`,
        filter: `drop-shadow(0 0 ${pressed ? 12 : 8}px ${color})`,
      }}
    />
  )
}

// Міні-гра в стилі Friday Night Funkin: ноти падають до стрілок-приймачів унизу.

// Час атак і доріжки визначені за спектральними змінами мелодії.
const CHART = [
  [8.38, 2], [8.98, 2], [9.59, 0], [10.19, 1], [10.79, 1],
  [11.98, 3], [12.29, 1], [12.59, 0], [13.19, 2], [13.79, 2],
  [14.40, 0], [15.00, 2], [15.58, 2], [16.19, 2], [16.79, 2],
  [17.39, 2], [19.19, 2], [19.79, 2], [20.97, 3], [21.57, 2],
  [22.19, 3], [22.78, 3], [23.38, 2], [23.98, 0], [24.58, 3],
  [25.18, 3], [25.48, 2], [25.78, 2], [26.38, 0], [26.99, 3],
  [27.58, 0], [28.19, 1], [28.78, 1], [29.38, 3], [29.98, 0],
  [30.58, 3], [31.19, 1], [31.77, 3], [32.39, 3], [32.99, 3],
  [33.58, 2], [34.18, 3], [34.79, 3], [35.39, 2], [35.98, 2],
  [36.59, 1], [37.47, 3], [38.96, 3], [41.39, 3], [41.69, 3],
  [41.98, 1], [42.28, 3], [42.58, 1], [42.88, 3], [43.18, 1],
  [43.48, 3], [43.78, 0], [44.08, 2], [44.39, 0], [44.69, 3],
  [44.99, 1], [45.29, 2], [45.59, 2], [45.89, 3], [46.17, 1],
  [46.49, 3], [46.78, 3], [47.09, 0], [47.38, 0], [47.69, 0],
  [47.99, 0], [48.29, 2], [48.59, 3], [48.89, 2], [49.19, 1],
  [49.49, 2], [49.79, 2], [50.09, 2], [50.39, 2], [50.68, 3],
  [50.98, 1], [51.28, 3], [51.59, 3], [51.88, 3], [52.18, 1],
  [52.49, 1], [52.78, 1], [53.08, 3], [53.38, 0], [53.69, 0],
  [53.99, 0], [54.29, 3], [54.59, 1], [54.89, 2], [55.19, 2],
  [55.48, 3], [55.78, 1], [56.09, 3], [56.39, 2], [56.69, 0],
  [56.98, 0], [57.29, 0], [57.59, 2], [57.89, 2], [58.19, 2],
  [58.49, 2], [58.79, 1], [59.09, 2], [59.39, 2], [59.69, 2],
  [59.98, 2], [60.28, 3], [60.42, 1], [60.59, 3], [60.77, 2],
  [61.33, 2], [61.53, 3], [61.82, 3], [62.17, 3], [62.52, 3],
].reduce((notes, [time, requestedLane]) => {
  const counts = Array(LANES.length).fill(0)
  notes.forEach((note) => { counts[note.lane] += 1 })

  const lastTwo = notes.slice(-2)
  const availableLanes = LANES
    .map((_, lane) => lane)
    .filter((lane) => !(lastTwo.length === 2 && lastTwo.every((note) => note.lane === lane)))
  const minimumCount = Math.min(...availableLanes.map((lane) => counts[lane]))
  const balancedLanes = availableLanes.filter((lane) => counts[lane] === minimumCount)
  const lane = balancedLanes.includes(requestedLane) ? requestedLane : balancedLanes[0]

  notes.push({ time, lane })
  return notes
}, [])

CHART.push(
  { time: 62.98, lane: 0 },
  { time: 62.98, lane: 1 },
  { time: 62.98, lane: 2 },
)

const LEVEL2_MUSIC_START = 6.8
const LEVEL2_MUSIC_DURATION = 10
const LEVEL2_CHART = CHART
  .filter((note) => note.time >= 8.38 && note.time < LEVEL2_MUSIC_START + LEVEL2_MUSIC_DURATION)
  .map((note) => ({ ...note, time: note.time - LEVEL2_MUSIC_START }))

function startFightMusicSegment(audio, startTime) {
  audio.volume = 0.35
  audio.currentTime = startTime
  return audio.play()
}

function pauseFightMusic(audio) {
  audio.pause()
}

// Початковий стан: усі ноти ще чекають
const START_RESULTS = CHART.map(() => 'wait')
const LEVEL2_START_RESULTS = LEVEL2_CHART.map(() => 'wait')

const FALL_TIME = 1.6 // за скільки секунд нота падає зверху до стрілки-приймача
const HIT_WINDOW = 0.25 // на скільки секунд раніше/пізніше можна натиснути
const BOARD_HEIGHT = 480
const HIT_LINE_Y = 380
const NOTE_SIZE = 56
const HOLD_TAIL_HEIGHT = 68
const HOLD_TEXTURE = '/rhythm-arrows/green-hold.png'
const MIN_HIT_RATIO = 0.7

// Зовнішній компонент: показуємо гру тільки в статусі 'rhythm',
// тому щоразу вона стартує з чистого стану.
function RhythmGame({ fightMusicRef }) {
  const { status } = useGame()
  if (status !== 'rhythm') return null
  return (
    <>
      <RhythmBoard fightMusicRef={fightMusicRef} />
    </>
  )
}

function RhythmBoard({ fightMusicRef }) {
  const { setStatus, setEnemiesDefeated, addScore, loseLife, currentLevel } = useGame()
  const usesShortMusicSegment = currentLevel >= 2
  const chart = usesShortMusicSegment ? LEVEL2_CHART : CHART
  const startResults = usesShortMusicSegment ? LEVEL2_START_RESULTS : START_RESULTS

  // results[i]: 'wait' | 'holding' | 'hit' | 'miss' для кожної ноти з CHART
  const resultsRef = useRef(startResults)
  const heldKeysRef = useRef(new Set())
  const nowRef = useRef(0)
  const [results, setResults] = useState(startResults)
  const [now, setNow] = useState(0)
  const [pressedLane, setPressedLane] = useState(null)
  const [summary, setSummary] = useState(null)

  const setResult = (index, value) => {
    resultsRef.current = resultsRef.current.map((old, i) => (i === index ? value : old))
    setResults(resultsRef.current)
  }

  // Головний цикл: рахує час, відмічає пропущені ноти і закінчує гру
  useEffect(() => {
    const music = fightMusicRef?.current
    if (!music) return

    const musicStartTime = usesShortMusicSegment ? LEVEL2_MUSIC_START : 0
    startFightMusicSegment(music, musicStartTime).catch(() => {})
    const lastNoteTime = Math.max(...chart.map((note) => note.time + (note.duration || 0)))
    let frameId = 0
    let closeTimer = 0
    let finished = false

    const tick = () => {
      const t = music.currentTime - musicStartTime
      nowRef.current = t
      setNow(t)

      chart.forEach((note, index) => {
        if (resultsRef.current[index] === 'holding' && t >= note.time + note.duration) {
          setResult(index, 'hit')
        } else if (resultsRef.current[index] === 'wait' && t > note.time + HIT_WINDOW) {
          setResult(index, 'miss')
        }
      })

      const segmentFinished = usesShortMusicSegment
        ? t >= LEVEL2_MUSIC_DURATION
        : t > lastNoteTime + 1
      if (!finished && segmentFinished) {
        finished = true
        if (usesShortMusicSegment) pauseFightMusic(music)

        const hits = resultsRef.current.filter((r) => r === 'hit').length
        const won = hits / chart.length >= MIN_HIT_RATIO
        setSummary({ hits, total: chart.length, won })

        addScore(hits * 10)
        if (won) {
          setEnemiesDefeated(true)
        } else {
          loseLife(usesShortMusicSegment ? 'fight-level-2' : 'fight-level-1')
        }

        closeTimer = window.setTimeout(() => {
          if (won) setStatus('playing')
        }, 1800)
        return
      }

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(closeTimer)
      music.pause()
    }
  }, [fightMusicRef, addScore, chart, currentLevel, loseLife, setEnemiesDefeated, setStatus, usesShortMusicSegment])

  // Натискання стрілок
  useEffect(() => {
    const handleKey = (event) => {
      if (event.repeat) return

      const laneIndex = LANES.findIndex((lane, index) => lane.code === event.code || event.code === `Digit${index + 1}`)
      if (laneIndex === -1) return

      event.preventDefault()
      heldKeysRef.current.add(event.code)
      setPressedLane(laneIndex)
      if (!chart.some((note, index) => note.lane === laneIndex && note.duration && resultsRef.current[index] === 'holding')) {
        window.setTimeout(() => setPressedLane(null), 120)
      }

      // Шукаємо найближчу ноту на цій доріжці, яка ще чекає
      let bestIndex = -1
      let bestDiff = HIT_WINDOW
      chart.forEach((note, index) => {
        if (note.lane !== laneIndex || resultsRef.current[index] !== 'wait') return
        const diff = Math.abs(nowRef.current - note.time)
        if (diff <= bestDiff) {
          bestDiff = diff
          bestIndex = index
        }
      })

      if (bestIndex !== -1) {
        setResult(bestIndex, chart[bestIndex].duration ? 'holding' : 'hit')
      }
    }

    const handleKeyUp = (event) => {
      const laneIndex = LANES.findIndex((lane, index) => lane.code === event.code || event.code === `Digit${index + 1}`)
      if (laneIndex === -1) return

      heldKeysRef.current.delete(event.code)
      setPressedLane(null)
      chart.forEach((note, index) => {
        if (note.lane === laneIndex && resultsRef.current[index] === 'holding' && nowRef.current < note.time + note.duration) {
          setResult(index, 'miss')
        }
      })
    }

    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [chart])

  const laneWidth = 80
  const boardWidth = laneWidth * LANES.length

  return (
    <div
      style={{
        position: 'absolute',
        right: 40,
        top: '50%',
        transform: 'translateY(-50%)',
        width: boardWidth,
        height: BOARD_HEIGHT,
        background: 'rgba(0, 0, 0, 0.6)',
        border: '2px solid white',
        borderRadius: 12,
        overflow: 'hidden',
        color: 'white',
        userSelect: 'none',
      }}
    >
      {/* Доріжки */}
      {LANES.map((lane, index) => (
        <div
          key={lane.code}
          style={{
            position: 'absolute',
            left: index * laneWidth,
            top: 0,
            width: laneWidth,
            height: '100%',
            borderLeft: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.2)',
            background: pressedLane === index ? 'rgba(255,255,255,0.15)' : 'transparent',
          }}
        />
      ))}

      {/* Стрілки-приймачі внизу відповідають клавішам зі стрілками */}
      {LANES.map((lane, index) => (
        <div
          key={`target-${lane.code}`}
          style={{
            position: 'absolute',
            left: index * laneWidth + (laneWidth - NOTE_SIZE) / 2,
            top: HIT_LINE_Y - NOTE_SIZE / 2,
            width: NOTE_SIZE,
            height: NOTE_SIZE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressedLane === index ? 1 : 0.8,
          }}
        >
          <CrystalArrow
            icon={lane.icon}
            color={lane.color}
            size={NOTE_SIZE}
            direction={lane.direction}
            pressed={pressedLane === index}
          />
        </div>
      ))}

      {/* Ноти, що падають */}
      {chart.map((note, index) => {
        const result = results[index]
        if (result === 'hit' || result === 'miss') return null

        const timeLeft = note.time - now
        if (timeLeft > FALL_TIME || (!note.duration && timeLeft < -0.5)) return null

        const lane = LANES[note.lane]
        const y = HIT_LINE_Y * (1 - timeLeft / FALL_TIME)
        const holdHeight = note.duration ? (note.duration / FALL_TIME) * HIT_LINE_Y : 0
        const holdProgress = result === 'holding'
          ? Math.max(0, Math.min(1, (now - note.time) / note.duration))
          : 0
        const visibleHoldHeight = result === 'holding'
          ? HOLD_TAIL_HEIGHT * (1 - holdProgress)
          : holdHeight

        return (
          <div key={index}>
            {note.duration > 0 && (
              <img
                src={HOLD_TEXTURE}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: note.lane * laneWidth + (laneWidth - 30) / 2,
                  top: result === 'holding' ? HIT_LINE_Y + NOTE_SIZE / 2 : y - holdHeight,
                  width: 30,
                  height: visibleHoldHeight,
                  objectFit: 'fill',
                  opacity: result === 'holding' ? 1 - holdProgress : 0.85,
                  filter: lane.holdFilter,
                  pointerEvents: 'none',
                }}
              />
            )}
            {result !== 'holding' && timeLeft >= -0.5 && (
              <div
                style={{
                  position: 'absolute',
                  left: note.lane * laneWidth + (laneWidth - NOTE_SIZE) / 2,
                  top: y - NOTE_SIZE / 2,
                  width: NOTE_SIZE,
                  height: NOTE_SIZE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CrystalArrow
                  icon={lane.icon}
                  color={lane.color}
                  size={NOTE_SIZE}
                  direction={lane.direction}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Підказки: відлік і результат */}
      {now < chart[0].time - FALL_TIME && !summary && (
        <div style={{ position: 'absolute', top: 20, width: '100%', textAlign: 'center', fontSize: 24 }}>
          Приготуйся!
        </div>
      )}

      {summary && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            fontSize: 26,
            textAlign: 'center',
          }}
        >
          <div>
            Влучно: {summary.hits} / {summary.total}
          </div>
          <div>({Math.round((summary.hits / summary.total) * 100)}%)</div>
          <div style={{ marginTop: 10 }}>
            {summary.won ? 'Вороги переможені!' : 'Не вистачило влучань — втрачено життя'}
          </div>
        </div>
      )}
    </div>
  )
}

export default RhythmGame
