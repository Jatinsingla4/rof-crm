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
import { CommunicationsPage } from './pages/communications/CommunicationsPage';
import { FAQPage } from './pages/faq/FAQPage';
import { RbacSettingsPage } from './pages/RbacSettingsPage';
import { AllotmentDashboardPage } from './pages/reports/AllotmentDashboardPage';
import { MilestonesPage } from './pages/projects/MilestonesPage';
import { DrawRefundsPage } from './pages/payments/DrawRefundsPage';
import { BankReconciliationPage } from './pages/payments/BankReconciliationPage';
import { WaitlistPage } from './pages/allocations/WaitlistPage';
import { AllocationsPage } from './pages/allocations/AllocationsPage';
import { ConsumerDetailPage } from './pages/consumers/ConsumerDetailPage';
import { TicketsPage } from './pages/communications/TicketsPage';

// Default IDs for demo purposes (must be valid UUIDs)
const DEFAULT_PROJECT_ID = '11111111-1111-1111-1111-111111111111';
const DEFAULT_CONSUMER_ID = 'a72bc39b-1d56-424b-b62e-2eb0a6a15372';

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
            <Route path="/consumers/:id" element={<ConsumerDetailPage />} />
            <Route path="/units" element={<UnitInventoryPage projectId={DEFAULT_PROJECT_ID} />} />
            <Route path="/allocations" element={<AllocationsPage />} />
            <Route path="/allotments/new" element={<AllotmentCreatePage projectId={DEFAULT_PROJECT_ID} />} />
            <Route path="/allocations/import" element={<AllotmentCreatePage projectId={DEFAULT_PROJECT_ID} />} />
            <Route path="/allocations/waitlist" element={<WaitlistPage />} />
            <Route path="/payments" element={<PaymentDashboardPage projectId={DEFAULT_PROJECT_ID} />} />
            <Route path="/documents" element={<DocumentVaultPage consumerId={DEFAULT_CONSUMER_ID} />} />
            <Route path="/communications" element={<CommunicationsPage consumerId={DEFAULT_CONSUMER_ID} />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/settings/roles" element={<RbacSettingsPage />} />
            <Route path="/reports/allotment" element={<AllotmentDashboardPage />} />
            <Route path="/projects/milestones" element={<MilestonesPage />} />
            <Route path="/payments/draw-refunds" element={<DrawRefundsPage />} />
            <Route path="/payments/reconciliation" element={<BankReconciliationPage />} />
          </Route>
        )}
        <Route path="/" element={token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}
