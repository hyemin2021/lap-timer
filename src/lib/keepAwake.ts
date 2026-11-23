/**
 * 시험 중 화면 꺼짐 방지.
 *
 * 1) Screen Wake Lock API (HTTPS + 지원 기기)
 * 2) 1이 없거나 거부되면(HTTP 로 폰 테스트, 저전력 모드, 구형 iOS 홈 화면 앱 등)
 *    소리 없는 아주 짧은 동영상을 화면 밖에서 반복 재생하는 방식으로 대신한다.
 *    (동영상 데이터는 nosleep.js 라이브러리에 들어 있는 것을 빌려 씀)
 *
 * 브라우저 규칙상 동영상 재생은 "사용자가 누른 순간"에만 시작할 수 있다.
 * 그래서 [시작]·[다음]·[건너뛰기]를 누를 때마다 keepAwake() 를 부른다.
 * 이미 켜져 있으면 아무것도 하지 않으므로 여러 번 불러도 괜찮다.
 */
import media from 'nosleep.js/src/media.js'

let wanted = false
let sentinel: WakeLockSentinel | null = null
let requesting = false
let video: HTMLVideoElement | null = null
/** 네이티브 Wake Lock 이 없거나 한 번 거부됐으면 true → 이후엔 바로 동영상 방식 */
let useVideo = typeof navigator !== 'undefined' && (!('wakeLock' in navigator) || !window.isSecureContext)

function getVideo(): HTMLVideoElement {
  if (video) return video
  const v = document.createElement('video')
  v.setAttribute('playsinline', '')
  v.setAttribute('loop', '')
  v.setAttribute('aria-hidden', 'true')
  Object.assign(v.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', left: '0', top: '0' })
  for (const [type, src] of [['webm', media.webm], ['mp4', media.mp4]] as const) {
    const s = document.createElement('source')
    s.src = src
    s.type = `video/${type}`
    v.appendChild(s)
  }
  document.body.appendChild(v)
  video = v
  return v
}

function playVideo(): void {
  const v = getVideo()
  if (v.paused) v.play().catch(() => {})
}

async function requestNative(): Promise<boolean> {
  if (!('wakeLock' in navigator) || !window.isSecureContext) return false
  try {
    sentinel = await navigator.wakeLock.request('screen')
    // 앱이 백그라운드로 가면 브라우저가 풀어 버린다 → 표시만 지워 두고, 돌아오면 다시 요청
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
    return true
  } catch {
    return false
  }
}

export function keepAwake(): void {
  wanted = true
  if (sentinel || requesting) return
  if (video && !video.paused) return
  // 동영상 방식은 탭한 그 순간에 play() 해야 허용되므로 여기서 바로 재생
  if (useVideo) {
    playVideo()
    return
  }
  requesting = true
  void requestNative().then((ok) => {
    requesting = false
    if (!wanted) {
      void sentinel?.release().catch(() => {})
      sentinel = null
      return
    }
    if (!ok) {
      useVideo = true
      playVideo() // 탭 직후가 아니라 막힐 수 있음 → 그러면 다음 탭에서 다시 시도됨
    }
  })
}

export function allowSleep(): void {
  wanted = false
  void sentinel?.release().catch(() => {})
  sentinel = null
  video?.pause()
}

// 앱으로 돌아왔을 때 Wake Lock 다시 요청 (사용자 탭이 없어도 허용됨)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') keepAwake()
  })
}
