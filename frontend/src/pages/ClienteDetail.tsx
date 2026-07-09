import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Cliente, Documento, Espositore, RigaDocumento } from '@/lib/types'
import { TIPO_LABEL } from '@/lib/types'
import { ArrowLeft, Mail, Phone, MapPin, Monitor } from 'lucide-react'

type Tab = 'documenti' | 'postvendita' | 'espositori'

const TIPO_BADGE: Record<string, string> = {
  espositore: 'bg-sky-100 text-sky-700',
  ricambio: 'bg-amber-100 text-amber-700',
  servizio: 'bg-green-100 text-green-700',
  altro: 'bg-slate-100 text-slate-600',
}

export default function ClienteDetail() {
  const { piva } = useParams<{ piva: string }>()
  const navigate = useNavigate()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [documenti, setDocumenti] = useState<Documento[]>([])
  const [espositori, setEspositori] = useState<Espositore[]>([])
  const [righe, setRighe] = useState<RigaDocumento[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('documenti')

  useEffect(() => {
    if (!piva) return
    const decoded = decodeURIComponent(piva)

    Promise.all([
      supabase.from('clienti').select('*').eq('piva', decoded).single(),
      supabase.from('documenti').select('*').or(`piva_cliente.eq.${decoded},piva_cliente_finale.eq.${decoded}`).order('data_documento', { ascending: false }).limit(200),
      supabase.from('espositori').select('*, modelli_espositore(nome)').eq('cliente_piva', decoded),
    ]).then(async ([cRes, dRes, eRes]) => {
      setCliente(cRes.data)
      setDocumenti(dRes.data ?? [])
      setEspositori(eRes.data ?? [])

      const docIds = (dRes.data ?? []).map((d: Documento) => d.id)
      if (docIds.length > 0) {
        const { data: rData } = await supabase
          .from('righe_documento')
          .select('*')
          .in('documento_id', docIds)
          .in('tipo_riga', ['ricambio', 'servizio'])
          .order('documento_id')
        setRighe(rData ?? [])
      }
      setLoading(false)
    })
  }, [piva])

  if (loading) return <div className="p-6 text-slate-400">Caricamento…</div>
  if (!cliente) return <div className="p-6 text-slate-400">Cliente non trovato.</div>

  const fatture = documenti.filter(d => d.tipo === 'FTA')
  const fatturato = fatture.reduce((s, d) => s + (d.totale ?? 0), 0)

  // Raggruppa righe postvendita per documento
  const righePerDoc: Record<string, RigaDocumento[]> = {}
  righe.forEach(r => {
    if (!righePerDoc[r.documento_id]) righePerDoc[r.documento_id] = []
    righePerDoc[r.documento_id].push(r)
  })
  const docConRighe = documenti.filter(d => righePerDoc[d.id])

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'documenti', label: 'Documenti', count: documenti.length },
    { id: 'postvendita', label: 'Postvendita', count: righe.length },
    { id: 'espositori', label: 'Espositori', count: espositori.length },
  ]

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
          {espositori.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-3 py-1">
              <Monitor size={12} /> {espositori.length} espositore{espositori.length > 1 ? 'i' : ''}
            </span>
          )}
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
          { label: 'Fatture emesse', value: fatture.length },
          { label: 'Fatturato totale', value: fatturato > 0 ? `€ ${Math.round(fatturato).toLocaleString('it-IT')}` : '—' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-semibold text-slate-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${tab === t.id ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Documenti */}
      {tab === 'documenti' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
                  <td className="px-4 py-3 text-slate-600">{new Date(d.data_documento).toLocaleDateString('it-IT')}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium bg-slate-100 text-slate-600 rounded px-2 py-0.5">
                      {TIPO_LABEL[d.tipo] ?? d.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{d.numero_documento}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {d.totale != null ? `€ ${d.totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Postvendita */}
      {tab === 'postvendita' && (
        <div className="space-y-3">
          {docConRighe.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              Nessun intervento postvendita trovato
            </div>
          )}
          {docConRighe.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                <span className="text-xs font-medium bg-slate-200 text-slate-600 rounded px-2 py-0.5">
                  {TIPO_LABEL[d.tipo] ?? d.tipo}
                </span>
                <span className="font-mono text-sm text-slate-700">{d.numero_documento}</span>
                <span className="text-xs text-slate-400">{new Date(d.data_documento).toLocaleDateString('it-IT')}</span>
                {d.totale != null && (
                  <span className="ml-auto text-sm font-medium text-slate-600">
                    € {d.totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {righePerDoc[d.id].map(r => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 w-24">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${TIPO_BADGE[r.tipo_riga] ?? ''}`}>
                          {r.tipo_riga}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {r.descrizione ?? '—'}
                        {r.codice_articolo && <span className="ml-2 text-xs text-slate-400 font-mono">{r.codice_articolo}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500 text-xs">
                        {r.quantita != null ? `× ${r.quantita}` : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {r.totale_riga != null ? `€ ${r.totale_riga.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Espositori */}
      {tab === 'espositori' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {espositori.length === 0 ? (
            <p className="text-center py-8 text-slate-400">Nessun espositore registrato</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Matricola</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Modello</th>
                </tr>
              </thead>
              <tbody>
                {espositori.map(e => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono font-medium text-slate-800">{e.matricola}</td>
                    <td className="px-4 py-3 text-slate-600">{e.modelli_espositore?.nome ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
