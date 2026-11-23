import { useEffect, useState } from 'react'

/** intervalMs 마다 현재 시각(Date.now)을 갱신 */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs, enabled])
  return now
}
