import { AlertTriangle } from 'lucide-react'

export const SCORE_BANDS = [
  { min: 0,  max: 5,  label: 'Poor',          short: 'Poor',    trackColor: 'bg-red-500',    thumbRing: 'ring-red-400',    textColor: 'text-red-600',    badgeBg: 'bg-red-50',    badgeBorder: 'border-red-200',    badgeText: 'text-red-700'    },
  { min: 6,  max: 9,  label: 'Below Average',  short: 'Below',   trackColor: 'bg-orange-400', thumbRing: 'ring-orange-400', textColor: 'text-orange-600', badgeBg: 'bg-orange-50', badgeBorder: 'border-orange-200', badgeText: 'text-orange-700' },
  { min: 10, max: 14, label: 'Average',         short: 'Avg',     trackColor: 'bg-yellow-400', thumbRing: 'ring-yellow-400', textColor: 'text-yellow-600', badgeBg: 'bg-yellow-50', badgeBorder: 'border-yellow-200', badgeText: 'text-yellow-700' },
  { min: 15, max: 18, label: 'Good',            short: 'Good',    trackColor: 'bg-green-500',  thumbRing: 'ring-green-400',  textColor: 'text-green-600',  badgeBg: 'bg-green-50',  badgeBorder: 'border-green-200',  badgeText: 'text-green-700'  },
  { min: 19, max: 20, label: 'Excellent',       short: 'Excel',   trackColor: 'bg-indigo-500', thumbRing: 'ring-indigo-400', textColor: 'text-indigo-600', badgeBg: 'bg-indigo-50', badgeBorder: 'border-indigo-200', badgeText: 'text-indigo-700' },
]

export function getBand(score) {
  return SCORE_BANDS.find((b) => score >= b.min && score <= b.max) || SCORE_BANDS[0]
}

export const COMMENT_REQUIRED = (score) => score < 10 || score > 18

export default function ScoreSlider({ label, score, comment, onScoreChange, onCommentChange, disabled = false }) {
  const band = getBand(score)
  const needsComment = COMMENT_REQUIRED(score)
  const pct = (score / 20) * 100

  return (
    <div className={`rounded-xl border p-4 transition-all ${band.badgeBg} ${band.badgeBorder}`}>
      {/* Label row */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{label}</p>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shrink-0 ${band.badgeBg} ${band.badgeBorder} ${band.badgeText}`}>
          <span className={`w-2 h-2 rounded-full ${band.trackColor}`} />
          <span className="text-lg font-extrabold">{score}</span>
          <span className="font-medium opacity-70">/ 20 · {band.label}</span>
        </div>
      </div>

      {/* Slider track */}
      <div className="relative mb-1">
        {/* Color zone markers */}
        <div className="flex h-1.5 rounded-full overflow-hidden mb-3">
          <div className="bg-red-400"    style={{ width: '30%' }} />
          <div className="bg-orange-400" style={{ width: '20%' }} />
          <div className="bg-yellow-400" style={{ width: '25%' }} />
          <div className="bg-green-500"  style={{ width: '20%' }} />
          <div className="bg-indigo-500" style={{ width: '5%'  }} />
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={score}
          disabled={disabled}
          onChange={(e) => onScoreChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, ${getComputedTrackColor(score)} ${pct}%, #e5e7eb ${pct}%)`,
          }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-[10px] text-gray-400 font-medium mt-1 mb-3 px-0.5">
        <span>0</span>
        <span className="text-red-400">5</span>
        <span className="text-orange-400">9</span>
        <span className="text-yellow-500">14</span>
        <span className="text-green-500">18</span>
        <span className="text-indigo-500">20</span>
      </div>

      {/* Mandatory comment */}
      {needsComment && (
        <div className="mt-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle size={12} className="text-amber-500 shrink-0" />
            <p className="text-xs font-semibold text-amber-600">
              Comment required for scores {score < 10 ? '< 10' : '> 18'}
            </p>
          </div>
          <textarea
            rows={2}
            disabled={disabled}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder={
              score < 10
                ? 'Explain why this score is below average...'
                : 'Justify this excellent score with specific examples...'
            }
            className={`w-full px-3 py-2 text-sm rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white disabled:bg-gray-50 disabled:text-gray-500 ${
              !comment.trim() ? 'border-amber-400' : 'border-gray-300'
            }`}
          />
          {!comment.trim() && (
            <p className="text-xs text-amber-600 mt-1">↑ This comment is required before you can save.</p>
          )}
        </div>
      )}

      {/* Optional comment when not required */}
      {!needsComment && (
        <textarea
          rows={1}
          disabled={disabled}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Optional comment..."
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white/60 disabled:bg-gray-50 disabled:text-gray-500 placeholder:text-gray-300"
        />
      )}
    </div>
  )
}

function getComputedTrackColor(score) {
  if (score <= 5)  return '#ef4444'
  if (score <= 9)  return '#fb923c'
  if (score <= 14) return '#facc15'
  if (score <= 18) return '#22c55e'
  return '#6366f1'
}
