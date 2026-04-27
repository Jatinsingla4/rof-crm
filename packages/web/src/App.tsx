import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/auth/LoginPage';
import Layout from './components/Layout';
import { ReportsDashboardPage } from './pages/ReportsDashboardPage';
import { ConsumerListPage } from './pages/ConsumerListPage';
import { UnitInventoryPage } from './pages/UnitInventoryPage';
import { AllotmentCreatePage } from './pages/AllotmentCreatePage';
import { PaymentDashboardPage } from './pages/PaymentDashboardPage';
import { DocumentVaultPage } from './pages/DocumentVaultPage';
import { CommunicationsPage } from './pages/CommunicationsPage';

// Default IDs for demo purposes
const DEFAULT_PROJECT_ID = 'proj-001';
const DEFAULT_CONSUMER_ID = 'cons-001';

export default function App() {
  const { token } = useAuthStore();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {token && (
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<ReportsDashboardPage projectId={DEFAULT_PROJECT_ID} />} />
            <Route path="/consumers" element={<ConsumerListPage />} />
            <Route path="/units" element={<UnitInventoryPage projectId={DEFAULT_PROJECT_ID} />} />
            <Route path="/allotments/new" element={<AllotmentCreatePage projectId={DEFAULT_PROJECT_ID} />} />
            <Route path="/payments" element={<PaymentDashboardPage projectId={DEFAULT_PROJECT_ID} />} />
            <Route path="/documents" element={<DocumentVaultPage consumerId={DEFAULT_CONSUMER_ID} />} />
            <Route path="/communications" element={<CommunicationsPage consumerId={DEFAULT_CONSUMER_ID} />} />
          </Route>
        )}
        <Route path="/" element={token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}
