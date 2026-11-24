import { useState } from 'react'
import { type Session, loadHistory, loadQuickStart, saveQuickStart } from '../lib/storage'
import { examTitle } from '../lib/timer'

interface Props {
  /** quick = true 이면 설정 화면 없이 바로 시험 시작 */
  onPlay: (quick: boolean) => void
  onOpenHistory: (s: Session) => void
  onAnswers: () => void
}

export function IntroScreen({ onPlay, onOpenHistory, onAnswers }: Props) {
  const [history] = useState<Session[]>(loadHistory)
  const [quick, setQuick] = useState(loadQuickStart)

  return (
    <main className="intro">
      <div className="intro-title">
        <h1>문제별 랩 타이머</h1>
        <p className="tagline">풀 때는 탭만, 분석은 끝나고.</p>
      </div>

      <div className="intro-buttons">
        <button className="intro-btn play" onClick={() => onPlay(quick)} aria-label="시험 시작">
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="M17 11 L38 24 L17 37 Z" fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth="3" />
          </svg>
          <span>시험 시작</span>
        </button>

        <button className="intro-btn sheet" onClick={onAnswers} aria-label="답지 보기">
          <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 6 H29 L37 14 V42 H13 Z" />
            <path d="M29 6 V14 H37" />
            <path d="M18 21 H31 M18 27 H31 M18 33 H26" />
          </svg>
          <span>답지 보기</span>
          <small>5·7급 PSAT · 9급</small>
        </button>

        {/* 체크하면 ▶ 한 번에 바로 시작. 선택은 기억해 둔다 */}
        <label className="quick-start">
          <input
            type="checkbox"
            checked={quick}
            onChange={(e) => {
              setQuick(e.target.checked)
              saveQuickStart(e.target.checked)
            }}
          />
          설정 없이 바로 시작
        </label>
      </div>

      {history.length > 0 && (
        <section className="card intro-history">
          <h2>지난 기록</h2>
          <ul className="history">
            {history.slice(0, 10).map((s) => {
              const start = s.events[0]?.t
              return (
                <li key={s.id}>
                  <button onClick={() => onOpenHistory(s)}>
                    <span>{examTitle(s.config)}</span>
                    <small>
                      {start ? new Date(start).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </small>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <footer className="intro-footer">v{__APP_VERSION__}</footer>
    </main>
  )
}
