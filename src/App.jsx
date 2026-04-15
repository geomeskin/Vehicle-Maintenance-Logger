import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import LoginPage from './pages/LoginPage.jsx';
import MainApp from './pages/MainApp.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';

export default function App() {
  const [session, setSession] = useState(undefined);
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const isRecoveryUrl = hash.includes('type=recovery') || params.get('recovery') === '1';

    if (isRecoveryUrl) {
      const emailParam = params.get('email') || '';
      setRecoveryEmail(emailParam);
      setIsRecovery(true);
      setSession(null);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('auth event:', event, session);
      if (event === 'PASSWORD_RECOVERY') {
        if (session?.user?.email) setRecoveryEmail(session.user.email);
        setIsRecovery(true);
        setSession(session);
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setSession(session);
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
    return <ResetPasswordPage email={recoveryEmail} onDone={() => {
      setIsRecovery(false);
      window.history.replaceState({}, '', window.location.pathname);
    }} />;
  }

  return session
    ? <MainApp session={session} />
    : <LoginPage />;
}