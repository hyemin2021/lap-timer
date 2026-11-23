import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'

// 서비스 워커 등록 → 오프라인에서도 동작, 새 버전이 나오면 자동 갱신
registerSW({ immediate: true })

// 저장된 기록을 브라우저가 공간 정리할 때 지우지 않도록 요청
// (특히 iOS Safari 는 오래 안 쓴 사이트의 저장 데이터를 지울 수 있음. 홈 화면에 설치하면 더 안전)
void navigator.storage?.persist?.().catch(() => {})

// iOS Safari 는 user-scalable=no 를 무시하므로 핀치 확대 제스처를 직접 막는다
document.addEventListener('gesturestart', (e) => e.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
