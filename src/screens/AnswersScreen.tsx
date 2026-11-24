import { useMemo, useState } from 'react'
import data from '../data/answerKeys.json'

/**
 * 답지 보기: 공식 최종정답을 시험 → 연도 → 과목 순으로 골라 본다.
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

interface Props {
  onBack: () => void
}

function loadLast(): { exam: string; year: number; subject: string } | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null')
  } catch {
    return null
  }
}

/** 정답 하나 → ①, 복수정답 → ①③ */
const show = (a: number | number[]) => (Array.isArray(a) ? a.map((n) => CIRCLED[n]).join('') : CIRCLED[a])

export function AnswersScreen({ onBack }: Props) {
  const last = loadLast()
  const [exam, setExam] = useState<string>(last?.exam ?? '7급')
  const years = useMemo(
    () => [...new Set(data.keys.filter((k) => k.exam === exam).map((k) => k.year))].sort((a, b) => b - a),
    [exam],
  )
  const [yearState, setYear] = useState<number>(last?.year ?? years[0])
  const year = years.includes(yearState) ? yearState : years[0]

  const subjects = useMemo(
    () =>
      data.keys
        .filter((k) => k.exam === exam && k.year === year)
        .map((k) => k.subject)
        .sort((a, b) => SUBJECT_ORDER.indexOf(a) - SUBJECT_ORDER.indexOf(b)),
    [exam, year],
  )
  const [subjectState, setSubject] = useState<string>(last?.subject ?? subjects[0])
  const subject = subjects.includes(subjectState) ? subjectState : subjects[0]

  const key: Key | undefined = data.keys.find((k) => k.exam === exam && k.year === year && k.subject === subject)

  // 마지막으로 본 답지를 기억해 두었다가 다음에 바로 연다
  const remember = (next: { exam?: string; year?: number; subject?: string }) => {
    const v = { exam, year, subject, ...next }
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
            onClick={() => {
              setExam(e.id)
              remember({ exam: e.id })
            }}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="chips answer-years" role="radiogroup" aria-label="연도">
        {years.map((y) => (
          <button
            key={y}
            role="radio"
            aria-checked={y === year}
            className={`chip-btn ${y === year ? 'on' : ''}`}
            onClick={() => {
              setYear(y)
              remember({ year: y })
            }}
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
            onClick={() => {
              setSubject(s)
              remember({ subject: s })
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {key && (
        <section className="card answer-card">
          <div className="answer-head">
            <strong>
              {key.year} {key.examName} · {key.subject}
            </strong>
            <span className="booklet">{key.booklet} 책형</span>
          </div>
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
              최종정답
            </a>{' '}
            기준. 다른 책형 문제지로 풀었다면 번호가 다를 수 있어요.
          </p>
        </section>
      )}
    </main>
  )
}
