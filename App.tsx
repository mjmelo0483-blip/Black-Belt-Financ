
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Cards from './pages/Cards';
import Budget from './pages/Budget';
import Accounts from './pages/Accounts';
import Categories from './pages/Categories';
import CashFlow from './pages/CashFlow';
import AuthPage from './pages/AuthPage';
import Investments from './pages/Investments';
import Sales from './pages/Sales';
import SalesDashboard from './pages/SalesDashboard';
import Profile from './pages/Profile';
import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';
import { ProfileProvider } from './contexts/ProfileContext';
import { ViewProvider } from './contexts/ViewContext';

const AppContent: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-dark">
        <div className="size-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {!session ? (
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      ) : (
        <div className="flex h-screen w-full overflow-hidden bg-background-dark">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <Header onMenuClick={() => setSidebarOpen(true)} />

            <main className="flex-1 overflow-y-auto relative">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/cards" element={<Cards />} />
                <Route path="/budget" element={<Budget />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/cashflow" element={<CashFlow />} />
                <Route path="/investments" element={<Investments />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/sales-dashboard" element={<SalesDashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <ViewProvider>
        <ProfileProvider>
          <AppContent />
        </ProfileProvider>
      </ViewProvider>
    </HashRouter>
  );
};

export default App;
