import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Cliente, Documento, Espositore } from '@/lib/types'
import { TIPO_LABEL } from '@/lib/types'
import { ArrowLeft, Mail, Phone, MapPin, Monitor } from 'lucide-react'

export default function ClienteDetail() {
  const { piva } = useParams<{ piva: string }>()
  const navigate  = useNavigate()
  const [cliente, setCliente]       = useState<Cliente | null>(null)
  const [documenti, setDocumenti]   = useState<Documento[]>([])
  const [espositori, setEspositori] = useState<Espositore[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!piva) return
    const decoded = decodeURIComponent(piva)

    Promise.all([
      supabase.from('clienti').select('*').eq('piva', decoded).single(),
      supabase.from('documenti').select('*').eq('cliente_piva', decoded).order('data_documento', { ascending: false }).limit(100),
      supabase.from('espositori').select('*, modelli_espositore(nome)').eq('cliente_piva', decoded),
    ]).then(([cRes, dRes, eRes]) => {
      setCliente(cRes.data)
      setDocumenti(dRes.data ?? [])
      setEspositori(eRes.data ?? [])
      setLoading(false)
    })
  }, [piva])

  if (loading) return <div className="p-6 text-slate-400">Caricamento…</div>
  if (!cliente) return <div className="p-6 text-slate-400">Cliente non trovato.</div>

  const fatture  = documenti.filter(d => d.tipo === 'FTA')
  const fatturato = fatture.reduce((s, d) => s + (d.importo_totale ?? 0), 0)

  return (
    <div className="p-6 max-w-5xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> Indietro
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{cliente.ragione_sociale}</h1>
            <p className="text-sm text-slate-400 font-mono mt-0.5">{cliente.piva}</p>
          </div>
          <div className="flex gap-2">
            {espositori.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-3 py-1">
                <Monitor size={12} /> {espositori.length} espositore{espositori.length > 1 ? 'i' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-600">
          {cliente.indirizzo && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-400" />
              {cliente.indirizzo}, {cliente.cap} {cliente.comune} ({cliente.sigla_provincia ?? cliente.provincia})
            </span>
          )}
          {cliente.email && (
            <a href={`mailto:${cliente.email}`} className="flex items-center gap-1.5 text-sky-600 hover:underline">
              <Mail size={14} /> {cliente.email}
            </a>
          )}
          {cliente.telefono && (
            <span className="flex items-center gap-1.5">
              <Phone size={14} className="text-slate-400" /> {cliente.telefono}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Documenti', value: documenti.length },
          { label: 'Fatture', value: fatture.length },
          { label: 'Fatturato totale', value: fatturato > 0 ? `€ ${fatturato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-semibold text-slate-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Espositori */}
      {espositori.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Espositori</h2>
          <div className="flex flex-wrap gap-2">
            {espositori.map(e => (
              <span key={e.id} className="text-sm bg-slate-100 text-slate-700 rounded-lg px-3 py-1.5">
                <span className="font-mono">{e.matricola}</span>
                {e.modelli_espositore && <span className="text-slate-400 ml-1.5">· {e.modelli_espositore.nome}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Documenti */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Storico documenti</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Data</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Numero</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Importo</th>
            </tr>
          </thead>
          <tbody>
            {documenti.length === 0 && (
              <tr><td colSpan={4} className="text-center py-6 text-slate-400">Nessun documento</td></tr>
            )}
            {documenti.map(d => (
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
                <td className="px-4 py-3 text-right text-slate-700">
                  {d.importo_totale != null
                    ? `€ ${d.importo_totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
