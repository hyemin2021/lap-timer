import { useMemo, useState } from 'react'
import { BarChart } from '../components/BarChart'
import type { Session } from '../lib/storage'
import { examTitle, formatDuration, qNo, summarize } from '../lib/timer'

interface Props {
  session: Session
  onHome: () => void
  onDelete: () => void
  /** 끝난 시험을 이어서 풀기 */
  onContinue: () => void
}

type SortKey = 'q' | 'ms'

export function ReviewScreen({ session, onHome, onDelete, onContinue }: Props) {
  const { config, events } = session
  const sum = useMemo(() => summarize(config, events), [config, events])
  const [sort, setSort] = useState<SortKey>('q')

  const rows = useMemo(
    () => [...sum.questions].sort((a, b) => (sort === 'ms' ? b.ms - a.ms : a.q - b.q)),
    [sum.questions, sort],
  )
  const over = sum.overMs > 0
  // 설정 없이 시작한 시험은 제한시간·목표가 없다 → 관련 칸은 숨긴다
  const hasLimit = Number.isFinite(sum.limitMs)
  const hasTarget = Number.isFinite(sum.targetMs)
  const open = config.questionCount <= 0
  const startedAt = events[0]?.t

  return (
    <main className="review">
      <header className="review-head">
        <button className="btn small" onClick={onHome}>
          ← 처음으로
        </button>
        <div>
          <h1>{examTitle(config)}</h1>
          {startedAt && (
            <small>{new Date(startedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}</small>
          )}
        </div>
      </header>

      <section className="stats">
        <div className="stat">
          <span>총 소요</span>
          <strong>{formatDuration(sum.totalMs)}</strong>
          {hasLimit && (
            <small className={over ? 'bad' : 'good'}>
              {over ? `▲ ${formatDuration(sum.overMs)} 초과` : `✓ ${formatDuration(-sum.overMs)} 남김`}
            </small>
          )}
        </div>
        {hasLimit && (
          <div className="stat">
            <span>제한시간</span>
            <strong>{formatDuration(sum.limitMs)}</strong>
            <small>{config.mode === 'clock' ? `${config.startClock}–${config.endClock}` : '타이머식'}</small>
          </div>
        )}
        <div className="stat">
          <span>완료</span>
          <strong>{open ? `${sum.doneCount}문제` : `${sum.doneCount} / ${config.questionCount}`}</strong>
        </div>
        {hasTarget && (
          <div className="stat">
            <span>문제당 목표</span>
            <strong>{formatDuration(sum.targetMs)}</strong>
            <small>{sum.targetIsCustom ? '직접 설정' : '추천값'}</small>
          </div>
        )}
        <div className="stat">
          <span>평균</span>
          <strong>{formatDuration(sum.avgMs)}</strong>
          <small>본 문제 기준</small>
        </div>
        <div className="stat">
          <span>검토 시간</span>
          <strong>{formatDuration(sum.reviewMs)}</strong>
        </div>
        {sum.pausedMs > 0 && (
          <div className="stat">
            <span>일시정지</span>
            <strong>{formatDuration(sum.pausedMs)}</strong>
            <small>총 소요에서 뺌</small>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>문제별 표</h2>
          <div className="seg small">
            <button className={sort === 'q' ? 'on' : ''} onClick={() => setSort('q')}>
              번호 순
            </button>
            <button className={sort === 'ms' ? 'on' : ''} onClick={() => setSort('ms')}>
              오래 걸린 순
            </button>
          </div>
        </div>
        <table className="qtable">
          <thead>
            <tr>
              <th>번호</th>
              <th>소요</th>
              {/* 목표를 직접 설정했을 때만 목표 대비 표시 */}
              {sum.targetIsCustom && <th>목표 대비</th>}
              <th>완료 시점</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diff = r.ms - sum.targetMs
              return (
                <tr key={r.q} className={r.status !== 'done' ? 'undone' : ''}>
                  <td>
                    {qNo(config, r.q)}
                    {r.status === 'held' && <em> 보류</em>}
                    {r.status === 'todo' && <em>{r.ms > 0 ? ' 미완료' : ' 안 봄'}</em>}
                  </td>
                  <td>{formatDuration(r.ms)}</td>
                  {sum.targetIsCustom && (
                    <td className={diff > 0 ? 'bad' : ''}>
                      {diff > 0 ? '+' : '−'}
                      {formatDuration(diff)}
                    </td>
                  )}
                  <td className="muted-cell">{r.doneAt !== null ? formatDuration(r.doneAt) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>문제별 소요 시간</h2>
        <BarChart questions={sum.questions} targetMs={sum.targetMs} first={qNo(config, 0)} />
      </section>

      <div className="actions">
        <button
          className="btn ghost danger"
          onClick={() => {
            if (confirm('이 기록을 삭제할까요? 되돌릴 수 없어요.')) onDelete()
          }}
        >
          기록 삭제
        </button>
        <button className="btn" onClick={onContinue}>
          이어풀기
        </button>
        <button className="btn primary" onClick={onHome}>
          새 시험
        </button>
      </div>
    </main>
  )
}
