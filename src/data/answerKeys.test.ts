import { describe, expect, it } from 'vitest'
import data from './answerKeys.json'

// 시험별 문항 수 (공식 정답표 기준)
const COUNT: Record<string, number> = { '5급': 40, '7급': 25, '9급': 20 }
const PSAT = ['언어논리', '자료해석', '상황판단']

describe('답지 데이터 (answerKeys.json)', () => {
  const has = (year: number, exam: string, subject: string, variant = '') =>
    data.keys.some((k) => k.year === year && k.exam === exam && k.subject === subject && k.variant === variant)

  it('5급 PSAT 2005~2026 (2005는 언어·자료만), 2013 외교원이 있다', () => {
    for (let year = 2005; year <= 2026; year++) {
      for (const s of PSAT) {
        if (year === 2005 && s === '상황판단') continue // 2005년엔 상황판단 정답이 공개되지 않음
        expect(has(year, '5급', s), `${year} ${s}`).toBe(true)
      }
    }
    for (const s of PSAT) expect(has(2013, '5급', s, '외교원')).toBe(true)
  })

  it('7급 PSAT·9급 국어·영어 2021~2026 이 있다', () => {
    for (let year = 2021; year <= 2026; year++) {
      for (const s of PSAT) expect(has(year, '7급', s), `${year} ${s}`).toBe(true)
      for (const s of ['국어', '영어']) expect(has(year, '9급', s), `${year} ${s}`).toBe(true)
    }
  })

  it('문항 수가 맞고, 정답은 1~5 (9급은 1~4) 범위다', () => {
    for (const k of data.keys) {
      expect(k.answers, k.id).toHaveLength(COUNT[k.exam])
      const max = k.exam === '9급' ? 4 : 5
      for (const a of k.answers.flat()) {
        expect(a, k.id).toBeGreaterThanOrEqual(1)
        expect(a, k.id).toBeLessThanOrEqual(max)
      }
    }
  })

  it('책형이 둘인 해는 두 책형의 정답 배열이 서로 다르다 (같은 걸 두 번 넣지 않았는지)', () => {
    const groups = new Map<string, string[]>()
    for (const k of data.keys) {
      const g = `${k.year}-${k.variant}-${k.exam}-${k.subject}`
      groups.set(g, [...(groups.get(g) ?? []), k.answers.join('')])
    }
    for (const [g, list] of groups) expect(new Set(list).size, g).toBe(list.length)
  })

  it('정답가안은 최종정답이 공개되지 않은 2005·2007년뿐이다', () => {
    const years = [...new Set(data.keys.filter((k) => k.provisional).map((k) => k.year))].sort()
    expect(years).toEqual([2005, 2007])
  })

  it('id 가 겹치지 않는다', () => {
    const ids = data.keys.map((k) => k.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(147)
  })
})
