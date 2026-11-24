import { useMemo, useState } from 'react'
import data from '../data/answerKeys.json'

/**
 * 답지 보기: 시험 → 연도 → 과목 → (책형이 둘이면) 책형 순으로 골라 본다.
 * 채점은 종이에서 하므로, 정답을 크게 5문항씩 끊어 보여주기만 한다.
 */

type Key = (typeof data.keys)[number]

const EXAMS = [
  { id: '5급', label: '5급 PSAT' },
  { id: '7급', label: '7급 PSAT' },
  { id: '9급', label: '9급' },
] as const

const SUBJECT_ORDER = ['언어논리', '자료해석', '상황판단', '국어', '영어']
const CIRCLED = ['', '①', '②', '③', '④', '⑤']
const LAST_KEY = 'laptimer.answersLast'
const NOTICE_URL = 'https://gongmuwon.gosi.kr/oprut/EvmArPrblmCransGdLst.do'

interface Last {
  exam: string
  yearKey: string
  subject: string
  booklet: string
}

interface Props {
  onBack: () => void
}

function loadLast(): Partial<Last> {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

/** 연도 칩 하나 = 연도 + (외교원 같은 별도 시험이면 그 이름) */
const yearKeyOf = (k: Key) => `${k.year}${k.variant ? ' ' + k.variant : ''}`

/** 정답 하나 → ①, 복수정답 → ①③ */
const show = (a: number | number[]) => (Array.isArray(a) ? a.map((n) => CIRCLED[n]).join('') : CIRCLED[a])

/** 지금 값이 목록에 있으면 그대로, 없으면 첫 번째 */
const pick = <T,>(list: T[], v: T | undefined) => (v !== undefined && list.includes(v) ? v : list[0])

export function AnswersScreen({ onBack }: Props) {
  const [sel, setSel] = useState<Partial<Last>>(loadLast)

  const exam = pick(
    EXAMS.map((e) => e.id as string),
    sel.exam ?? '7급',
  )
  const inExam = useMemo(() => data.keys.filter((k) => k.exam === exam), [exam])

  const yearKeys = useMemo(() => {
    const seen = new Map<string, Key>()
    for (const k of inExam) if (!seen.has(yearKeyOf(k))) seen.set(yearKeyOf(k), k)
    return [...seen.entries()]
      .sort(([, a], [, b]) => b.year - a.year || a.variant.localeCompare(b.variant))
      .map(([yk]) => yk)
  }, [inExam])
  const yearKey = pick(yearKeys, sel.yearKey)

  const inYear = inExam.filter((k) => yearKeyOf(k) === yearKey)
  const subjects = [...new Set(inYear.map((k) => k.subject))].sort(
    (a, b) => SUBJECT_ORDER.indexOf(a) - SUBJECT_ORDER.indexOf(b),
  )
  const subject = pick(subjects, sel.subject)

  const inSubject = inYear.filter((k) => k.subject === subject)
  const booklets = inSubject.map((k) => k.booklet)
  const booklet = pick(booklets, sel.booklet)

  const key = inSubject.find((k) => k.booklet === booklet)

  // 고른 값을 기억해 두었다가 다음에 바로 연다
  const choose = (next: Partial<Last>) => {
    const v = { exam, yearKey, subject, booklet, ...next }
    setSel(v)
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(v))
    } catch {
      // 무시
    }
  }

  // 5문항씩 끊기
  const groups: { start: number; items: (number | number[])[] }[] = []
  if (key) {
    for (let i = 0; i < key.answers.length; i += 5) groups.push({ start: i, items: key.answers.slice(i, i + 5) })
  }

  return (
    <main className="answers">
      <header className="setup-head">
        <button className="btn small" onClick={onBack} aria-label="처음으로">
          ←
        </button>
        <h1>답지 보기</h1>
      </header>

      <div className="seg" role="tablist" aria-label="시험">
        {EXAMS.map((e) => (
          <button
            key={e.id}
            role="tab"
            aria-selected={exam === e.id}
            className={exam === e.id ? 'on' : ''}
            onClick={() => choose({ exam: e.id })}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="chips answer-years" role="radiogroup" aria-label="연도">
        {yearKeys.map((y) => (
          <button
            key={y}
            role="radio"
            aria-checked={y === yearKey}
            className={`chip-btn ${y === yearKey ? 'on' : ''}`}
            onClick={() => choose({ yearKey: y })}
          >
            {y}
          </button>
        ))}
      </div>

      <div className="chips" role="radiogroup" aria-label="과목">
        {subjects.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={s === subject}
            className={`chip-btn ${s === subject ? 'on' : ''}`}
            onClick={() => choose({ subject: s })}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 예전 시험은 책형이 둘. 책형마다 문항 순서가 달라 정답도 다르다 */}
      {booklets.length > 1 && (
        <div className="chips" role="radiogroup" aria-label="책형">
          <span className="chips-label">책형</span>
          {booklets.map((b) => (
            <button
              key={b}
              role="radio"
              aria-checked={b === booklet}
              className={`chip-btn ${b === booklet ? 'on' : ''}`}
              onClick={() => choose({ booklet: b })}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {key && (
        <section className="card answer-card">
          <div className="answer-head">
            <strong>
              {key.year} {key.examName} · {key.subject}
            </strong>
            {key.booklet !== '-' && <span className="booklet">{key.booklet} 책형</span>}
          </div>
          {key.provisional && (
            <p className="answer-warn">이 해는 최종정답이 공개되지 않아 정답가안이에요. 일부 문항은 최종 정답과 다를 수 있어요.</p>
          )}
          <div className="answer-grid">
            {groups.map((g) => (
              <div key={g.start} className="answer-group">
                {g.items.map((a, i) => (
                  <div key={i} className="answer-cell">
                    <span className="answer-no">{g.start + i + 1}</span>
                    <span className="answer-val">{show(a)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="hint answer-source">
            인사혁신처{' '}
            <a href={NOTICE_URL} target="_blank" rel="noreferrer">
              {key.provisional ? '정답가안' : '최종정답'}
            </a>{' '}
            기준. 다른 책형 문제지로 풀었다면 번호가 다를 수 있어요.
          </p>
        </section>
      )}
    </main>
  )
}
