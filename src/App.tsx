import { useState } from 'react'
import { ExamScreen } from './screens/ExamScreen'
import { IntroScreen } from './screens/IntroScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { SetupScreen } from './screens/SetupScreen'
import {
  type Session,
  addHistory,
  clearActive,
  deleteHistory,
  loadActive,
  newId,
  saveActive,
  saveLastConfig,
} from './lib/storage'
import type { ExamConfig } from './lib/timer'
import { keepAwake } from './lib/keepAwake'

type View =
  | { kind: 'intro' }
  | { kind: 'setup' }
  | { kind: 'exam'; session: Session }
  | { kind: 'review'; session: Session }

/** 앱을 켰을 때 진행 중인 시험이 있으면 그대로 이어서 진행 */
function initialView(): View {
  const active = loadActive()
  return active ? { kind: 'exam', session: active } : { kind: 'intro' }
}

export default function App() {
  const [view, setView] = useState<View>(initialView)
  const home = () => setView({ kind: 'intro' })

  switch (view.kind) {
    case 'intro':
      return (
        <IntroScreen onPlay={() => setView({ kind: 'setup' })} onOpenHistory={(s) => setView({ kind: 'review', session: s })} />
      )

    case 'setup': {
      const start = (config: ExamConfig) => {
        keepAwake() // [시작]을 누른 순간 화면 꺼짐 방지 켜기
        saveLastConfig(config)
        const session: Session = { id: newId(), config, events: [{ type: 'start', t: Date.now() }] }
        saveActive(session)
        setView({ kind: 'exam', session })
      }
      return <SetupScreen onStart={start} onBack={home} />
    }

    case 'exam': {
      const { session } = view
      return (
        <ExamScreen
          key={session.id}
          session={session}
          onChange={(events) => saveActive({ ...session, events })}
          onEnd={(events) => {
            const done = { ...session, events }
            addHistory(done)
            clearActive()
            setView({ kind: 'review', session: done })
          }}
        />
      )
    }

    case 'review':
      return (
        <ReviewScreen
          session={view.session}
          onHome={home}
          onDelete={() => {
            deleteHistory(view.session.id)
            home()
          }}
        />
      )
  }
}
