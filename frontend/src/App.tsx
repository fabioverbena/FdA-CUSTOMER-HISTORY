import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Login from '@/pages/Login'
import Layout from '@/components/Layout'
import Clienti from '@/pages/Clienti'
import ClienteDetail from '@/pages/ClienteDetail'
import Documenti from '@/pages/Documenti'
import Espositori from '@/pages/Espositori'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null  // attesa hydration

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/clienti" replace />} />
          <Route path="clienti" element={<Clienti />} />
          <Route path="clienti/:piva" element={<ClienteDetail />} />
          <Route path="documenti" element={<Documenti />} />
          <Route path="espositori" element={<Espositori />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
