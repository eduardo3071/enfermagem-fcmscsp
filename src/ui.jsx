import { Heart } from 'lucide-react'
import { DISCLAIMER } from './config.js'

export function Brand() {
  return (
    <div className="text-center mb-6">
      <div className="inline-flex items-center gap-2 text-emerald-600 font-semibold text-xl">
        <Heart className="w-6 h-6" /> Desafio 30 Dias
      </div>
      <p className="text-base text-slate-400 mt-1">Vida Saudável em grupo</p>
    </div>
  )
}

export const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 ${className}`}>{children}</div>
)

export const PrimaryBtn = ({ children, className = '', ...p }) => (
  <button {...p}
    className={`w-full h-12 rounded-lg bg-emerald-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition ${className}`}>
    {children}
  </button>
)

export const Field = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs text-slate-500 mb-1">{label}</span>
    {children}
  </label>
)

export const inputCls = 'w-full h-12 px-3 rounded-lg border border-slate-200 bg-slate-50 text-base outline-none focus:border-emerald-400'

export const Disclaimer = () => <p className="text-[11px] text-slate-400 text-center mt-5">{DISCLAIMER}</p>

export const TONES = {
  emerald: 'bg-emerald-100 text-emerald-700',
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
}
