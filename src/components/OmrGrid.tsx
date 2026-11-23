import type { QuestionStatus } from '../lib/timer'

interface Props {
  statuses: QuestionStatus[]
  current: number | null
  onPick: (q: number) => void
  onClose: () => void
}

/** OMR 카드 같은 문항 그리드. 보류 문항을 표시하고, 탭하면 그 문제로 이동 */
export function OmrGrid({ statuses, current, onPick, onClose }: Props) {
  const held = statuses.filter((s) => s === 'held').length
  return (
    <div className="omr-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="omr">
        <div className="omr-head">
          <span>문항 이동 {held > 0 && <em>· 보류 {held}개</em>}</span>
          <button className="btn small" onClick={onClose}>닫기</button>
        </div>
        <div className="omr-grid">
          {statuses.map((s, i) => (
            <button
              key={i}
              className={`omr-cell ${s} ${i === current ? 'current' : ''}`}
              onClick={() => onPick(i)}
              aria-label={`${i + 1}번 ${s === 'done' ? '완료' : s === 'held' ? '보류' : '미응답'}`}
            >
              <span className="omr-no">{i + 1}</span>
              <span className="omr-bubble" />
            </button>
          ))}
        </div>
        <div className="omr-legend">
          <span><i className="dot done" />완료</span>
          <span><i className="dot held" />보류</span>
          <span><i className="dot todo" />안 봄</span>
        </div>
      </div>
    </div>
  )
}
