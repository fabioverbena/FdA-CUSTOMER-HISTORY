import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Search, MapPin, Users, TrendingUp, Layers } from 'lucide-react'

type QueryType = 'prodotti_area' | 'clienti_area' | 'top_clienti' | 'storico_espositore'

interface RigaResult {
  descrizione: string | null
  codice_articolo: string | null
  tipo_riga: string
  qta: number
  totale: number
  n_docs: number
}

interface ClienteResult {
  piva: string
  ragione_sociale: string
  comune: string | null
  sigla_provincia: string | null
  n_docs: number
  fatturato: number
}

interface TopClienteResult {
  piva: string
  ragione_sociale: string
  fatturato: number
  n_fatture: number
}

interface EspositoreRiga {
  data_documento: string
  numero_documento: string
  tipo_riga: string
  descrizione: string | null
  quantita: number | null
  totale_riga: number | null
  note: string | null
}

const QUERY_TYPES = [
  { id: 'prodotti_area' as QueryType, label: 'Prodotti per area', desc: 'Quali prodotti sono stati venduti in una regione/periodo', Icon: Layers },
  { id: 'clienti_area' as QueryType, label: 'Clienti per area', desc: 'Elenco clienti in una regione/provincia con fatturato', Icon: MapPin },
  { id: 'top_clienti' as QueryType, label: 'Top clienti periodo', desc: 'Ranking clienti per fatturato in un intervallo di date', Icon: TrendingUp },
  { id: 'storico_espositore' as QueryType, label: 'Storico espositore', desc: 'Tutto il postvendita (ricambi/servizi) per una matricola', Icon: Users },
]

const TIPO_RIGA_OPTS = ['espositore', 'ricambio', 'servizio', 'altro']

export default function Ricerca() {
  const navigate = useNavigate()
  const [queryType, setQueryType] = useState<QueryType>('prodotti_area')
  const [loading, setLoading] = useState(false)
  const [regioni, setRegioni] = useState<string[]>([])

  // Filters
  const [regione, setRegione] = useState('')
  const [province, setProvince] = useState<string[]>([])
  const [provinceOpts, setProvinceOpts] = useState<string[]>([])
  const [dal, setDal] = useState('')
  const [al, setAl] = useState('')
  const [tipiRiga, setTipiRiga] = useState<string[]>(['espositore', 'ricambio', 'servizio'])
  const [matricola, setMatricola] = useState('')
  const [topN, setTopN] = useState('20')

  // Results
  const [righeResult, setRigheResult] = useState<RigaResult[]>([])
  const [clientiResult, setClientiResult] = useState<ClienteResult[]>([])
  const [topResult, setTopResult] = useState<TopClienteResult[]>([])
  const [espResult, setEspResult] = useState<EspositoreRiga[]>([])
  const [searched, setSearched] = useState(false)

  // Load regioni
  useEffect(() => {
    supabase.from('clienti').select('regione,sigla_provincia').not('regione', 'is', null).limit(5000).then(({ data }) => {
      const regs = [...new Set((data ?? []).map((c: { regione: string }) => c.regione).filter(Boolean))].sort() as string[]
      setRegioni(regs)
    })
  }, [])

  // Load province when regione changes
  useEffect(() => {
    if (!regione) { setProvinceOpts([]); setProvince([]); return }
    supabase.from('clienti').select('sigla_provincia,provincia').eq('regione', regione).not('sigla_provincia', 'is', null).limit(1000).then(({ data }) => {
      const provs = [...new Set((data ?? []).map((c: { sigla_provincia: string }) => c.sigla_provincia).filter(Boolean))].sort() as string[]
      setProvinceOpts(provs)
      setProvince([])
    })
  }, [regione])

  async function cerca() {
    setLoading(true)
    setSearched(true)
    setRigheResult([]); setClientiResult([]); setTopResult([]); setEspResult([])

    if (queryType === 'prodotti_area') {
      // 1. Get client PIVAs for region/province
      let qClienti = supabase.from('clienti').select('piva')
      if (regione) qClienti = qClienti.eq('regione', regione)
      if (province.length > 0) qClienti = qClienti.in('sigla_provincia', province)
      const { data: cData } = await qClienti.limit(2000)
      const pivas = (cData ?? []).map((c: { piva: string }) => c.piva)
      if (pivas.length === 0) { setLoading(false); return }

      // 2. Get doc IDs in date range
      let qDocs = supabase.from('documenti').select('id').in('piva_cliente', pivas)
      if (dal) qDocs = qDocs.gte('data_documento', dal)
      if (al) qDocs = qDocs.lte('data_documento', al)
      const { data: dData } = await qDocs.limit(2000)
      const docIds = (dData ?? []).map((d: { id: string }) => d.id)
      if (docIds.length === 0) { setLoading(false); return }

      // 3. Get righe
      let qRighe = supabase.from('righe_documento').select('codice_articolo,descrizione,quantita,totale_riga,tipo_riga,documento_id').in('documento_id', docIds)
      if (tipiRiga.length > 0 && tipiRiga.length < 4) qRighe = qRighe.in('tipo_riga', tipiRiga)
      const { data: rData } = await qRighe.limit(5000)

      // 4. Aggregate by descrizione/codice
      const agg: Record<string, RigaResult> = {}
      ;(rData ?? []).forEach((r: { codice_articolo: string | null; descrizione: string | null; tipo_riga: string; quantita: number | null; totale_riga: number | null }) => {
        const key = r.codice_articolo ?? r.descrizione ?? '?'
        if (!agg[key]) agg[key] = { codice_articolo: r.codice_articolo, descrizione: r.descrizione, tipo_riga: r.tipo_riga, qta: 0, totale: 0, n_docs: 0 }
        agg[key].qta += r.quantita ?? 0
        agg[key].totale += r.totale_riga ?? 0
        agg[key].n_docs++
      })
      setRigheResult(Object.values(agg).sort((a, b) => b.totale - a.totale))
    }

    if (queryType === 'clienti_area') {
      let qClienti = supabase.from('clienti').select('piva,ragione_sociale,comune,sigla_provincia')
      if (regione) qClienti = qClienti.eq('regione', regione)
      if (province.length > 0) qClienti = qClienti.in('sigla_provincia', province)
      const { data: cData } = await qClienti.order('ragione_sociale').limit(2000)
      const clientiList = (cData ?? []) as { piva: string; ragione_sociale: string; comune: string | null; sigla_provincia: string | null }[]
      const pivas = clientiList.map(c => c.piva)

      // Get docs count + fatturato per client
      let qDocs = supabase.from('documenti').select('piva_cliente,tipo,totale').in('piva_cliente', pivas)
      if (dal) qDocs = qDocs.gte('data_documento', dal)
      if (al) qDocs = qDocs.lte('data_documento', al)
      const { data: dData } = await qDocs.limit(10000)

      const docAgg: Record<string, { n: number; fat: number }> = {}
      ;(dData ?? []).forEach((d: { piva_cliente: string | null; tipo: string; totale: number | null }) => {
        if (!d.piva_cliente) return
        if (!docAgg[d.piva_cliente]) docAgg[d.piva_cliente] = { n: 0, fat: 0 }
        docAgg[d.piva_cliente].n++
        if (d.tipo === 'FTA') docAgg[d.piva_cliente].fat += d.totale ?? 0
      })

      setClientiResult(clientiList.map(c => ({
        piva: c.piva,
        ragione_sociale: c.ragione_sociale,
        comune: c.comune,
        sigla_provincia: c.sigla_provincia,
        n_docs: docAgg[c.piva]?.n ?? 0,
        fatturato: docAgg[c.piva]?.fat ?? 0,
      })).sort((a, b) => b.fatturato - a.fatturato))
    }

    if (queryType === 'top_clienti') {
      let qDocs = supabase.from('documenti').select('piva_cliente,tipo,totale').eq('tipo', 'FTA').not('piva_cliente', 'is', null)
      if (dal) qDocs = qDocs.gte('data_documento', dal)
      if (al) qDocs = qDocs.lte('data_documento', al)
      const { data: dData } = await qDocs.limit(10000)

      const agg: Record<string, { fat: number; n: number }> = {}
      ;(dData ?? []).forEach((d: { piva_cliente: string | null; totale: number | null }) => {
        if (!d.piva_cliente) return
        if (!agg[d.piva_cliente]) agg[d.piva_cliente] = { fat: 0, n: 0 }
        agg[d.piva_cliente].fat += d.totale ?? 0
        agg[d.piva_cliente].n++
      })

      const topPivas = Object.entries(agg).sort(([, a], [, b]) => b.fat - a.fat).slice(0, parseInt(topN)).map(([p]) => p)
      const { data: cData } = await supabase.from('clienti').select('piva,ragione_sociale').in('piva', topPivas)
      const nameMap: Record<string, string> = {}
      ;(cData ?? []).forEach((c: { piva: string; ragione_sociale: string }) => { nameMap[c.piva] = c.ragione_sociale })

      setTopResult(topPivas.map(p => ({
        piva: p,
        ragione_sociale: nameMap[p] ?? p,
        fatturato: agg[p].fat,
        n_fatture: agg[p].n,
      })))
    }

    if (queryType === 'storico_espositore') {
      if (!matricola.trim()) { setLoading(false); return }
      const { data: rData } = await supabase
        .from('righe_documento')
        .select('tipo_riga,descrizione,quantita,totale_riga,note,documento_id')
        .ilike('note', `%${matricola.trim()}%`)
        .in('tipo_riga', ['ricambio', 'servizio', 'espositore'])
        .limit(500)

      const docIds = [...new Set((rData ?? []).map((r: { documento_id: string }) => r.documento_id))]
      const { data: dData } = await supabase.from('documenti').select('id,numero_documento,data_documento').in('id', docIds)
      const docMap: Record<string, { numero_documento: string; data_documento: string }> = {}
      ;(dData ?? []).forEach((d: { id: string; numero_documento: string; data_documento: string }) => { docMap[d.id] = d })

      setEspResult(
        (rData ?? []).map((r: { documento_id: string; tipo_riga: string; descrizione: string | null; quantita: number | null; totale_riga: number | null; note: string | null }) => ({
          data_documento: docMap[r.documento_id]?.data_documento ?? '',
          numero_documento: docMap[r.documento_id]?.numero_documento ?? '',
          tipo_riga: r.tipo_riga,
          descrizione: r.descrizione,
          quantita: r.quantita,
          totale_riga: r.totale_riga,
          note: r.note,
        })).sort((a, b) => b.data_documento.localeCompare(a.data_documento))
      )
    }

    setLoading(false)
  }

  const TIPO_BADGE: Record<string, string> = {
    espositore: 'bg-sky-100 text-sky-700',
    ricambio: 'bg-amber-100 text-amber-700',
    servizio: 'bg-green-100 text-green-700',
    altro: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-xl font-semibold text-slate-800 mb-2">Ricerca avanzata</h1>
      <p className="text-sm text-slate-500 mb-6">Seleziona il tipo di analisi e applica i filtri</p>

      {/* Query type selector */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {QUERY_TYPES.map(({ id, label, desc, Icon }) => (
          <button key={id}
            onClick={() => { setQueryType(id); setSearched(false) }}
            className={`text-left p-4 rounded-xl border transition-all ${queryType === id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <Icon size={18} className={queryType === id ? 'text-sky-600 mb-2' : 'text-slate-400 mb-2'} />
            <p className={`text-sm font-medium mb-1 ${queryType === id ? 'text-sky-700' : 'text-slate-700'}`}>{label}</p>
            <p className="text-xs text-slate-400 leading-snug">{desc}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <div className="flex flex-wrap gap-4 items-end">

          {(queryType === 'prodotti_area' || queryType === 'clienti_area') && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Regione</label>
                <select value={regione} onChange={e => setRegione(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-36">
                  <option value="">Tutte</option>
                  {regioni.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {provinceOpts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Province</label>
                  <div className="flex flex-wrap gap-1">
                    {provinceOpts.map(p => (
                      <button key={p}
                        onClick={() => setProvince(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${province.includes(p) ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >{p}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {(queryType === 'prodotti_area' || queryType === 'clienti_area' || queryType === 'top_clienti') && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Dal</label>
                <input type="date" value={dal} onChange={e => setDal(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Al</label>
                <input type="date" value={al} onChange={e => setAl(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            </>
          )}

          {queryType === 'prodotti_area' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tipo riga</label>
              <div className="flex gap-1">
                {TIPO_RIGA_OPTS.map(t => (
                  <button key={t}
                    onClick={() => setTipiRiga(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${tipiRiga.includes(t) ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >{t}</button>
                ))}
              </div>
            </div>
          )}

          {queryType === 'top_clienti' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Top N clienti</label>
              <select value={topN} onChange={e => setTopN(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                {['10', '20', '50', '100'].map(n => <option key={n} value={n}>Top {n}</option>)}
              </select>
            </div>
          )}

          {queryType === 'storico_espositore' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Matricola espositore</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={matricola} onChange={e => setMatricola(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && cerca()}
                  placeholder="es. 12345"
                  className="pl-8 pr-4 py-2 text-sm border border-slate-300 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            </div>
          )}

          <button onClick={cerca} disabled={loading}
            className="px-5 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors">
            {loading ? 'Ricerca…' : 'Cerca'}
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

          {/* Prodotti per area */}
          {queryType === 'prodotti_area' && (
            <>
              <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500">
                {righeResult.length} prodotti trovati
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Prodotto</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Tipo</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Qtà</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Totale</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">N° righe</th>
                  </tr>
                </thead>
                <tbody>
                  {righeResult.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <p className="text-slate-700">{r.descrizione ?? '—'}</p>
                        {r.codice_articolo && <p className="text-xs text-slate-400 font-mono">{r.codice_articolo}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${TIPO_BADGE[r.tipo_riga] ?? ''}`}>{r.tipo_riga}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{r.qta.toLocaleString('it-IT')}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700 font-medium">
                        {r.totale > 0 ? `€ ${Math.round(r.totale).toLocaleString('it-IT')}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{r.n_docs}</td>
                    </tr>
                  ))}
                  {righeResult.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">Nessun risultato</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* Clienti per area */}
          {queryType === 'clienti_area' && (
            <>
              <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500">
                {clientiResult.length} clienti trovati
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Comune</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Documenti</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Fatturato</th>
                  </tr>
                </thead>
                <tbody>
                  {clientiResult.map(c => (
                    <tr key={c.piva}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/clienti/${encodeURIComponent(c.piva)}`)}
                    >
                      <td className="px-4 py-2.5">
                        <p className="text-slate-700">{c.ragione_sociale}</p>
                        <p className="text-xs text-slate-400 font-mono">{c.piva}</p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {c.comune} {c.sigla_provincia ? `(${c.sigla_provincia})` : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{c.n_docs || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700 font-medium">
                        {c.fatturato > 0 ? `€ ${Math.round(c.fatturato).toLocaleString('it-IT')}` : '—'}
                      </td>
                    </tr>
                  ))}
                  {clientiResult.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate-400">Nessun risultato</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* Top clienti */}
          {queryType === 'top_clienti' && (
            <>
              <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500">
                {topResult.length} clienti
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Cliente</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Fatture</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Fatturato</th>
                  </tr>
                </thead>
                <tbody>
                  {topResult.map((c, i) => (
                    <tr key={c.piva}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/clienti/${encodeURIComponent(c.piva)}`)}
                    >
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-slate-700">{c.ragione_sociale}</p>
                        <p className="text-xs text-slate-400 font-mono">{c.piva}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{c.n_fatture}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700 font-semibold">
                        € {Math.round(c.fatturato).toLocaleString('it-IT')}
                      </td>
                    </tr>
                  ))}
                  {topResult.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate-400">Nessun risultato</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* Storico espositore */}
          {queryType === 'storico_espositore' && (
            <>
              <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500">
                {espResult.length} interventi — matricola: {matricola}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Data</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Documento</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Descrizione</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Qtà</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {espResult.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-600">{new Date(r.data_documento).toLocaleDateString('it-IT')}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-700 text-xs">{r.numero_documento}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${TIPO_BADGE[r.tipo_riga] ?? ''}`}>{r.tipo_riga}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{r.descrizione ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{r.quantita?.toLocaleString('it-IT') ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {r.totale_riga != null ? `€ ${r.totale_riga.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                  {espResult.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nessun intervento trovato per questa matricola</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}
