import { useState } from 'react'
import { AnswersScreen } from './screens/AnswersScreen'
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
  QUICK_CONFIG,
} from './lib/storage'
import { type ExamConfig, continueAfterEnd } from './lib/timer'
import { keepAwake } from './lib/keepAwake'

type View =
  | { kind: 'intro' }
  | { kind: 'setup' }
  | { kind: 'answers' }
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

  const startExam = (config: ExamConfig) => {
    keepAwake() // [시작]을 누른 순간 화면 꺼짐 방지 켜기
    const session: Session = { id: newId(), config, events: [{ type: 'start', t: Date.now() }] }
    saveActive(session)
    setView({ kind: 'exam', session })
  }

  switch (view.kind) {
    case 'intro':
      return (
        <IntroScreen
          onPlay={(quick) => (quick ? startExam(QUICK_CONFIG) : setView({ kind: 'setup' }))}
          onOpenHistory={(s) => setView({ kind: 'review', session: s })}
          onAnswers={() => setView({ kind: 'answers' })}
        />
      )

    case 'answers':
      return <AnswersScreen onBack={home} />

    case 'setup': {
      const start = (config: ExamConfig) => {
        saveLastConfig(config)
        startExam(config)
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
          onContinue={() => {
            // 끝낸 시각~지금은 일시정지로 처리하고, 같은 기록(id)을 다시 진행 중으로 연다.
            // 다시 종료하면 기록 목록의 같은 항목이 새 결과로 바뀐다.
            const events = continueAfterEnd(view.session.events, Date.now())
            if (!events) return
            keepAwake()
            const session = { ...view.session, events }
            saveActive(session)
            setView({ kind: 'exam', session })
          }}
        />
      )
  }
}
