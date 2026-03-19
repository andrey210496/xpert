import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Lazy load pages for performance
const Home = lazy(() => import('./pages/Home'));
const Chat = lazy(() => import('./pages/Chat'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

// Simple loading fallback
function PageLoader() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function DashboardWrapper() {
  const navigate = useNavigate();
  return <Dashboard onNavigateHome={() => navigate('/')} />;
}

function SuperAdminWrapper() {
  const navigate = useNavigate();
  return <SuperAdminDashboard onNavigateHome={() => navigate('/')} />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/chat/:agentType" element={<Chat />} />
              <Route path="/dashboard" element={
                <ProtectedRoute allowedTypes={['admin']}>
                  <DashboardWrapper />
                </ProtectedRoute>
              } />
              <Route path="/superadmin" element={
                <ProtectedRoute allowedTypes={['superadmin']}>
                  <SuperAdminWrapper />
                </ProtectedRoute>
              } />
              <Route path="/onboarding" element={<Onboarding />} />
            </Routes>
          </Suspense>
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
