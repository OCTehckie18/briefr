import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { MeetingsList } from './pages/MeetingsList/MeetingsList';
import { MeetingReport } from './pages/MeetingReport/MeetingReport';
import { Placeholder } from './pages/Placeholder/Placeholder';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="meetings" element={<MeetingsList />} />
          <Route path="meetings/:id" element={<MeetingReport />} />
          <Route path="analytics" element={<Placeholder />} />
          <Route path="settings" element={<Placeholder />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
