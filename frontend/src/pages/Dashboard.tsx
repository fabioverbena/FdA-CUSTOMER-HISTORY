import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Users, FileText, TrendingUp, Clock } from 'lucide-react'

interface DocRow { tipo: string; data_documento: string; totale: number | null; piva_cliente: string | null }
interface ClienteRow { piva: string; ragione_sociale: string; regione: string | null }

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [totalClienti, setTotalClienti] = useState(0)
  const [docs, setDocs] = useState<DocRow[]>([])
  const [topClienti, setTopClienti] = useState<{ piva: string; nome: string; totale: number }[]>([])
  const [dormienti, setDormienti] = useState<ClienteRow[]>([])

  useEffect(() => {
    async function load() {
      const [{ count }, { data: allDocs }] = await Promise.all([
        supabase.from('clienti').select('*', { count: 'exact', head: true }),
        supabase.from('documenti').select('tipo,data_documento,totale,piva_cliente').limit(5000),
      ])

      setTotalClienti(count ?? 0)
      const d = (allDocs ?? []) as DocRow[]
      setDocs(d)

      // Top 10 per fatturato (FTA)
      const perCliente: Record<string, number> = {}
      d.filter(doc => doc.tipo === 'FTA' && doc.piva_cliente).forEach(doc => {
        perCliente[doc.piva_cliente!] = (perCliente[doc.piva_cliente!] ?? 0) + (doc.totale ?? 0)
      })
      const top10Piva = Object.entries(perCliente).sort(([, a], [, b]) => b - a).slice(0, 10).map(([p]) => p)

      // Clienti dormienti (attivi prima, inattivi ultimi 12 mesi)
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - 12)
      const cutoffStr = cutoff.toISOString().split('T')[0]
      const recentPivas = new Set(d.filter(doc => doc.data_documento >= cutoffStr && doc.piva_cliente).map(doc => doc.piva_cliente!))
      const oldPivas = [...new Set(d.filter(doc => doc.data_documento < cutoffStr && doc.piva_cliente).map(doc => doc.piva_cliente!))].filter(p => !recentPivas.has(p))

      if (top10Piva.length > 0) {
        const { data } = await supabase.from('clienti').select('piva,ragione_sociale').in('piva', top10Piva)
        const map: Record<string, string> = {}
        ;(data ?? []).forEach((c: { piva: string; ragione_sociale: string }) => { map[c.piva] = c.ragione_sociale })
        setTopClienti(Object.entries(perCliente).sort(([, a], [, b]) => b - a).slice(0, 10).map(([piva, totale]) => ({ piva, nome: map[piva] ?? piva, totale })))
      }

      if (oldPivas.length > 0) {
        const { data } = await supabase.from('clienti').select('piva,ragione_sociale,regione').in('piva', oldPivas.slice(0, 100))
        setDormienti((data ?? []) as ClienteRow[])
      }
      setLoading(false)
    }
    load()
  }, [])

  const annoCorrente = new Date().getFullYear().toString()
  const fatture = docs.filter(d => d.tipo === 'FTA')
  const fatturatoYTD = fatture.filter(d => d.data_documento.startsWith(annoCorrente)).reduce((s, d) => s + (d.totale ?? 0), 0)
  const docsAnno = docs.filter(d => d.data_documento.startsWith(annoCorrente)).length

  // Fatturato mensile ultimi 12 mesi
  const now = new Date()
  const monthly: Record<string, number> = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthly[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
  }
  fatture.forEach(d => {
    const m = d.data_documento.slice(0, 7)
    if (m in monthly) monthly[m] = (monthly[m] ?? 0) + (d.totale ?? 0)
  })
  const chartData = Object.entries(monthly).map(([mese, totale]) => ({
    mese: mese.slice(5) + '/' + mese.slice(2, 4),
    totale: Math.round(totale),
  }))

  if (loading) return <div className="p-6 text-slate-400">Caricamento…</div>

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-xl font-semibold text-slate-800 mb-6">Dashboard</h1>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Clienti totali', value: totalClienti.toLocaleString('it-IT'), Icon: Users },
          { label: `Fatturato ${annoCorrente}`, value: `€ ${Math.round(fatturatoYTD).toLocaleString('it-IT')}`, Icon: TrendingUp },
          { label: `Documenti ${annoCorrente}`, value: docsAnno.toString(), Icon: FileText },
          { label: 'Dormienti >12 mesi', value: dormienti.length.toString(), Icon: Clock },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
              <Icon size={15} className="text-slate-300" />
            </div>
            <p className="text-2xl font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Fatturato mensile */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Fatturato mensile — ultimi 12 mesi</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="mese" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={30} />
              <Tooltip formatter={(v: unknown) => [`€ ${(v as number).toLocaleString('it-IT')}`, 'Fatturato']} />
              <Bar dataKey="totale" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 clienti */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Top 10 clienti per fatturato</h2>
          <div className="space-y-1.5">
            {topClienti.map(({ piva, nome, totale }, i) => (
              <div key={piva}
                className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 -mx-1"
                onClick={() => navigate(`/clienti/${encodeURIComponent(piva)}`)}
              >
                <span className="text-xs text-slate-400 w-4 text-right shrink-0">{i + 1}</span>
                <span className="text-sm text-slate-700 flex-1 truncate">{nome}</span>
                <span className="text-sm font-medium text-slate-600 shrink-0">
                  € {Math.round(totale).toLocaleString('it-IT')}
                </span>
              </div>
            ))}
            {topClienti.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nessun dato</p>}
          </div>
        </div>
      </div>

      {/* Clienti dormienti */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Clienti dormienti — nessuna attività negli ultimi 12 mesi</h2>
          <span className="text-xs text-slate-400">{dormienti.length} clienti</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-52 overflow-auto">
          {dormienti.map(c => (
            <div key={c.piva}
              className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 cursor-pointer"
              onClick={() => navigate(`/clienti/${encodeURIComponent(c.piva)}`)}
            >
              <span className="text-sm text-slate-700">{c.ragione_sociale}</span>
              <div className="flex items-center gap-3">
                {c.regione && <span className="text-xs text-slate-400">{c.regione}</span>}
                <span className="text-xs text-slate-400 font-mono">{c.piva}</span>
              </div>
            </div>
          ))}
          {dormienti.length === 0 && (
            <p className="text-sm text-slate-400 px-5 py-4 text-center">Nessun cliente dormiente</p>
          )}
        </div>
      </div>
    </div>
  )
}
