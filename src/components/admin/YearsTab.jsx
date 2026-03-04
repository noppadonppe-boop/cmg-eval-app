import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { PlusCircle, CalendarDays, Copy, CheckCircle2, AlertCircle } from 'lucide-react'

export default function YearsTab() {
  const { data, addYear, selectedYear, setSelectedYear } = useApp()
  const [input, setInput] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleAdd = () => {
    const yr = parseInt(input, 10)
    if (!yr || yr < 2020 || yr > 2100) {
      showToast('Enter a valid year between 2020 and 2100.', 'error')
      return
    }
    if (data.evaluationYears.includes(yr)) {
      showToast(`Year ${yr} already exists.`, 'error')
      return
    }
    const lastYear = Math.max(...data.evaluationYears)
    const cloneCount = data.staffConfigs.filter((c) => c.year === lastYear).length
    addYear(yr)
    setSelectedYear(yr)
    setInput('')
    showToast(`Year ${yr} created. ${cloneCount} staff config(s) cloned from ${lastYear}.`)
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {toast.type === 'error'
            ? <AlertCircle size={16} className="shrink-0" />
            : <CheckCircle2 size={16} className="shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Add Year */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Add New Evaluation Year</h3>
        <p className="text-xs text-gray-500 mb-4">
          Staff configurations (supervisor, stakeholders, leave quota) from the <strong>most recent year</strong> will be auto-cloned into the new year.
        </p>
        <div className="flex gap-3 items-start">
          <div className="flex-1 max-w-xs">
            <input
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. 2027"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusCircle size={15} />
            Add Year
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2 text-xs text-gray-400">
          <Copy size={12} className="mt-0.5 shrink-0" />
          <span>Auto-clones hierarchy from year: <strong className="text-gray-600">{Math.max(...data.evaluationYears)}</strong></span>
        </div>
      </div>

      {/* Years List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Evaluation Years</h3>
          <p className="text-xs text-gray-500 mt-0.5">{data.evaluationYears.length} year(s) configured</p>
        </div>
        <div className="divide-y divide-gray-100">
          {[...data.evaluationYears].sort((a, b) => b - a).map((yr) => {
            const configCount = data.staffConfigs.filter((c) => c.year === yr).length
            const kpiCount = data.kpis.filter((k) => k.year === yr).length
            const evalCount = data.quarterlyEvaluations.filter((e) => e.year === yr).length
            const isSelected = yr === selectedYear
            return (
              <div key={yr} className={`flex items-center justify-between px-6 py-4 ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'} transition-colors`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                    <CalendarDays size={16} className={isSelected ? 'text-indigo-600' : 'text-gray-500'} />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`}>{yr}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{configCount} staff config(s)</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{kpiCount} KPI(s)</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{evalCount} evaluation(s)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full">Active</span>
                  )}
                  {!isSelected && (
                    <button
                      onClick={() => setSelectedYear(yr)}
                      className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Switch to {yr}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
