import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Login from '@/pages/Login'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Clienti from '@/pages/Clienti'
import ClienteDetail from '@/pages/ClienteDetail'
import Documenti from '@/pages/Documenti'
import Espositori from '@/pages/Espositori'
import Analitiche from '@/pages/Analitiche'
import Ricerca from '@/pages/Ricerca'
import Grenke from '@/pages/Grenke'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="clienti" element={<Clienti />} />
          <Route path="clienti/:piva" element={<ClienteDetail />} />
          <Route path="documenti" element={<Documenti />} />
          <Route path="espositori" element={<Espositori />} />
          <Route path="analitiche" element={<Analitiche />} />
          <Route path="ricerca" element={<Ricerca />} />
          <Route path="grenke" element={<Grenke />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
