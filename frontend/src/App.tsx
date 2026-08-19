import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/Login/LoginPage';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { TranscriptIngestPage } from './pages/Ingest/TranscriptIngestPage';
import { TranscriptReviewPage } from './pages/Review/TranscriptReviewPage';
import { KanbanPage } from './pages/Kanban/KanbanPage';
import { CalendarPage } from './pages/Calendar/CalendarPage';
import { HistoryPage } from './pages/History/HistoryPage';
import { ScheduleMeetingPage } from './pages/ScheduleMeeting/ScheduleMeetingPage';
import { TrackSelectionPage } from './pages/TrackSelection/TrackSelectionPage';
import { AcademicSessionSetupPage } from './pages/AcademicSessionSetup/AcademicSessionSetupPage';
import { AcademicParticipantMappingPage } from './pages/AcademicParticipantMapping/AcademicParticipantMappingPage';
import { AcademicAssessmentPage } from './pages/AcademicAssessment/AcademicAssessmentPage';
import { AcademicReportsPage } from './pages/AcademicReports/AcademicReportsPage';
import { MeetingReport } from './pages/MeetingReport/MeetingReport';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" />;
  return isAdmin ? <>{children}</> : <Navigate to="/" />;
}

function AcademicAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading, track } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" />;
  if (track !== 'academic_gd') return <Navigate to="/" replace />;
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user, track } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" /> : track ? <LoginPage /> : <Navigate to="/select-track" replace />}
      />
      <Route path="/select-track" element={<TrackSelectionPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            {track ? <AppLayout /> : <Navigate to="/select-track" replace />}
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="ingest"
          element={
            <AdminRoute>
              <TranscriptIngestPage />
            </AdminRoute>
          }
        />
        <Route
          path="transcripts/:id/review"
          element={
            <AdminRoute>
              <TranscriptReviewPage />
            </AdminRoute>
          }
        />
        <Route
          path="meetings/schedule"
          element={
            <AdminRoute>
              <ScheduleMeetingPage />
            </AdminRoute>
          }
        />
        <Route
          path="academic/sessions/new"
          element={
            <AcademicAdminRoute>
              <AcademicSessionSetupPage />
            </AcademicAdminRoute>
          }
        />
        <Route path="academic/transcripts/:id/map" element={<AcademicAdminRoute><AcademicParticipantMappingPage /></AcademicAdminRoute>} />
        <Route path="academic/transcripts/:id/assessment" element={<AcademicAdminRoute><AcademicAssessmentPage /></AcademicAdminRoute>} />
        <Route path="academic/reports" element={<AcademicAdminRoute><AcademicReportsPage /></AcademicAdminRoute>} />
        <Route path="kanban" element={<KanbanPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="meetings/:id" element={<MeetingReport />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
