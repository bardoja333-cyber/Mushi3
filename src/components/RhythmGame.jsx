import { useEffect, useRef, useState } from 'react'
import { useGame } from '../context/GameContext'
import playSound from '../audio/playNote'

// Міні-гра як у Guitar Hero: ноти падають зверху вниз, у момент,
// коли нота на лінії — натискаємо відповідну стрілку.

// 4 доріжки: яка клавіша, яка стрілка на екрані, яку ноту грає і колір
const LANES = [
  { code: 'ArrowLeft', arrow: '←', note: 'do', color: '#e5484d' },
  { code: 'ArrowUp', arrow: '↑', note: 're', color: '#3e63dd' },
  { code: 'ArrowDown', arrow: '↓', note: 'mi', color: '#30a46c' },
  { code: 'ArrowRight', arrow: '→', note: 'fa', color: '#f5a524' },
]

// Мелодія: time — на якій секунді нота має бути на лінії, lane — номер доріжки (0-3)
// TODO: (я) придумати свою мелодію і підігнати її під музику
const CHART = [
  { time: 1.0, lane: 0 },
  { time: 1.8, lane: 1 },
  { time: 2.6, lane: 2 },
  { time: 3.4, lane: 3 },
  { time: 4.2, lane: 1 },
  { time: 4.8, lane: 2 },
  { time: 5.4, lane: 0 },
  { time: 6.2, lane: 3 },
]

// Початковий стан: усі ноти ще чекають
const START_RESULTS = CHART.map(() => 'wait')

const COUNTDOWN = 2 // секунд на розгін камери перед першою нотою
const FALL_TIME = 1.6 // за скільки секунд нота падає від верху до лінії
const HIT_WINDOW = 0.25 // на скільки секунд раніше/пізніше можна натиснути
const BOARD_HEIGHT = 440
const HIT_LINE_Y = 380
const NOTE_SIZE = 56
const MIN_HITS_TO_WIN = 5

// Зовнішній компонент: показуємо гру тільки в статусі 'rhythm',
// тому щоразу вона стартує з чистого стану.
function RhythmGame() {
  const { status } = useGame()
  if (status !== 'rhythm') return null
  return <RhythmBoard />
}

function RhythmBoard() {
  const { setStatus, setEnemiesDefeated, addScore, loseLife, lives } = useGame()

  // results[i]: 'wait' | 'hit' | 'miss' для кожної ноти з CHART
  const resultsRef = useRef(START_RESULTS)
  const livesRef = useRef(lives)
  const nowRef = useRef(-COUNTDOWN)
  const [results, setResults] = useState(START_RESULTS)
  const [now, setNow] = useState(-COUNTDOWN)
  const [pressedLane, setPressedLane] = useState(null)
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    livesRef.current = lives
  }, [lives])

  const setResult = (index, value) => {
    resultsRef.current = resultsRef.current.map((old, i) => (i === index ? value : old))
    setResults(resultsRef.current)
  }

  // Головний цикл: рахує час, відмічає пропущені ноти і закінчує гру
  useEffect(() => {
    const startTime = performance.now()
    const lastNoteTime = CHART[CHART.length - 1].time
    let frameId = 0
    let closeTimer = 0
    let finished = false

    const tick = () => {
      const t = (performance.now() - startTime) / 1000 - COUNTDOWN
      nowRef.current = t
      setNow(t)

      CHART.forEach((note, index) => {
        if (resultsRef.current[index] === 'wait' && t > note.time + HIT_WINDOW) {
          setResult(index, 'miss')
        }
      })

      if (!finished && t > lastNoteTime + 1) {
        finished = true

        const hits = resultsRef.current.filter((r) => r === 'hit').length
        const won = hits >= MIN_HITS_TO_WIN
        setSummary({ hits, total: CHART.length, won })

        addScore(hits * 10)
        if (won) {
          setEnemiesDefeated(true)
        } else {
          loseLife()
        }

        closeTimer = window.setTimeout(() => {
          if (won || livesRef.current > 1) setStatus('playing')
        }, 1800)
        return
      }

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(closeTimer)
    }
  }, [addScore, loseLife, setEnemiesDefeated, setStatus])

  // Натискання стрілок
  useEffect(() => {
    const handleKey = (event) => {
      if (event.repeat) return

      const laneIndex = LANES.findIndex((lane) => lane.code === event.code)
      if (laneIndex === -1) return

      setPressedLane(laneIndex)
      window.setTimeout(() => setPressedLane(null), 120)

      // Шукаємо найближчу ноту на цій доріжці, яка ще чекає
      let bestIndex = -1
      let bestDiff = HIT_WINDOW
      CHART.forEach((note, index) => {
        if (note.lane !== laneIndex || resultsRef.current[index] !== 'wait') return
        const diff = Math.abs(nowRef.current - note.time)
        if (diff <= bestDiff) {
          bestDiff = diff
          bestIndex = index
        }
      })

      if (bestIndex !== -1) {
        setResult(bestIndex, 'hit')
        playSound(LANES[laneIndex].note)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

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

      {/* Лінія влучання зі стрілками */}
      {LANES.map((lane, index) => (
        <div
          key={`target-${lane.code}`}
          style={{
            position: 'absolute',
            left: index * laneWidth + (laneWidth - NOTE_SIZE) / 2,
            top: HIT_LINE_Y - NOTE_SIZE / 2,
            width: NOTE_SIZE,
            height: NOTE_SIZE,
            border: `3px solid ${lane.color}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            opacity: pressedLane === index ? 1 : 0.6,
          }}
        >
          {lane.arrow}
        </div>
      ))}

      {/* Ноти, що падають */}
      {CHART.map((note, index) => {
        const timeLeft = note.time - now
        if (results[index] === 'hit' || timeLeft > FALL_TIME || timeLeft < -0.5) return null

        const lane = LANES[note.lane]
        const y = HIT_LINE_Y * (1 - timeLeft / FALL_TIME)

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: note.lane * laneWidth + (laneWidth - NOTE_SIZE) / 2,
              top: y - NOTE_SIZE / 2,
              width: NOTE_SIZE,
              height: NOTE_SIZE,
              borderRadius: '50%',
              background: lane.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              opacity: results[index] === 'miss' ? 0.25 : 1,
            }}
          >
            {lane.arrow}
          </div>
        )
      })}

      {/* Підказки: відлік і результат */}
      {now < 0 && !summary && (
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
