/**
 * localStorage 저장소.
 * - active : 진행 중인 시험 (이벤트마다 즉시 저장 → 새로고침/앱 종료 후에도 이어서 진행)
 * - history: 끝난 시험 기록 (복기 화면에서 다시 보기)
 * - presets: 시험 설정 프리셋
 */
import { DEFAULT_DEBOUNCE_MS, type ExamConfig, type ExamEvent } from './timer'

export interface Session {
  id: string
  config: ExamConfig
  events: ExamEvent[]
}

export interface Preset {
  id: string
  config: ExamConfig
}

const KEY_ACTIVE = 'laptimer.active'
const KEY_HISTORY = 'laptimer.history'
const KEY_PRESETS = 'laptimer.presets'
const KEY_LAST_CONFIG = 'laptimer.lastConfig'
const KEY_QUICK_START = 'laptimer.quickStart'
const HISTORY_LIMIT = 50

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장 공간 부족 등: 조용히 무시 (시험 진행은 메모리에서 계속됨)
  }
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const DEFAULT_CONFIG: ExamConfig = {
  name: '',
  firstQuestion: 1,
  questionCount: 45,
  mode: 'timer',
  limitMinutes: 80,
  startClock: '08:40',
  endClock: '10:00',
  targetSeconds: 0,
  debounceMs: DEFAULT_DEBOUNCE_MS,
}

/** 예전 형식(mode: basic/real)으로 저장된 설정도 읽을 수 있게 맞춰준다 */
export function normalizeConfig(raw: Partial<ExamConfig>): ExamConfig {
  const oldMode: string | undefined = raw.mode
  const mode = oldMode === 'clock' || oldMode === 'real' ? 'clock' : 'timer'
  // 연속 탭 무시 간격은 화면에서 고르지 않으므로, 저장된 값 대신 항상 코드의 상수를 쓴다
  return { ...DEFAULT_CONFIG, ...raw, mode, debounceMs: DEFAULT_DEBOUNCE_MS }
}
const normalizeSession = (s: Session): Session => ({ ...s, config: normalizeConfig(s.config) })

export const loadActive = () => {
  const s = read<Session | null>(KEY_ACTIVE, null)
  return s ? normalizeSession(s) : null
}
export const saveActive = (s: Session) => write(KEY_ACTIVE, s)
export const clearActive = () => localStorage.removeItem(KEY_ACTIVE)

export const loadHistory = () => read<Session[]>(KEY_HISTORY, []).map(normalizeSession)
export function addHistory(s: Session): void {
  const list = loadHistory().filter((x) => x.id !== s.id)
  write(KEY_HISTORY, [s, ...list].slice(0, HISTORY_LIMIT))
}
export function deleteHistory(id: string): void {
  write(KEY_HISTORY, loadHistory().filter((x) => x.id !== id))
}

export const loadPresets = () => read<Preset[]>(KEY_PRESETS, []).map((p) => ({ ...p, config: normalizeConfig(p.config) }))
export const savePresets = (p: Preset[]) => write(KEY_PRESETS, p)

export const loadLastConfig = (): ExamConfig => normalizeConfig(read<Partial<ExamConfig>>(KEY_LAST_CONFIG, {}))
export const saveLastConfig = (c: ExamConfig) => write(KEY_LAST_CONFIG, c)

export const loadQuickStart = () => read<boolean>(KEY_QUICK_START, false)
export const saveQuickStart = (v: boolean) => write(KEY_QUICK_START, v)

/** 설정 없이 바로 시작할 때 쓰는 설정: 이름·문항 수·제한시간 없음, 스톱워치 */
export const QUICK_CONFIG: ExamConfig = {
  ...DEFAULT_CONFIG,
  name: '',
  firstQuestion: 1,
  questionCount: 0,
  mode: 'timer',
  limitMinutes: 0,
  targetSeconds: 0,
}
