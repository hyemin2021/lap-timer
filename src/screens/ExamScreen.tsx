import { useEffect, useMemo, useState } from 'react'
import { AnalogClock } from '../components/AnalogClock'
import { OmrGrid } from '../components/OmrGrid'
import { useLongPress } from '../hooks/useLongPress'
import { useNow } from '../hooks/useNow'
import { allowSleep, keepAwake } from '../lib/keepAwake'
import type { Session } from '../lib/storage'
import { type ExamEvent, elapsedMs, formatDuration, parseClock, replay, tryAppend, undo } from '../lib/timer'

interface Props {
  session: Session
  /** 이벤트가 바뀔 때마다 호출 (즉시 저장용) */
  onChange: (events: ExamEvent[]) => void
  onEnd: (events: ExamEvent[]) => void
}

export function ExamScreen({ session, onChange, onEnd }: Props) {
  const { config } = session
  const [events, setEvents] = useState<ExamEvent[]>(session.events)
  const [gridOpen, setGridOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const state = useMemo(() => replay(config.questionCount, events), [config.questionCount, events])

  const now = useNow(250)

  // 당겨서 새로고침·스크롤 방지: 시험 화면에 있는 동안 body 에 클래스 부여
  useEffect(() => {
    document.body.classList.add('exam-lock')
    return () => {
      document.body.classList.remove('exam-lock')
      allowSleep() // 시험 화면을 벗어나면 다시 화면이 꺼질 수 있게
    }
  }, [])

  const commit = (next: ExamEvent[] | null) => {
    if (!next) return
    setEvents(next)
    onChange(next)
  }
  const push = (e: ExamEvent) => commit(tryAppend(config, events, e))

  // 손가락이 닿는 순간 반응하도록 click 대신 pointerdown 사용
  const onNext = (e: React.PointerEvent) => {
    if (!e.isPrimary) return
    keepAwake() // 화면 꺼짐 방지 (백그라운드에 갔다 와서 풀렸으면 다시 켬)
    push({ type: 'tap', t: Date.now() })
  }
  const onSkip = () => {
    keepAwake()
    push({ type: 'skip', t: Date.now() })
  }
  const onUndo = () => commit(undo(events))
  // 일시정지 중에는 화면이 꺼져도 되게 하고, 다시 시작하면 꺼짐 방지를 켠다
  const onPauseToggle = () => {
    if (state.pausedAt === null) {
      push({ type: 'pause', t: Date.now() })
      allowSleep()
    } else {
      keepAwake()
      push({ type: 'resume', t: Date.now() })
    }
  }
  const onJump = (q: number) => {
    push({ type: 'jump', to: q, t: Date.now() })
    setGridOpen(false)
  }
  const endExam = () => {
    const next = tryAppend(config, events, { type: 'end', t: Date.now() })
    if (next) onEnd(next)
  }

  const numberPress = useLongPress(() => setGridOpen(true), 600)

  const paused = state.pausedAt !== null
  const elapsed = elapsedMs(state, now) // 일시정지했던 시간은 빼고, 멈춘 동안은 그대로
  const canUndo = !paused && undo(events) !== null
  const reviewing = state.current === null

  return (
    <div className={`exam mode-${config.mode} ${paused ? 'is-paused' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      <div className="exam-top">
        <button className="qno" {...numberPress} disabled={paused} aria-label="문항표 (길게 눌러 문항 이동)">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {[0, 1, 2].flatMap((r) =>
              [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={1 + c * 5} y={1 + r * 5} width="4" height="4" rx="1" />),
            )}
          </svg>
          문항표
        </button>
        {state.notice && <span className="notice">보류 {state.notice.q + 1}번</span>}
        <span className="spacer" />
        <button className="end" onClick={() => setConfirmEnd(true)}>
          종료
        </button>
      </div>

      <div className="exam-center">
        {config.mode === 'clock' ? (
          <AnalogClock startMinutes={parseClock(config.startClock)} elapsedMs={elapsed} />
        ) : (
          <div className="stopwatch-circle" aria-label="경과 시간">
            <span className="stopwatch">{formatDuration(elapsed)}</span>
            <span className="stopwatch-label">경과</span>
          </div>
        )}
        <button className={`pause-btn ${paused ? 'on' : ''}`} onClick={onPauseToggle} aria-pressed={paused}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {paused ? <path d="M8 5 L19 12 L8 19 Z" /> : <path d="M7 5 h3.5 v14 H7 Z M13.5 5 H17 v14 h-3.5 Z" />}
          </svg>
          {paused ? (state.pausedForContinue ? '이어서 풀기' : '계속하기') : '일시정지'}
        </button>
      </div>

      <div className="exam-controls">
        <div className="side-btns">
          <button className="btn exam-btn" onClick={onUndo} disabled={!canUndo}>
            되돌리기
          </button>
          <button className="btn exam-btn" onClick={onSkip} disabled={reviewing || paused}>
            건너뛰기
          </button>
        </div>
        <button className="next-btn" onPointerDown={onNext} disabled={reviewing || paused}>
          {paused ? (
            <span className="next-label">일시정지 중</span>
          ) : reviewing ? (
            <span className="next-label">검토 중</span>
          ) : (
            <>
              <span className="next-no">{state.current! + 1}</span>
              <span className="next-label">다음</span>
            </>
          )}
        </button>
      </div>

      {gridOpen && (
        <OmrGrid statuses={state.statuses} current={state.current} onPick={onJump} onClose={() => setGridOpen(false)} />
      )}

      {confirmEnd && (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="end-title">
            <p id="end-title">시험을 종료하시겠습니까?</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmEnd(false)}>
                아니오
              </button>
              <button className="btn primary" onClick={endExam}>
                예
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
