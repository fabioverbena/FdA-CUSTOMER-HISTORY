import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/lib/types'
import { Search, ChevronRight } from 'lucide-react'

const PAGE = 50

export default function Clienti() {
  const navigate = useNavigate()
  const [query, setQuery]       = useState('')
  const [clienti, setClienti]   = useState<Cliente[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(0)
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true)
    let builder = supabase
      .from('clienti')
      .select('*', { count: 'exact' })
      .order('ragione_sociale')
      .range(p * PAGE, p * PAGE + PAGE - 1)

    if (q.trim()) {
      const like = `%${q.trim()}%`
      builder = builder.or(
        `ragione_sociale.ilike.${like},piva.ilike.${like},comune.ilike.${like}`
      )
    }

    const { data, count, error } = await builder
    if (!error) {
      setClienti(data ?? [])
      setTotal(count ?? 0)
    }
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
          <h1 className="text-xl font-semibold text-slate-800">Clienti</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString()} clienti totali</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca per nome, PIVA, comune…"
            className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Ragione sociale</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">PIVA</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Comune</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Provincia</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Regione</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Caricamento…</td></tr>
            )}
            {!loading && clienti.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nessun risultato</td></tr>
            )}
            {!loading && clienti.map(c => (
              <tr
                key={c.piva}
                onClick={() => navigate(`/clienti/${encodeURIComponent(c.piva)}`)}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-medium text-slate-800">{c.ragione_sociale}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.piva}</td>
                <td className="px-4 py-3 text-slate-600">{c.comune ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.sigla_provincia ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.regione ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400"><ChevronRight size={14} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-slate-500">
            Pagina {page + 1} di {pages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Precedente
            </button>
            <button
              disabled={page >= pages - 1}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Successiva
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
