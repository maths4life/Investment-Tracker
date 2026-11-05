import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Investments from './pages/Investments';
import InvestmentDetail from './pages/InvestmentDetail';
import Settings from './pages/Settings';
import AuthPage from './pages/AuthPage';
import { AuthProvider, useAuth } from './context/AuthContext';

function AuthenticatedApp() {
  const { user, loading, isConfigured } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-xs text-muted">
        Loading session...
      </div>
    );
  }

  // If Supabase is configured and there's no active user session, show Auth page
  if (isConfigured && !user) {
    return <AuthPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/investments" element={<Investments />} />
        <Route path="/investments/:id" element={<InvestmentDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

