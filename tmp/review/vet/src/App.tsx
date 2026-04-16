import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import { SessionProvider } from './context/SessionContext';
import { AgentProvider } from './context/AgentContext';
import { ToastProvider } from './context/ToastContext';
import { Root } from './components/Layout/Root';
import { SupplyRoot } from './components/Layout/SupplyRoot';
import { Toast } from './components/Common/Toast';
import { DashboardPage } from './components/Dashboard/DashboardPage';
import { SettingsPage } from './components/Settings/SettingsPage';
import { SessionPage } from './components/Session/SessionPage';
import { LegalPage } from './components/Legal/LegalPage';
import { LicensesPage } from './components/Legal/LicensesPage';
import { SupplyDashboard } from './components/Supply/SupplyDashboard';
import { RegisterAgent } from './components/Supply/RegisterAgent';
import { EvalAgent } from './components/Supply/EvalAgent';
import { Payouts } from './components/Supply/Payouts';
import './App.css';

function AppRoutes() {
  const location = useLocation();
  const isSupplySide = location.pathname.startsWith('/supply');

  const Shell = isSupplySide ? SupplyRoot : Root;

  return (
    <Shell>
      <Routes>
        {/* Demand-side routes */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/session/:id" element={<SessionPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/licenses" element={<LicensesPage />} />

        {/* Supply-side routes */}
        <Route path="/supply" element={<SupplyDashboard />} />
        <Route path="/supply/register" element={<RegisterAgent />} />
        <Route path="/supply/agents" element={<SupplyDashboard />} />
        <Route path="/supply/evaluation" element={<EvalAgent />} />
        <Route path="/supply/payouts" element={<Payouts />} />
      </Routes>
    </Shell>
  );
}

function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <SessionProvider>
          <AgentProvider>
            <BrowserRouter>
              <AppRoutes />
              <Toast />
            </BrowserRouter>
          </AgentProvider>
        </SessionProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}

export default App;
