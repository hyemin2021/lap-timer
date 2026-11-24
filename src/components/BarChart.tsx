import { useState } from 'react'
import { formatDuration, type QuestionSummary } from '../lib/timer'

interface Props {
  questions: QuestionSummary[]
  targetMs: number
}

/**
 * 문제별 소요 시간 막대그래프. 목표 시간(제한시간 ÷ 문항 수)을 기준선으로 그린다.
 * 목표를 넘긴 막대는 진한 색 — 범례에 글로 설명하므로 색만으로 구분하지 않는다.
 * 막대를 탭하면 정확한 값이 뜬다.
 */
export function BarChart({ questions, targetMs }: Props) {
  const [sel, setSel] = useState<number | null>(null)
  const n = questions.length
  // 목표가 없는 시험(설정 없이 시작)은 기준선·초과 색 없이 그린다
  const hasTarget = Number.isFinite(targetMs) && targetMs > 0
  const maxMs = Math.max(hasTarget ? targetMs * 1.15 : 0, ...questions.map((q) => q.ms), 1)

  const H = 180
  const padL = 40
  const padB = 22
  const padT = 8
  const slot = Math.max(10, Math.min(28, 640 / Math.max(n, 1)))
  const W = padL + slot * n + 8
  const barW = Math.max(4, slot - 2) // 막대 사이 2px 간격
  const y = (ms: number) => padT + (H - padT - padB) * (1 - ms / maxMs)

  // y축 눈금: 분 단위로 보기 좋은 간격
  const stepMin = [0.5, 1, 2, 5, 10, 15, 30].find((m) => (maxMs / 60000) / m <= 4) ?? 60
  const yTicks: number[] = []
  for (let v = 0; v <= maxMs; v += stepMin * 60000) yTicks.push(v)
  const labelEvery = n > 40 ? 10 : n > 20 ? 5 : 1

  const selQ = sel !== null ? questions[sel] : null

  return (
    <div className="chart">
      {hasTarget && (
        <div className="chart-legend">
          <span><i className="sw normal" />목표 이내</span>
          <span><i className="sw over" />목표 초과</span>
          <span><i className="sw target" />목표 {formatDuration(targetMs)}</span>
        </div>
      )}
      <div className="chart-scroll">
        <svg width={W} height={H} role="img" aria-label="문제별 소요 시간 막대그래프">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={W} y1={y(v)} y2={y(v)} className="grid" />
              <text x={padL - 6} y={y(v)} className="axis" textAnchor="end" dominantBaseline="central">
                {v === 0 ? '0' : `${v / 60000}분`}
              </text>
            </g>
          ))}
          {questions.map((q, i) => {
            const x = padL + i * slot + (slot - barW) / 2
            const top = y(q.ms)
            const h = Math.max(0, y(0) - top)
            const r = Math.min(4, barW / 2, h)
            const over = hasTarget && q.ms > targetMs
            // 위쪽만 둥근 막대 (아래는 기준선에 붙음)
            const d = `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y(0)} Z`
            return (
              <g key={i} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
                {/* 막대보다 넓은 터치 영역 */}
                <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
                {h > 0 && <path d={d} className={`bar ${over ? 'over' : ''} ${sel === i ? 'sel' : ''}`} />}
                {(i % labelEvery === labelEvery - 1 || i === 0 || labelEvery === 1) && (
                  <text x={x + barW / 2} y={H - 6} className="axis" textAnchor="middle">
                    {i + 1}
                  </text>
                )}
              </g>
            )
          })}
          {hasTarget && <line x1={padL} x2={W} y1={y(targetMs)} y2={y(targetMs)} className="target-line" />}
          <line x1={padL} x2={W} y1={y(0)} y2={y(0)} className="baseline" />
        </svg>
      </div>
      <div className="chart-tip" aria-live="polite">
        {selQ
          ? `${selQ.q + 1}번 · ${formatDuration(selQ.ms)}${selQ.status !== 'done' ? ' · 미완료' : ''}`
          : '막대를 탭하면 자세히 보여요'}
      </div>
    </div>
  )
}
