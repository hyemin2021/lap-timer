import { describe, expect, it } from 'vitest'
import data from './answerKeys.json'

// 시험별 문항 수 (공식 정답표 기준)
const COUNT: Record<string, number> = { '5급': 40, '7급': 25, '9급': 20 }

describe('답지 데이터 (answerKeys.json)', () => {
  it('2021~2026 5급·7급 PSAT 3영역, 9급 국어·영어가 모두 있다', () => {
    for (let year = 2021; year <= 2026; year++) {
      for (const s of ['언어논리', '자료해석', '상황판단']) {
        expect(data.keys.some((k) => k.year === year && k.exam === '5급' && k.subject === s)).toBe(true)
        expect(data.keys.some((k) => k.year === year && k.exam === '7급' && k.subject === s)).toBe(true)
      }
      for (const s of ['국어', '영어']) {
        expect(data.keys.some((k) => k.year === year && k.exam === '9급' && k.subject === s)).toBe(true)
      }
    }
    expect(data.keys).toHaveLength(48)
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

  it('id 가 겹치지 않는다', () => {
    const ids = data.keys.map((k) => k.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
