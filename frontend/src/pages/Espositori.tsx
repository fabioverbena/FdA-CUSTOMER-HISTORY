import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Espositore } from '@/lib/types'
import { Search, ChevronRight } from 'lucide-react'

const PAGE = 50

export default function Espositori() {
  const navigate = useNavigate()
  const [query, setQuery]         = useState('')
  const [espositori, setEspositori] = useState<Espositore[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [loading, setLoading]     = useState(false)

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true)
    let builder = supabase
      .from('espositori')
      .select('*, modelli_espositore(nome)', { count: 'exact' })
      .order('matricola')
      .range(p * PAGE, p * PAGE + PAGE - 1)

    if (q.trim()) builder = builder.ilike('matricola', `%${q.trim()}%`)

    const { data, count, error } = await builder
    if (!error) { setEspositori(data ?? []); setTotal(count ?? 0) }
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { setPage(0); load(query, 0) }, 300)
    return () => clearTimeout(t)
  }, [query, load])

  useEffect(() => { load(query, page) }, [page, load, query])

  const pages = Math.ceil(total / PAGE)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Espositori</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString()} espositori totali</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca matricola…"
            className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Matricola</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Modello</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Cliente (PIVA)</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">Caricamento…</td></tr>
            )}
            {!loading && espositori.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">Nessun espositore</td></tr>
            )}
            {!loading && espositori.map(e => (
              <tr
                key={e.id}
                onClick={() => e.cliente_piva && navigate(`/clienti/${encodeURIComponent(e.cliente_piva)}`)}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-mono font-medium text-slate-800">{e.matricola}</td>
                <td className="px-4 py-3 text-slate-600">{e.modelli_espositore?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{e.cliente_piva ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400"><ChevronRight size={14} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-slate-500">Pagina {page + 1} di {pages}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50">
              Precedente
            </button>
            <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50">
              Successiva
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
