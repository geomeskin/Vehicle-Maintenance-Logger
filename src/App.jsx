import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';

// Pages (we'll build these next)
import LoginPage from './pages/LoginPage.jsx';
import HomePage from './pages/HomePage.jsx';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Still loading auth state — show nothing to avoid flash
  if (session === undefined) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f0f0f',
        color: '#888',
        fontSize: '14px',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <LoginPage />}
        />

        {/* Protected */}
        <Route
          path="/*"
          element={session ? <HomePage session={session} /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
