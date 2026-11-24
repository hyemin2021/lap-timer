import { describe, expect, it } from 'vitest'
import {
  type ExamConfig,
  type ExamEvent,
  continueAfterEnd,
  elapsedMs,
  formatDuration,
  formatRemaining,
  limitMs,
  nextTarget,
  parseClock,
  recommendedTargetMs,
  replay,
  summarize,
  tryAppend,
  undo,
} from './timer'

const S = 1000
const cfg = (n: number, extra: Partial<ExamConfig> = {}): ExamConfig => ({
  name: '테스트',
  questionCount: n,
  mode: 'clock',
  limitMinutes: 80,
  startClock: '08:40',
  endClock: '10:00',
  targetSeconds: 0,
  debounceMs: 1000,
  ...extra,
})

/** tryAppend 를 거쳐 이벤트를 차례로 쌓는 헬퍼 (무시된 입력은 그대로 버려짐) */
function run(config: ExamConfig, input: ExamEvent[]): ExamEvent[] {
  let events: ExamEvent[] = []
  for (const e of input) events = tryAppend(config, events, e) ?? events
  return events
}

describe('시각 계산', () => {
  it('HH:MM 파싱', () => {
    expect(parseClock('08:40')).toBe(520)
    expect(parseClock('8:05')).toBe(485)
    expect(parseClock('24:00')).toBeNaN()
    expect(parseClock('abc')).toBeNaN()
  })
  it('시계식: 제한시간 = 종료 − 시작', () => {
    expect(limitMs(cfg(1, { startClock: '08:40', endClock: '10:00' }))).toBe(80 * 60 * S)
  })
  it('시계식: 자정을 넘기면 하루를 더한다', () => {
    expect(limitMs(cfg(1, { startClock: '23:30', endClock: '00:30' }))).toBe(60 * 60 * S)
  })
  it('타이머식: 제한시간 = 입력한 분', () => {
    expect(limitMs(cfg(1, { mode: 'timer', limitMinutes: 100, startClock: '', endClock: '' }))).toBe(100 * 60 * S)
    expect(limitMs(cfg(1, { mode: 'timer', limitMinutes: 0 }))).toBeNaN()
  })
})

describe('기본 진행', () => {
  it('탭하면 완료 처리 후 다음 문제로', () => {
    const c = cfg(3)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 10 * S },
      { type: 'tap', t: 25 * S },
    ])
    const s = replay(3, ev)
    expect(s.current).toBe(2)
    expect(s.statuses).toEqual(['done', 'done', 'todo'])
    expect(s.segments.map((g) => [g.q, g.end - g.start])).toEqual([
      [0, 10 * S],
      [1, 15 * S],
    ])
  })

  it('모든 문제 완료 후의 시간은 검토 시간으로 기록', () => {
    const c = cfg(2)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 10 * S },
      { type: 'tap', t: 30 * S },
      { type: 'tap', t: 40 * S }, // 검토 중 탭 → 무시
      { type: 'end', t: 100 * S },
    ])
    const s = replay(2, ev)
    expect(s.current).toBeNull()
    expect(ev.filter((e) => e.type === 'tap')).toHaveLength(2)
    const sum = summarize(c, ev)
    expect(sum.reviewMs).toBe(70 * S)
    expect(sum.totalMs).toBe(100 * S)
  })

  it('1초 안의 두 번째 탭은 무시', () => {
    const c = cfg(5)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 5 * S },
      { type: 'tap', t: 5 * S + 400 }, // 무시
      { type: 'tap', t: 6 * S + 100 }, // 받아들임
    ])
    expect(replay(5, ev).current).toBe(2)
  })

  it('디바운스 시간을 바꿀 수 있다', () => {
    const c = cfg(5, { debounceMs: 300 })
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 5 * S },
      { type: 'tap', t: 5 * S + 400 },
    ])
    expect(replay(5, ev).current).toBe(2)
  })

  it('시작 전 입력과 종료 후 입력은 무시', () => {
    const c = cfg(3)
    const ev = run(c, [
      { type: 'tap', t: 0 },
      { type: 'start', t: 1 * S },
      { type: 'end', t: 5 * S },
      { type: 'tap', t: 10 * S },
    ])
    expect(ev.map((e) => e.type)).toEqual(['start', 'end'])
  })
})

describe('건너뛰기와 보류', () => {
  it('건너뛰면 보류로 표시하고, 마지막을 넘기면 가장 앞 보류 문제로', () => {
    const c = cfg(4)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 10 * S }, // 1번 완료
      { type: 'skip', t: 20 * S }, // 2번 보류
      { type: 'skip', t: 30 * S }, // 3번 보류
      { type: 'tap', t: 40 * S }, // 4번 완료 → 2번으로
    ])
    const s = replay(4, ev)
    expect(s.statuses).toEqual(['done', 'held', 'held', 'done'])
    expect(s.current).toBe(1)
    expect(s.notice).toEqual({ kind: 'held', q: 1 })
  })

  it('보류 문제를 끝내면 다음 보류 문제로, 다 끝나면 검토', () => {
    const c = cfg(3)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'skip', t: 10 * S }, // 1번 보류
      { type: 'skip', t: 20 * S }, // 2번 보류
      { type: 'tap', t: 30 * S }, // 3번 완료 → 1번
      { type: 'tap', t: 40 * S }, // 1번 완료 → 2번
    ])
    let s = replay(3, ev)
    expect(s.current).toBe(1)
    const ev2 = run(c, [...ev, { type: 'tap', t: 50 * S }])
    s = replay(3, ev2)
    expect(s.current).toBeNull()
  })

  it('여러 번 방문한 문제는 모든 구간을 합산하고 방문 횟수를 센다', () => {
    const c = cfg(3)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'skip', t: 30 * S }, // 1번 30초
      { type: 'tap', t: 50 * S }, // 2번 20초
      { type: 'tap', t: 60 * S }, // 3번 10초 → 1번
      { type: 'tap', t: 100 * S }, // 1번 40초
      { type: 'end', t: 100 * S },
    ])
    const sum = summarize(c, ev)
    expect(sum.questions[0]).toMatchObject({ ms: 70 * S, visits: 2, status: 'done' })
    expect(sum.questions[1]).toMatchObject({ ms: 20 * S, visits: 1 })
    expect(sum.segments.map((g) => g.q)).toEqual([0, 1, 2, 0])
    expect(sum.segments.map((g) => g.order)).toEqual([0, 1, 2, 3])
  })

  it('nextTarget 은 뒤쪽의 미완료 문제를 먼저 찾는다', () => {
    expect(nextTarget(['done', 'held', 'todo', 'todo'], 2)).toEqual({ q: 3, wrapped: false })
    expect(nextTarget(['done', 'held', 'done', 'done'], 3)).toEqual({ q: 1, wrapped: true })
    expect(nextTarget(['done', 'done'], 1)).toEqual({ q: null, wrapped: false })
  })
})

describe('문항 이동 (OMR 그리드)', () => {
  it('완료되지 않은 문제에서 이동하면 보류 처리', () => {
    const c = cfg(5)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'jump', to: 3, t: 10 * S },
    ])
    const s = replay(5, ev)
    expect(s.current).toBe(3)
    expect(s.statuses[0]).toBe('held')
  })

  it('같은 문제로의 이동은 무시', () => {
    const c = cfg(5)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'jump', to: 0, t: 10 * S },
    ])
    expect(ev).toHaveLength(1)
  })

  it('이동 후 탭하면 그 뒤의 미완료 문제로', () => {
    const c = cfg(5)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'jump', to: 3, t: 10 * S },
      { type: 'tap', t: 20 * S }, // 4번 완료 → 5번
      { type: 'tap', t: 30 * S }, // 5번 완료 → 1번(보류)
    ])
    const s = replay(5, ev)
    expect(s.current).toBe(0)
    expect(s.notice).toEqual({ kind: 'held', q: 0 })
  })

  it('검토 중 완료된 문제로 이동했다가 다시 탭하면 검토로 돌아간다', () => {
    const c = cfg(2)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 10 * S },
      { type: 'tap', t: 20 * S }, // 검토 시작
      { type: 'jump', to: 0, t: 30 * S }, // 검토 10초
      { type: 'tap', t: 45 * S }, // 1번 15초 더 → 검토
      { type: 'end', t: 60 * S }, // 검토 15초
    ])
    const sum = summarize(c, ev)
    expect(sum.reviewMs).toBe(25 * S)
    expect(sum.questions[0]).toMatchObject({ ms: 25 * S, visits: 2 })
  })
})

describe('설정 없이 바로 시작 (문항 수 미정)', () => {
  const open = cfg(0, { mode: 'timer', limitMinutes: 0 })

  it('넘길 때마다 문제가 하나씩 생긴다', () => {
    const ev = run(open, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 10 * S },
      { type: 'tap', t: 20 * S },
    ])
    const s = replay(0, ev)
    expect(s.current).toBe(2)
    expect(s.statuses).toEqual(['done', 'done', 'todo'])
  })

  it('건너뛰어도 보류 문제로 되돌아가지 않고 계속 앞으로 간다', () => {
    const ev = run(open, [
      { type: 'start', t: 0 },
      { type: 'skip', t: 10 * S },
      { type: 'tap', t: 20 * S },
    ])
    const s = replay(0, ev)
    expect(s.statuses).toEqual(['held', 'done', 'todo'])
    expect(s.current).toBe(2)
    expect(s.notice).toBeNull()
  })

  it('문항표로 보류 문제에 갔다가 끝내면, 뒤쪽 안 끝낸 문제로 간다', () => {
    const ev = run(open, [
      { type: 'start', t: 0 },
      { type: 'skip', t: 10 * S }, // 1번 보류 → 2번
      { type: 'tap', t: 20 * S }, // 2번 완료 → 3번(새로 생김)
      { type: 'jump', to: 0, t: 30 * S }, // 1번으로 (3번은 보류)
      { type: 'tap', t: 40 * S }, // 1번 완료 → 3번
    ])
    const s = replay(0, ev)
    expect(s.current).toBe(2)
    expect(s.statuses).toEqual(['done', 'done', 'held'])
  })

  it('종료하면 마지막 [다음] 뒤에 생긴 빈 문제는 지우고 그 시간은 검토 시간으로', () => {
    const ev = run(open, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 30 * S },
      { type: 'tap', t: 50 * S },
      { type: 'end', t: 70 * S },
    ])
    const sum = summarize(open, ev)
    expect(sum.questions).toHaveLength(2)
    expect(sum.doneCount).toBe(2)
    expect(sum.reviewMs).toBe(20 * S)
    expect(sum.totalMs).toBe(70 * S)
    expect(sum.limitMs).toBeNaN()
    expect(sum.targetMs).toBeNaN()
  })

  it('풀던 문제(시간이 쌓인 문제)는 종료해도 지우지 않는다', () => {
    const ev = run(open, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 30 * S },
      { type: 'jump', to: 0, t: 40 * S }, // 2번에 10초 있다가 1번으로
      { type: 'jump', to: 1, t: 45 * S }, // 다시 2번으로
      { type: 'end', t: 60 * S },
    ])
    const sum = summarize(open, ev)
    expect(sum.questions).toHaveLength(2)
    expect(sum.questions[1].ms).toBe(25 * S)
  })

  it('첫 문제에서 바로 종료해도 그 문제는 남긴다', () => {
    const ev = run(open, [
      { type: 'start', t: 0 },
      { type: 'end', t: 15 * S },
    ])
    expect(summarize(open, ev).questions).toHaveLength(1)
  })
})

describe('일시정지', () => {
  it('멈춘 동안의 시간은 어떤 문제에도, 총 소요에도 들어가지 않는다', () => {
    const c = cfg(3)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'pause', t: 10 * S }, // 1번 10초 보고 멈춤
      { type: 'resume', t: 70 * S }, // 60초 쉼
      { type: 'tap', t: 80 * S }, // 1번 10초 더 → 완료
      { type: 'end', t: 90 * S },
    ])
    const sum = summarize(c, ev)
    expect(sum.questions[0]).toMatchObject({ ms: 20 * S, status: 'done' })
    expect(sum.pausedMs).toBe(60 * S)
    expect(sum.totalMs).toBe(30 * S)
    expect(sum.questions[0].doneAt).toBe(20 * S) // 완료 시점도 일시정지 시간을 뺀다
  })

  it('멈춘 동안에는 탭·건너뛰기·이동·되돌리기가 안 된다', () => {
    const c = cfg(3)
    const base = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 5 * S },
      { type: 'pause', t: 10 * S },
    ])
    expect(tryAppend(c, base, { type: 'tap', t: 20 * S })).toBeNull()
    expect(tryAppend(c, base, { type: 'skip', t: 20 * S })).toBeNull()
    expect(tryAppend(c, base, { type: 'jump', to: 2, t: 20 * S })).toBeNull()
    expect(tryAppend(c, base, { type: 'pause', t: 20 * S })).toBeNull()
    expect(undo(base)).toBeNull()
    expect(tryAppend(c, base, { type: 'end', t: 20 * S })).not.toBeNull()
  })

  it('계속한 뒤 되돌리기는 일시정지 앞의 탭을 취소한다', () => {
    const c = cfg(3)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 10 * S },
      { type: 'pause', t: 20 * S },
      { type: 'resume', t: 50 * S },
    ])
    const after = undo(ev)!
    expect(after.map((e) => e.type)).toEqual(['start', 'pause', 'resume'])
    const s = replay(3, after)
    expect(s.current).toBe(0)
    expect(s.pausedMs).toBe(30 * S)
  })

  it('일시정지 중에 종료해도 그 시간은 일시정지로 센다', () => {
    const c = cfg(2)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'pause', t: 10 * S },
      { type: 'end', t: 40 * S },
    ])
    const sum = summarize(c, ev)
    expect(sum.pausedMs).toBe(30 * S)
    expect(sum.totalMs).toBe(10 * S)
    expect(sum.questions[0].ms).toBe(10 * S)
  })

  it('화면 경과 시간은 멈춘 동안 그대로다', () => {
    const c = cfg(2)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'pause', t: 10 * S },
    ])
    expect(elapsedMs(replay(2, ev), 100 * S)).toBe(10 * S)
    expect(replay(2, ev).pausedForContinue).toBe(false) // 보통 일시정지 → 버튼 문구: 계속하기
    const resumed = run(c, [...ev, { type: 'resume', t: 40 * S }])
    expect(elapsedMs(replay(2, resumed), 45 * S)).toBe(15 * S)
  })
})

describe('이어풀기 (끝난 시험 다시 열기)', () => {
  it('일시정지 상태로 열리고, [이어서 풀기]를 누르면 보던 문제부터 이어진다', () => {
    const c = cfg(3)
    const ended = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 30 * S }, // 1번 완료
      { type: 'end', t: 50 * S }, // 2번 20초 보다가 종료
    ])
    const opened = continueAfterEnd(ended)!
    const waiting = replay(3, opened)
    expect(waiting.endedAt).toBeNull()
    expect(waiting.pausedAt).toBe(50 * S) // 바로 시작하지 않고 멈춘 상태
    expect(waiting.pausedForContinue).toBe(true) // 버튼 문구: 이어서 풀기
    expect(elapsedMs(waiting, 3000 * S)).toBe(50 * S) // 기다리는 동안 시간이 안 감
    expect(tryAppend(c, opened, { type: 'tap', t: 3000 * S })).toBeNull()
    const cont = run(c, [...opened, { type: 'resume', t: 3600 * S }])
    const s = replay(3, cont)
    expect(s.pausedAt).toBeNull()
    expect(s.pausedForContinue).toBe(false)
    expect(s.current).toBe(1)
    expect(elapsedMs(s, 3610 * S)).toBe(60 * S)
    const done = run(c, [...cont, { type: 'tap', t: 3620 * S }, { type: 'end', t: 3630 * S }])
    const sum = summarize(c, done)
    expect(sum.questions[1].ms).toBe(40 * S) // 종료 전 20초 + 이어서 20초
    expect(sum.totalMs).toBe(80 * S)
    expect(sum.pausedMs).toBe(3550 * S)
  })

  it('끝나지 않은 시험에는 쓸 수 없다', () => {
    expect(continueAfterEnd([{ type: 'start', t: 0 }])).toBeNull()
  })

  it('문항 수 미정 시험도 종료 때 지웠던 빈 문제가 다시 살아나 거기서 이어진다', () => {
    const open = cfg(0, { mode: 'timer', limitMinutes: 0 })
    const ended = run(open, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 30 * S },
      { type: 'end', t: 40 * S },
    ])
    expect(summarize(open, ended).questions).toHaveLength(1)
    const s = replay(0, continueAfterEnd(ended)!)
    expect(s.current).toBe(1)
    expect(s.statuses).toEqual(['done', 'todo'])
  })
})

describe('되돌리기', () => {
  it('직전 이벤트를 취소하면 이전 상태와 정확히 같다', () => {
    const c = cfg(4)
    const base = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 10 * S },
      { type: 'skip', t: 20 * S },
    ])
    const before = replay(4, base)
    for (const e of [
      { type: 'tap', t: 30 * S },
      { type: 'skip', t: 30 * S },
      { type: 'jump', to: 0, t: 30 * S },
    ] as ExamEvent[]) {
      const after = tryAppend(c, base, e)!
      expect(after).not.toBeNull()
      expect(replay(4, undo(after)!)).toEqual(before)
    }
  })

  it('보류 자동 이동도 되돌리면 원래 문제로', () => {
    const c = cfg(2)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'skip', t: 10 * S },
      { type: 'tap', t: 20 * S },
    ])
    expect(replay(2, ev).current).toBe(0)
    expect(replay(2, undo(ev)!).current).toBe(1)
    expect(replay(2, undo(ev)!).statuses).toEqual(['held', 'todo'])
  })

  it('시작과 종료는 되돌리지 않는다', () => {
    expect(undo([{ type: 'start', t: 0 }])).toBeNull()
    expect(undo([{ type: 'start', t: 0 }, { type: 'end', t: 5 }])).toBeNull()
    expect(undo([])).toBeNull()
  })
})

describe('복기 요약', () => {
  it('목표 시간, 평균, 초과 여부', () => {
    const c = cfg(2, { startClock: '09:00', endClock: '09:01' }) // 제한 60초
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 20 * S },
      { type: 'tap', t: 60 * S },
      { type: 'end', t: 90 * S },
    ])
    const sum = summarize(c, ev)
    expect(sum.limitMs).toBe(60 * S)
    expect(sum.targetMs).toBe(30 * S)
    expect(sum.avgMs).toBe(30 * S)
    expect(sum.overMs).toBe(30 * S)
    expect(sum.reviewMs).toBe(30 * S)
  })

  it('목표 시간을 직접 설정하면 추천값 대신 그 값을 쓴다', () => {
    const c = cfg(40, { mode: 'timer', limitMinutes: 80, targetSeconds: 160 }) // PSAT: 40문항 중 30문항 목표
    const ev = run(c, [{ type: 'start', t: 0 }, { type: 'end', t: 10 * S }])
    expect(recommendedTargetMs(c)).toBe(120 * S)
    expect(summarize(c, ev).targetMs).toBe(160 * S)
    expect(summarize(c, ev).targetIsCustom).toBe(true)
    expect(summarize({ ...c, targetSeconds: 0 }, ev).targetMs).toBe(120 * S)
  })

  it('평균은 본 문제만으로, 완료 문항 수도 센다', () => {
    const c = cfg(4)
    const ev = run(c, [
      { type: 'start', t: 0 },
      { type: 'tap', t: 20 * S },
      { type: 'tap', t: 60 * S },
      { type: 'end', t: 60 * S }, // 3·4번은 안 봄
    ])
    const sum = summarize(c, ev)
    expect(sum.avgMs).toBe(30 * S)
    expect(sum.doneCount).toBe(2)
    // 완료 시점: 시작부터 경과 시간. 완료 안 한 문제는 null
    expect(sum.questions.map((q) => q.doneAt)).toEqual([20 * S, 60 * S, null, null])
  })

  it('앱이 백그라운드에 있던 시간도 절대 시각 차이로 정확히 계산', () => {
    const c = cfg(1)
    const t0 = 1_700_000_000_000
    const ev = run(c, [
      { type: 'start', t: t0 },
      { type: 'tap', t: t0 + 47 * 60 * S + 123 },
    ])
    expect(summarize(c, ev, t0 + 50 * 60 * S).questions[0].ms).toBe(47 * 60 * S + 123)
  })
})

describe('포맷', () => {
  it('formatDuration', () => {
    expect(formatDuration(125 * S)).toBe('02:05')
    expect(formatDuration(3725 * S)).toBe('1:02:05')
  })
  it('남은 시간 초과는 + 로', () => {
    expect(formatRemaining(10 * S)).toBe('00:10')
    expect(formatRemaining(-192 * S)).toBe('+03:12')
  })
})
