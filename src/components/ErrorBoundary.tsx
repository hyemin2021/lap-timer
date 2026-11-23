import { Component, type ReactNode } from 'react'
import { addHistory, clearActive, loadActive } from '../lib/storage'

interface State {
  error: Error | null
}

/**
 * 화면 코드에서 오류가 나도 흰 화면으로 멈추지 않게 하는 안전망.
 * 저장된 기록(localStorage)은 건드리지 않는다. 진행 중이던 시험도 다시 열면 이어진다.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="setup">
        <h1>문제가 생겼어요</h1>
        <p className="tagline">기록은 저장되어 있어요. 다시 불러오면 이어서 쓸 수 있어요.</p>
        <div className="actions">
          <button className="btn primary" onClick={() => location.reload()}>
            다시 불러오기
          </button>
        </div>
        {loadActive() && (
          <>
            <p className="hint">다시 불러와도 같은 문제가 생기면, 진행 중이던 시험을 지금까지의 기록으로 마무리하고 처음 화면으로 가세요.</p>
            <div className="actions">
              <button
                className="btn"
                onClick={() => {
                  const s = loadActive()
                  if (s) addHistory({ ...s, events: [...s.events, { type: 'end', t: Date.now() }] })
                  clearActive()
                  location.reload()
                }}
              >
                진행 중인 시험 마무리하고 처음으로
              </button>
            </div>
          </>
        )}
        <p className="hint">{this.state.error.message}</p>
      </main>
    )
  }
}
