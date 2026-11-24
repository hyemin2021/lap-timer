/**
 * 학교 시험장 벽시계 모양 아날로그 시계 (SVG).
 * 실제 현재 시각이 아니라 "설정한 시작 시각 + 경과 시간"을 보여준다.
 */
interface Props {
  /** 시작 시각 (자정부터의 분) */
  startMinutes: number
  elapsedMs: number
}

export function AnalogClock({ startMinutes, elapsedMs }: Props) {
  const totalSec = startMinutes * 60 + Math.floor(Math.max(0, elapsedMs) / 1000)
  const sec = totalSec % 60
  const min = (totalSec / 60) % 60
  const hour = (totalSec / 3600) % 12
  const hourDeg = hour * 30
  const minDeg = min * 6
  const secDeg = sec * 6 // 1초마다 딱딱 끊어 움직이는 초침

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const major = i % 5 === 0
    const a = (i * 6 * Math.PI) / 180
    const r1 = major ? 84 : 88
    const r2 = 93
    return (
      <line
        key={i}
        x1={100 + r1 * Math.sin(a)}
        y1={100 - r1 * Math.cos(a)}
        x2={100 + r2 * Math.sin(a)}
        y2={100 - r2 * Math.cos(a)}
        stroke="#eceef1"
        strokeWidth={major ? 2.6 : 1}
      />
    )
  })

  const numbers = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1
    const a = (n * 30 * Math.PI) / 180
    const r = 72
    return (
      <text
        key={n}
        x={100 + r * Math.sin(a)}
        y={100 - r * Math.cos(a)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="15"
        fontWeight="600"
        fill="#eceef1"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
      >
        {n}
      </text>
    )
  })

  return (
    <svg className="clock" viewBox="0 0 200 200" role="img" aria-label="시험장 시계">
      {/* 테두리(프레임) */}
      <circle cx="100" cy="100" r="99" fill="#2a2f37" />
      <circle cx="100" cy="100" r="96" fill="#181b20" />
      {ticks}
      {numbers}
      {/* 시침 */}
      <line
        x1="100" y1="112" x2="100" y2="52"
        stroke="#eceef1" strokeWidth="6" strokeLinecap="round"
        transform={`rotate(${hourDeg} 100 100)`}
      />
      {/* 분침 */}
      <line
        x1="100" y1="114" x2="100" y2="22"
        stroke="#eceef1" strokeWidth="3.6" strokeLinecap="round"
        transform={`rotate(${minDeg} 100 100)`}
      />
      {/* 초침 */}
      <g transform={`rotate(${secDeg} 100 100)`}>
        <line x1="100" y1="124" x2="100" y2="16" stroke="#ff6b6b" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="100" cy="100" r="4" fill="#ff6b6b" />
      </g>
      <circle cx="100" cy="100" r="1.6" fill="#181b20" />
    </svg>
  )
}
