import { Navigate, Route, Routes } from 'react-router-dom';
import { lazy } from 'react';
import { Layout } from '../components/layout/Layout';
import { LoginPage } from '../features/auth/Auth';
const Dashboard = lazy(() =>
  import('../features/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const Documents = lazy(() =>
  import('../features/documents/Documents').then((m) => ({ default: m.Documents })),
);
const Editor = lazy(() => import('../features/preprocessing/Editor').then((m) => ({ default: m.Editor })));
const Organizations = lazy(() =>
  import('../features/organizations/Organizations').then((m) => ({ default: m.Organizations })),
);
const Library = lazy(() => import('../features/seal-library/Library').then((m) => ({ default: m.Library })));
const Compare = lazy(() => import('../features/comparisons/Compare').then((m) => ({ default: m.Compare })));
const Results = lazy(() => import('../features/comparisons/Results').then((m) => ({ default: m.Results })));
const History = lazy(() =>
  import('../features/analysis-history/History').then((m) => ({ default: m.History })),
);
const Reports = lazy(() =>
  import('../features/analysis-history/History').then((m) => ({ default: m.Reports })),
);
const Settings = lazy(() => import('../features/settings/Settings').then((m) => ({ default: m.Settings })));
const Users = lazy(() => import('../features/settings/Users').then((m) => ({ default: m.Users })));
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/preprocessing" element={<Editor />} />
        <Route path="/preprocessing/:runId" element={<Editor />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/seal-library" element={<Library />} />
        <Route path="/compare/new" element={<Compare />} />
        <Route path="/compare/:sessionId/results" element={<Results />} />
        <Route path="/history" element={<History />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<Users />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
