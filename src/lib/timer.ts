/**
 * 타이머 핵심 로직 (화면과 무관한 순수 함수만 모아둔 파일)
 *
 * 설계 요점: "이벤트 소싱"
 *  - 저장하는 것은 사용자의 입력 이벤트 목록(start / tap / skip / jump / end)과 그 시각(Date.now)뿐이다.
 *  - 현재 문제 번호, 각 문제 상태, 구간 로그는 이벤트를 처음부터 다시 재생(replay)해서 계산한다.
 *  - 그래서 되돌리기는 "마지막 이벤트 하나 삭제"로 끝나고, 이전 상태로 정확히 복원된다.
 *  - 시간은 모두 절대 시각의 차이로 계산하므로, 앱이 백그라운드에 있거나 화면이 꺼져도 오차가 없다.
 *
 * 문제 번호는 내부에서 0부터 센다(0 = 1번 문제). 화면에 보여줄 때만 +1 한다.
 */

/** timer: 숫자가 올라가는 스톱워치 / clock: 시작 시각부터 흐르는 시험장 벽시계 */
export type ExamMode = 'timer' | 'clock'

/** 연속 탭 무시 간격. 폰으로 써 보면서 여기 숫자만 바꿔 최적값을 찾는다. */
export const DEFAULT_DEBOUNCE_MS = 500

export interface ExamConfig {
  name: string
  questionCount: number
  mode: ExamMode
  /** 타이머식 제한시간(분) */
  limitMinutes: number
  /** 시계식 'HH:MM' 형식. 예: '08:40' */
  startClock: string
  endClock: string
  /** 문제당 목표 시간(초). 0 이면 자동(제한시간 ÷ 문항 수) */
  targetSeconds: number
  /** 이 시간(ms) 안에 들어온 두 번째 탭은 무시 */
  debounceMs: number
}

export type ExamEvent =
  | { type: 'start'; t: number }
  | { type: 'tap'; t: number }
  | { type: 'skip'; t: number }
  | { type: 'jump'; to: number; t: number }
  | { type: 'end'; t: number }

export type QuestionStatus = 'todo' | 'done' | 'held'

/** 한 문제(또는 검토 시간)를 보고 있던 연속된 시간 */
export interface Segment {
  order: number
  /** 문제 번호(0부터). null 이면 모든 문제를 끝낸 뒤의 '검토 시간' */
  q: number | null
  start: number
  end: number
}

export interface ExamState {
  /** 지금 보고 있는 문제. null 이면 검토 중(모두 완료) */
  current: number | null
  statuses: QuestionStatus[]
  /** 끝난 구간들 (순서대로) */
  segments: Segment[]
  /** 지금 진행 중인 구간의 시작 시각 */
  openSince: number | null
  startedAt: number | null
  endedAt: number | null
  /** 마지막 문제를 넘겨서 보류 문제로 자동 이동했을 때 띄울 작은 표시 */
  notice: { kind: 'held'; q: number } | null
  /** 문항 수를 정하지 않은 시험 (설정 없이 바로 시작). 넘길 때마다 문제가 하나씩 늘어난다 */
  open: boolean
}

// ---------------------------------------------------------------------------
// 시각 계산
// ---------------------------------------------------------------------------

/** 'HH:MM' → 자정부터의 분 */
export function parseClock(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return NaN
  return h * 60 + min
}

/**
 * 제한시간(ms).
 * - 타이머식: limitMinutes
 * - 시계식: 종료 − 시작. 종료가 시작보다 이르면 자정을 넘긴 것으로 본다.
 */
export function limitMs(config: Pick<ExamConfig, 'mode' | 'limitMinutes' | 'startClock' | 'endClock'>): number {
  if (config.mode === 'timer') {
    return config.limitMinutes > 0 ? config.limitMinutes * 60_000 : NaN
  }
  const s = parseClock(config.startClock)
  const e = parseClock(config.endClock)
  if (Number.isNaN(s) || Number.isNaN(e)) return NaN
  let diff = e - s
  if (diff <= 0) diff += 24 * 60
  return diff * 60_000
}
/** 추천 목표 시간 = 제한시간 ÷ 문항 수 */
export function recommendedTargetMs(
  config: Pick<ExamConfig, 'mode' | 'limitMinutes' | 'startClock' | 'endClock' | 'questionCount'>,
): number {
  return config.questionCount > 0 ? limitMs(config) / config.questionCount : NaN
}

/** 문제당 목표 시간. 직접 설정했으면 그 값, 아니면 추천값 */
export function targetMs(config: ExamConfig): number {
  return config.targetSeconds > 0 ? config.targetSeconds * 1000 : recommendedTargetMs(config)
}

// ---------------------------------------------------------------------------
// 재생(replay)
// ---------------------------------------------------------------------------

/**
 * questionCount 가 0 이면 "문항 수 미정" 시험.
 * - [다음]을 누를 때마다 다음 번호가 새로 생긴다 (끝이 없으므로 보류 문제로 되돌아가지 않음)
 * - 보류 문제는 문항표로 직접 찾아간다
 */
export function initialState(questionCount: number): ExamState {
  return {
    open: questionCount <= 0,
    current: null,
    statuses: Array.from({ length: questionCount }, () => 'todo' as QuestionStatus),
    segments: [],
    openSince: null,
    startedAt: null,
    endedAt: null,
    notice: null,
  }
}

/**
 * 다음에 볼 문제를 고른다.
 * 1) 현재 문제 뒤쪽에서 아직 완료되지 않은 첫 문제
 * 2) 없으면(마지막을 넘겼으면) 앞에서부터 완료되지 않은(보류) 첫 문제 → wrapped = true
 * 3) 그것도 없으면 null (모두 완료 → 검토 시간)
 */
export function nextTarget(
  statuses: QuestionStatus[],
  from: number,
): { q: number | null; wrapped: boolean } {
  for (let i = from + 1; i < statuses.length; i++) {
    if (statuses[i] !== 'done') return { q: i, wrapped: false }
  }
  for (let i = 0; i <= from && i < statuses.length; i++) {
    if (statuses[i] !== 'done') return { q: i, wrapped: true }
  }
  return { q: null, wrapped: false }
}

function closeSegment(s: ExamState, t: number): void {
  if (s.openSince === null) return
  // 길이 0인 구간(예: 마지막 탭과 같은 순간에 종료)은 기록하지 않는다
  if (t > s.openSince) s.segments.push({ order: s.segments.length, q: s.current, start: s.openSince, end: t })
  s.openSince = t
}

function moveTo(s: ExamState, from: number): void {
  if (s.open) {
    // 뒤쪽에 아직 안 끝낸 문제가 있으면 거기로, 없으면 새 문제를 하나 만든다
    let q = s.statuses.findIndex((st, i) => i > from && st !== 'done')
    if (q === -1) {
      s.statuses.push('todo')
      q = s.statuses.length - 1
    }
    s.current = q
    s.notice = null
    return
  }
  const { q, wrapped } = nextTarget(s.statuses, from)
  s.current = q
  s.notice = q !== null && wrapped ? { kind: 'held', q } : null
}

/** 이벤트 하나를 적용한 새 상태를 돌려준다. (원본은 바꾸지 않음) */
export function applyEvent(prev: ExamState, e: ExamEvent): ExamState {
  const s: ExamState = {
    ...prev,
    statuses: prev.statuses.slice(),
    segments: prev.segments.slice(),
  }
  if (s.endedAt !== null) return s // 종료 후 이벤트는 무시

  switch (e.type) {
    case 'start': {
      if (s.startedAt !== null) return s
      s.startedAt = e.t
      s.openSince = e.t
      if (s.open) s.statuses.push('todo')
      s.current = s.statuses.length > 0 ? 0 : null
      s.notice = null
      return s
    }
    case 'tap': {
      if (s.startedAt === null || s.current === null) return s
      closeSegment(s, e.t)
      const cur = s.current
      s.statuses[cur] = 'done'
      moveTo(s, cur)
      return s
    }
    case 'skip': {
      if (s.startedAt === null || s.current === null) return s
      closeSegment(s, e.t)
      const cur = s.current
      if (s.statuses[cur] !== 'done') s.statuses[cur] = 'held'
      moveTo(s, cur)
      return s
    }
    case 'jump': {
      if (s.startedAt === null) return s
      if (e.to < 0 || e.to >= s.statuses.length || e.to === s.current) return s
      closeSegment(s, e.t)
      if (s.current !== null && s.statuses[s.current] !== 'done') {
        s.statuses[s.current] = 'held'
      }
      s.current = e.to
      s.notice = null
      return s
    }
    case 'end': {
      if (s.startedAt === null) return s
      // 문항 수 미정 시험: 마지막 [다음] 뒤에 자동으로 생긴 문제는 실제로 푼 문제가 아니다.
      // 그 문제는 지우고, 그 시간은 검토 시간(q = null)으로 기록한다.
      const cur = s.current
      if (
        s.open &&
        cur !== null &&
        cur === s.statuses.length - 1 &&
        cur > 0 &&
        s.statuses[cur] === 'todo' &&
        !s.segments.some((g) => g.q === cur)
      ) {
        s.statuses.pop()
        s.current = null
      }
      closeSegment(s, e.t)
      s.openSince = null
      s.endedAt = e.t
      s.notice = null
      return s
    }
  }
}

export function replay(questionCount: number, events: readonly ExamEvent[]): ExamState {
  return events.reduce(applyEvent, initialState(questionCount))
}

// ---------------------------------------------------------------------------
// 입력 처리 (무시할 입력 거르기 + 되돌리기)
// ---------------------------------------------------------------------------

/**
 * 새 이벤트를 받아들일지 판단해서, 받아들이면 새 이벤트 목록을, 무시하면 null 을 돌려준다.
 * - 종료된 시험, 시작 전 입력, 검토 중의 탭/건너뛰기, 같은 문제로의 이동은 무시
 * - 탭: 직전 이벤트로부터 debounceMs 안이면 무시 (연속 탭 방지)
 */
export function tryAppend(
  config: Pick<ExamConfig, 'questionCount' | 'debounceMs'>,
  events: readonly ExamEvent[],
  e: ExamEvent,
): ExamEvent[] | null {
  const state = replay(config.questionCount, events)
  if (state.endedAt !== null) return null
  if (e.type === 'start') return state.startedAt === null ? [...events, e] : null
  if (state.startedAt === null) return null

  if (e.type === 'tap' || e.type === 'skip') {
    if (state.current === null) return null
  }
  if (e.type === 'tap') {
    const last = events[events.length - 1]
    if (last && e.t - last.t < config.debounceMs) return null
  }
  if (e.type === 'jump') {
    // 이동 범위는 지금까지 있는 문제 수 기준 (문항 수 미정 시험은 계속 늘어나므로)
    if (e.to === state.current || e.to < 0 || e.to >= state.statuses.length) return null
  }
  return [...events, e]
}

/** 직전 이벤트 하나를 취소. 'start'와 'end'는 되돌리지 않는다. */
export function undo(events: readonly ExamEvent[]): ExamEvent[] | null {
  const last = events[events.length - 1]
  if (!last || last.type === 'start' || last.type === 'end') return null
  return events.slice(0, -1)
}

// ---------------------------------------------------------------------------
// 복기용 요약
// ---------------------------------------------------------------------------

export interface QuestionSummary {
  q: number
  ms: number
  visits: number
  status: QuestionStatus
  /** 완료한 시점 (시작부터 경과 ms). 완료하지 않았으면 null */
  doneAt: number | null
}

export interface ExamSummary {
  totalMs: number
  limitMs: number
  /** 양수면 초과, 음수면 남음 */
  overMs: number
  targetMs: number
  /** 목표 시간을 직접 설정했는지 (false 면 추천값) */
  targetIsCustom: boolean
  /** 본 문제(시간 > 0)들의 평균 */
  avgMs: number
  doneCount: number
  reviewMs: number
  questions: QuestionSummary[]
  segments: Segment[]
}

export function summarize(config: ExamConfig, events: readonly ExamEvent[], now = Date.now()): ExamSummary {
  let state = replay(config.questionCount, events)
  // 아직 끝나지 않았다면 now 기준으로 마감해서 계산
  if (state.endedAt === null && state.startedAt !== null) {
    state = applyEvent(state, { type: 'end', t: now })
  }
  const questions: QuestionSummary[] = state.statuses.map((status, q) => ({ q, ms: 0, visits: 0, status, doneAt: null as number | null }))
  let reviewMs = 0
  for (const seg of state.segments) {
    const d = seg.end - seg.start
    if (seg.q === null) reviewMs += d
    else {
      questions[seg.q].ms += d
      questions[seg.q].visits += 1
      // 완료 시점 = 그 문제의 마지막 구간이 끝난 때
      if (state.startedAt !== null && questions[seg.q].status === 'done') questions[seg.q].doneAt = seg.end - state.startedAt
    }
  }
  const totalMs = state.startedAt !== null && state.endedAt !== null ? state.endedAt - state.startedAt : 0
  const lim = limitMs(config)
  // 평균은 실제로 본 문제(시간 > 0)만으로 낸다. 다 안 푸는 시험에서 안 본 문제가 0초로 섞이지 않게
  const seen = questions.filter((q) => q.ms > 0)
  const seenMs = seen.reduce((a, b) => a + b.ms, 0)
  return {
    totalMs,
    limitMs: lim,
    overMs: totalMs - lim,
    targetMs: targetMs(config),
    targetIsCustom: config.targetSeconds > 0,
    avgMs: seen.length > 0 ? seenMs / seen.length : 0,
    doneCount: questions.filter((q) => q.status === 'done').length,
    reviewMs,
    questions,
    segments: state.segments,
  }
}

// ---------------------------------------------------------------------------
// 표시용 포맷
// ---------------------------------------------------------------------------

/** 125000 → '02:05', 3725000 → '1:02:05' */
export function formatDuration(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** 남은 시간 표시. 초과하면 '+03:12' */
export function formatRemaining(remainingMs: number): string {
  return remainingMs >= 0 ? formatDuration(remainingMs) : `+${formatDuration(-remainingMs)}`
}

/** 기록 목록·복기 화면에 쓸 시험 제목 */
export function examTitle(config: Pick<ExamConfig, 'name' | 'questionCount'>): string {
  if (config.name.trim()) return config.name
  return config.questionCount > 0 ? `${config.questionCount}문항` : '바로 시작'
}
