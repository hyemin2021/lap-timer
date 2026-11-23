import { useRef } from 'react'

/**
 * 길게 누르기. ms 동안 손을 떼지 않으면 onLongPress 실행.
 * 반환값을 요소에 펼쳐서({...handlers}) 붙인다.
 */
export function useLongPress(onLongPress: () => void, ms = 700, onProgress?: (pressing: boolean) => void) {
  const timer = useRef<number | null>(null)

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
      onProgress?.(false)
    }
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation()
      cancel()
      onProgress?.(true)
      timer.current = window.setTimeout(() => {
        timer.current = null
        onProgress?.(false)
        onLongPress()
      }, ms)
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.stopPropagation()
      cancel()
    },
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}
