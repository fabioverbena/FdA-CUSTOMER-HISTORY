import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Link2 } from 'lucide-react'

const GRENKE_PIVA = '13187000156'

interface DocRow {
  id: string
  numero_documento: string
  data_documento: string
  totale: number | null
  piva_cliente_finale: string | null
}

interface ClienteMin {
  piva: string
  ragione_sociale: string
  comune: string | null
  sigla_provincia: string | null
}

interface RowProps {
  doc: DocRow
  onAssign: (docId: string, piva: string | null) => Promise<void>
  saved: boolean
}

function GrenkeRow({ doc, onAssign, saved }: RowProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ClienteMin[]>([])
  const [assignedName, setAssignedName] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Carica nome del cliente già assegnato
  useEffect(() => {
    if (!doc.piva_cliente_finale) { setAssignedName(null); return }
    supabase.from('clienti').select('ragione_sociale').eq('piva', doc.piva_cliente_finale).single()
      .then(({ data }) => setAssignedName(data?.ragione_sociale ?? doc.piva_cliente_finale))
  }, [doc.piva_cliente_finale])

  // Ricerca server-side con debounce
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('clienti')
        .select('piva,ragione_sociale,comune,sigla_provincia')
        .or(`ragione_sociale.ilike.%${query.trim()}%,piva.ilike.%${query.trim()}%,comune.ilike.%${query.trim()}%`)
        .neq('piva', GRENKE_PIVA)
        .order('ragione_sociale')
        .limit(20)
      setResults((data ?? []) as ClienteMin[])
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Chiudi dropdown al click esterno
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function select(c: ClienteMin) {
    setAssignedName(c.ragione_sociale)
    setQuery('')
    setOpen(false)
    await onAssign(doc.id, c.piva)
  }

  async function rimuovi() {
    setAssignedName(null)
    await onAssign(doc.id, null)
  }

  return (
    <tr className={`border-b border-slate-100 last:border-0 transition-colors duration-500 ${saved ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
        {new Date(doc.data_documento).toLocaleDateString('it-IT')}
      </td>
      <td className="px-4 py-3 font-mono text-slate-700 text-xs">{doc.numero_documento}</td>
      <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
        {doc.totale != null
          ? `€ ${doc.totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
          : '—'}
      </td>
      <td className="px-4 py-3 min-w-80">
        <div ref={ref} className="relative">
          {/* Modalità visualizzazione — cliente assegnato */}
          {assignedName && !open ? (
            <div className="flex items-center gap-2 group">
              <span className="bg-sky-50 border border-sky-200 text-sky-700 rounded-lg px-2.5 py-1 text-sm font-medium truncate max-w-56">
                {assignedName}
              </span>
              <button onClick={() => { setOpen(true) }}
                className="text-xs text-slate-400 hover:text-sky-500 shrink-0 transition-colors">
                modifica
              </button>
              <button onClick={rimuovi}
                className="text-xs text-slate-300 hover:text-red-400 shrink-0 transition-colors">
                ✕
              </button>
            </div>
          ) : (
            /* Modalità ricerca */
            <>
              <input
                autoFocus={open}
                value={query}
                onChange={e => { setQuery(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
                placeholder={assignedName ?? 'Cerca per nome, PIVA o comune…'}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-400"
              />
              {open && query.trim().length >= 2 && (
                <div className="absolute z-20 top-full mt-1 w-full max-h-64 overflow-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                  {results.length > 0 ? results.map(c => (
                    <button key={c.piva}
                      onMouseDown={() => select(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-sky-50 border-b border-slate-100 last:border-0 transition-colors"
                    >
                      <p className="text-sm text-slate-800 font-medium">{c.ragione_sociale}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {c.piva}{c.comune ? ` · ${c.comune}` : ''}{c.sigla_provincia ? ` (${c.sigla_provincia})` : ''}
                      </p>
                    </button>
                  )) : (
                    <div className="px-3 py-3 text-sm text-slate-400">Nessun cliente trovato</div>
                  )}
                </div>
              )}
              {open && query.trim().length < 2 && query.trim().length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5">
                  <p className="text-xs text-slate-400">Digita almeno 2 caratteri…</p>
                </div>
              )}
            </>
          )}
        </div>
      </td>
      <td className="px-4 py-3 w-6 text-center">
        {saved && <span className="text-green-500">✓</span>}
      </td>
    </tr>
  )
}

export default function Grenke() {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  useEffect(() => {
    supabase
      .from('documenti')
      .select('id,numero_documento,data_documento,totale,piva_cliente_finale')
      .eq('piva_cliente', GRENKE_PIVA)
      .order('data_documento', { ascending: false })
      .then(({ data }) => {
        setDocs((data ?? []) as DocRow[])
        setLoading(false)
      })
  }, [])

  async function onAssign(docId: string, piva: string | null) {
    await supabase.from('documenti').update({ piva_cliente_finale: piva }).eq('id', docId)
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, piva_cliente_finale: piva } : d))
    setSaved(prev => ({ ...prev, [docId]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [docId]: false })), 2000)
  }

  if (loading) return <div className="p-6 text-slate-400">Caricamento…</div>

  const assegnati = docs.filter(d => d.piva_cliente_finale).length
  const nonAssegnati = docs.length - assegnati

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Link2 size={18} className="text-slate-400" />
        <h1 className="text-xl font-semibold text-slate-800">Assegnazioni GRENKE</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Collega il cliente reale (locatario) a ciascuna fattura GRENKE.{' '}
        <span className="font-medium text-slate-600">{assegnati}/{docs.length} assegnate</span>
        {nonAssegnati > 0 && (
          <span className="ml-2 text-amber-600 font-medium">· {nonAssegnati} da completare</span>
        )}
      </p>

      <div className="bg-white rounded-xl border border-slate-200 overflow-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Data</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Numero</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Importo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Cliente reale (locatario)</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <GrenkeRow key={d.id} doc={d} onAssign={onAssign} saved={saved[d.id] ?? false} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
