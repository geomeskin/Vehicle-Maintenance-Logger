import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import LoginPage from './pages/LoginPage.jsx';
import MainApp from './pages/MainApp.jsx';

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#444', fontSize: '13px' }}>
        Loading...
      </div>
    );
  }

  return session
    ? <MainApp session={session} />
    : <LoginPage />;
}
