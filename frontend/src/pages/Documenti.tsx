import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Documento } from '@/lib/types'
import { TIPO_LABEL } from '@/lib/types'
import { Search } from 'lucide-react'

const PAGE = 50
const TIPI = ['BC', 'FTA', 'PC', 'OC', 'OF', 'BF'] as const

export default function Documenti() {
  const [query, setQuery]       = useState('')
  const [tipo, setTipo]         = useState('')
  const [docs, setDocs]         = useState<Documento[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(0)
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async (q: string, t: string, p: number) => {
    setLoading(true)
    let builder = supabase
      .from('documenti')
      .select('*', { count: 'exact' })
      .order('data_documento', { ascending: false })
      .range(p * PAGE, p * PAGE + PAGE - 1)

    if (q.trim()) builder = builder.ilike('numero_documento', `%${q.trim()}%`)
    if (t)        builder = builder.eq('tipo', t)

    const { data, count, error } = await builder
    if (!error) { setDocs(data ?? []); setTotal(count ?? 0) }
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { setPage(0); load(query, tipo, 0) }, 300)
    return () => clearTimeout(t)
  }, [query, tipo, load])

  useEffect(() => { load(query, tipo, page) }, [page, load, query, tipo])

  const pages = Math.ceil(total / PAGE)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Documenti</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString()} documenti totali</p>
        </div>
        <div className="flex gap-2">
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Tutti i tipi</option>
            {TIPI.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Numero documento…"
              className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Data</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Numero</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Cliente / Fornitore</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Importo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Caricamento…</td></tr>
            )}
            {!loading && docs.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Nessun risultato</td></tr>
            )}
            {!loading && docs.map(d => (
              <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">
                  {new Date(d.data_documento).toLocaleDateString('it-IT')}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 rounded px-2 py-0.5">
                    {TIPO_LABEL[d.tipo] ?? d.tipo}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">{d.numero_documento}</td>
                <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                  {d.piva_cliente ?? d.piva_fornitore ?? '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {d.totale != null
                    ? `€ ${d.totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
                    : '—'}
                </td>
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
