import { useState } from 'react'
import { type ExamConfig, formatDuration, limitMs, rangeLabel, recommendedTargetMs } from '../lib/timer'
import { DEFAULT_CONFIG, type Preset, loadLastConfig, loadPresets, newId, savePresets } from '../lib/storage'

interface Props {
  onStart: (config: ExamConfig) => void
  onBack: () => void
}

export function SetupScreen({ onStart, onBack }: Props) {
  const [c, setC] = useState<ExamConfig>(loadLastConfig)
  const [presets, setPresets] = useState<Preset[]>(loadPresets)
  // 끝 문항은 입력 중에 시작 문항보다 작을 수 있어서 따로 들고 있다. 문항 수 = 끝 - 시작 + 1
  const [lastQ, setLastQ] = useState(() => c.firstQuestion + c.questionCount - 1)
  const setRange = (first: number, last: number) => {
    setLastQ(last)
    setC((p) => ({ ...p, firstQuestion: first, questionCount: first > 0 && last >= first ? last - first + 1 : 0 }))
  }

  const set = <K extends keyof ExamConfig>(k: K, v: ExamConfig[K]) => setC((p) => ({ ...p, [k]: v }))
  const lim = limitMs(c)
  const valid = c.firstQuestion >= 1 && c.questionCount >= 1 && c.questionCount <= 200 && Number.isFinite(lim)
  const rec = recommendedTargetMs(c)
  const setTarget = (min: number, sec: number) =>
    set('targetSeconds', Math.max(0, Math.floor(min)) * 60 + Math.min(59, Math.max(0, Math.floor(sec))))

  const savePreset = () => {
    const name = c.name.trim() || rangeLabel(c)
    const next = [{ id: newId(), config: { ...c, name } }, ...presets.filter((p) => p.config.name !== name)]
    setPresets(next)
    savePresets(next)
  }
  const removePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id)
    setPresets(next)
    savePresets(next)
  }

  return (
    <main className="setup">
      <header className="setup-head">
        <button className="btn small" onClick={onBack}>
          ←
        </button>
        <h1>시험 설정</h1>
      </header>

      {presets.length > 0 && (
        <section className="card">
          <h2>프리셋</h2>
          <div className="chips">
            {presets.map((p) => (
              <span key={p.id} className="chip">
                <button className="chip-main" onClick={() => {
                    setC({ ...DEFAULT_CONFIG, ...p.config })
                    setLastQ(p.config.firstQuestion + p.config.questionCount - 1)
                  }}>
                  {p.config.name}
                </button>
                <button className="chip-x" aria-label={`${p.config.name} 삭제`} onClick={() => removePreset(p.id)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="card form">
        <div className="seg" role="radiogroup" aria-label="시간 표시 방식">
          <button role="radio" aria-checked={c.mode === 'timer'} className={c.mode === 'timer' ? 'on' : ''} onClick={() => set('mode', 'timer')}>
            타이머식
          </button>
          <button role="radio" aria-checked={c.mode === 'clock'} className={c.mode === 'clock' ? 'on' : ''} onClick={() => set('mode', 'clock')}>
            시계식
          </button>
        </div>
        <p className="hint">
          {c.mode === 'timer'
            ? '00:00부터 숫자가 올라가는 스톱워치예요.'
            : '시험장 벽시계가 시작 시각부터 흘러가요. 밤에 연습해도 시작 시각에서 출발해요.'}
        </p>

        <label>
          시험 이름
          <input value={c.name} placeholder="예: 27 국어 수능" onChange={(e) => set('name', e.target.value)} />
        </label>
        <div className="row">
          <label>
            시작 문항
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={c.firstQuestion || ''}
              onChange={(e) => setRange(Math.floor(Number(e.target.value)) || 0, lastQ)}
            />
          </label>
          <label>
            끝 문항
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={lastQ > 0 ? lastQ : ''}
              onChange={(e) => setRange(c.firstQuestion, Math.floor(Number(e.target.value)) || 0)}
            />
          </label>
        </div>
        <p className="hint">
          {c.questionCount >= 1 ? `${rangeLabel(c)} · ${c.questionCount}문항` : '끝 문항은 시작 문항보다 크거나 같아야 해요.'}
        </p>

        {c.mode === 'timer' ? (
          <label>
            제한시간 (분)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={c.limitMinutes || ''}
              onChange={(e) => set('limitMinutes', Math.floor(Number(e.target.value)) || 0)}
            />
          </label>
        ) : (
          <div className="row">
            <label>
              시작 시각
              <input type="time" value={c.startClock} onChange={(e) => set('startClock', e.target.value)} />
            </label>
            <label>
              종료 시각
              <input type="time" value={c.endClock} onChange={(e) => set('endClock', e.target.value)} />
            </label>
          </div>
        )}

        <p className="limit">
          제한시간 <strong>{Number.isFinite(lim) ? formatDuration(lim) : '—'}</strong>
        </p>

        <div className="target">
          <span className="target-title">문제당 목표 시간</span>
          <div className="target-inputs">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label="목표 분"
              placeholder={valid ? String(Math.floor(rec / 60000)) : ''}
              value={c.targetSeconds > 0 ? Math.floor(c.targetSeconds / 60) : ''}
              onChange={(e) => setTarget(Number(e.target.value) || 0, c.targetSeconds % 60)}
            />
            <span>분</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              aria-label="목표 초"
              placeholder={valid ? String(Math.floor(rec / 1000) % 60) : ''}
              value={c.targetSeconds > 0 ? c.targetSeconds % 60 : ''}
              onChange={(e) => setTarget(Math.floor(c.targetSeconds / 60), Number(e.target.value) || 0)}
            />
            <span>초</span>
          </div>
          <p className="hint">
            {valid && <>추천 {formatDuration(rec)} (제한시간 ÷ 문항 수). </>}
            {c.targetSeconds > 0 ? (
              <button className="link small" onClick={() => set('targetSeconds', 0)}>
                추천값으로 되돌리기
              </button>
            ) : (
              '비워 두면 추천값을 써요.'
            )}
          </p>
        </div>
      </section>

      <div className="actions">
        <button className="btn ghost" onClick={savePreset} disabled={!valid}>
          프리셋으로 저장
        </button>
        <button className="btn primary" onClick={() => onStart(c)} disabled={!valid}>
          시작
        </button>
      </div>
    </main>
  )
}
