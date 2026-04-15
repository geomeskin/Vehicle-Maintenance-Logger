
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import LoginPage from './pages/LoginPage.jsx';
import MainApp from './pages/MainApp.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';

export default function App() {
  const [session, setSession] = useState(undefined);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Check URL for recovery token — hash (real email link) or query param (dev test)
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (hash.includes('type=recovery') || params.get('recovery') === '1') {
      setIsRecovery(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setSession(session);
      } else if (event === 'SIGNED_IN') {
        setSession(session);
        // deliberately NOT clearing isRecovery here
      } else {
        setIsRecovery(false);
        setSession(session);
      }
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

  if (isRecovery) {
    return <ResetPasswordPage onDone={() => setIsRecovery(false)} />;
  }

  return session
    ? <MainApp session={session} />
    : <LoginPage />;
}