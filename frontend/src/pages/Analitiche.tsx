import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DocRow { tipo: string; data_documento: string; totale: number | null; piva_cliente: string | null }
interface ClienteRow { piva: string; regione: string | null; sigla_provincia: string | null; provincia: string | null }
interface RegioneStats { regione: string; clienti: number; documenti: number; fatturato: number }
interface MeseStats { mese: string; fatturato: number; bolle: number }

type Tab = 'geografica' | 'temporale'

export default function Analitiche() {
  const [tab, setTab] = useState<Tab>('geografica')
  const [loading, setLoading] = useState(true)
  const [docs, setDocs] = useState<DocRow[]>([])
  const [clienti, setClienti] = useState<ClienteRow[]>([])
  const [annoSel, setAnnoSel] = useState(new Date().getFullYear().toString())

  useEffect(() => {
    async function load() {
      const [{ data: allDocs }, { data: allClienti }] = await Promise.all([
        supabase.from('documenti').select('tipo,data_documento,totale,piva_cliente').limit(5000),
        supabase.from('clienti').select('piva,regione,sigla_provincia,provincia').limit(5000),
      ])
      setDocs((allDocs ?? []) as DocRow[])
      setClienti((allClienti ?? []) as ClienteRow[])
      setLoading(false)
    }
    load()
  }, [])

  // Mappa piva → regione
  const pivaRegione: Record<string, string> = {}
  clienti.forEach(c => { if (c.piva && c.regione) pivaRegione[c.piva] = c.regione })

  // Geografica: stats per regione
  const regioneMap: Record<string, RegioneStats> = {}
  docs.forEach(d => {
    const reg = d.piva_cliente ? (pivaRegione[d.piva_cliente] ?? null) : null
    if (!reg) return
    if (!regioneMap[reg]) regioneMap[reg] = { regione: reg, clienti: 0, documenti: 0, fatturato: 0 }
    regioneMap[reg].documenti++
    if (d.tipo === 'FTA') regioneMap[reg].fatturato += d.totale ?? 0
  })
  // Conteggio clienti per regione (distinct piva)
  const clientiPerRegione: Record<string, Set<string>> = {}
  docs.filter(d => d.piva_cliente).forEach(d => {
    const reg = pivaRegione[d.piva_cliente!]
    if (!reg) return
    if (!clientiPerRegione[reg]) clientiPerRegione[reg] = new Set()
    clientiPerRegione[reg].add(d.piva_cliente!)
  })
  Object.entries(clientiPerRegione).forEach(([reg, set]) => {
    if (regioneMap[reg]) regioneMap[reg].clienti = set.size
  })
  const regioneStats = Object.values(regioneMap).sort((a, b) => b.fatturato - a.fatturato)
  const chartGeo = regioneStats.slice(0, 12).map(r => ({
    regione: r.regione.slice(0, 10),
    fatturato: Math.round(r.fatturato),
  }))

  // Temporale: fatturato mensile per anno selezionato
  const meseMap: Record<string, MeseStats> = {}
  for (let m = 1; m <= 12; m++) {
    const key = `${annoSel}-${String(m).padStart(2, '0')}`
    meseMap[key] = { mese: String(m).padStart(2, '0'), fatturato: 0, bolle: 0 }
  }
  docs.filter(d => d.data_documento.startsWith(annoSel)).forEach(d => {
    const key = d.data_documento.slice(0, 7)
    if (!meseMap[key]) return
    if (d.tipo === 'FTA') meseMap[key].fatturato += d.totale ?? 0
    if (d.tipo === 'BC') meseMap[key].bolle++
  })
  const chartTemporale = Object.values(meseMap)

  const anni = [...new Set(docs.map(d => d.data_documento.slice(0, 4)))].sort().reverse()

  if (loading) return <div className="p-6 text-slate-400">Caricamento…</div>

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-xl font-semibold text-slate-800 mb-6">Analitiche</h1>

      {/* Tab selector */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {(['geografica', 'temporale'] as Tab[]).map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'geografica' ? 'Geografica' : 'Temporale'}
          </button>
        ))}
      </div>

      {tab === 'geografica' && (
        <>
          {/* Bar chart regioni */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Fatturato per regione (FTA)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartGeo} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="regione" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={32} />
                <Tooltip formatter={(v: unknown) => [`€ ${(v as number).toLocaleString('it-IT')}`, 'Fatturato']} />
                <Bar dataKey="fatturato" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabella */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Regione</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Clienti attivi</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Documenti</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Fatturato</th>
                </tr>
              </thead>
              <tbody>
                {regioneStats.map(r => (
                  <tr key={r.regione} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700 font-medium">{r.regione}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.clienti}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.documenti}</td>
                    <td className="px-4 py-3 text-right text-slate-700 font-medium">
                      {r.fatturato > 0 ? `€ ${Math.round(r.fatturato).toLocaleString('it-IT')}` : '—'}
                    </td>
                  </tr>
                ))}
                {regioneStats.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400">Nessun dato</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'temporale' && (
        <>
          {/* Anno selector */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-slate-600">Anno:</span>
            <div className="flex gap-1">
              {anni.map(a => (
                <button key={a}
                  onClick={() => setAnnoSel(a)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${annoSel === a ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Bar chart mensile */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Fatturato mensile — {annoSel}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartTemporale} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="mese" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={32} />
                <Tooltip formatter={(v: unknown) => [`€ ${(v as number).toLocaleString('it-IT')}`, 'Fatturato']} />
                <Bar dataKey="fatturato" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabella mensile */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Mese</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Fatturato (FTA)</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Bolle (BC)</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Tot documenti</th>
                </tr>
              </thead>
              <tbody>
                {chartTemporale.map(r => {
                  const totDocs = docs.filter(d => d.data_documento.startsWith(`${annoSel}-${r.mese}`)).length
                  return (
                    <tr key={r.mese} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{r.mese}/{annoSel.slice(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">
                        {r.fatturato > 0 ? `€ ${Math.round(r.fatturato).toLocaleString('it-IT')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.bolle || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{totDocs || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
