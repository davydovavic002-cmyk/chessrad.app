import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import { ThemeProvider } from './theme/ThemeContext';
import RequireAuth from './auth/RequireAuth';
import AuthPage from './pages/AuthPage';
import LobbyPage from './pages/LobbyPage';
import ProfilePage from './pages/ProfilePage';
import GamePage from './pages/GamePage';
import PlayBotPage from './pages/PlayBotPage';
import TournamentPage from './pages/TournamentPage';
import TournamentListPage from './pages/TournamentListPage';
import TournamentGamePage from './pages/TournamentGamePage';
import AdminPage from './pages/AdminPage';
import StudyPage from './pages/StudyPage';
import LibraryEditorPage from './pages/LibraryEditorPage';
import SchedulePage from './pages/SchedulePage';
import JournalPage from './pages/JournalPage';
import HomeworkPage from './pages/HomeworkPage';
import ParentReportPage from './pages/ParentReportPage';
import StudentCalendarPage from './pages/StudentCalendarPage';
import ParentPortalPage from './pages/ParentPortalPage';
import GroupStudyPage from './pages/GroupStudyPage';
import LinkPage from './pages/LinkPage';
import OnboardingModal from './components/OnboardingModal';
import ThemeSync from './components/ThemeSync';

function Protected({ children }) {
  return <RequireAuth>{children}</RequireAuth>;
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <ThemeSync />
            <OnboardingModal />
            <Routes>
              <Route path="/" element={<AuthPage />} />
              <Route path="/link/:code" element={<Protected><LinkPage /></Protected>} />
              <Route path="/parent-report/:token" element={<ParentReportPage />} />
              <Route path="/lobby" element={<Protected><LobbyPage /></Protected>} />
            <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
            <Route path="/game" element={<Protected><GamePage /></Protected>} />
            <Route path="/game/:gameId" element={<Protected><TournamentGamePage /></Protected>} />
            <Route path="/puzzle" element={<Protected><Navigate to="/lobby" replace /></Protected>} />
            <Route path="/play-bot" element={<Protected><PlayBotPage /></Protected>} />
            <Route path="/tournaments" element={<Protected><TournamentListPage /></Protected>} />
            <Route path="/tournaments/:id" element={<Protected><TournamentPage /></Protected>} />
            <Route path="/tournament" element={<Protected><Navigate to="/tournaments" replace /></Protected>} />
            <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
            <Route path="/study" element={<Protected><StudyPage /></Protected>} />
            <Route path="/library-editor" element={<Protected><LibraryEditorPage /></Protected>} />
            <Route path="/schedule" element={<Protected><SchedulePage /></Protected>} />
            <Route path="/calendar" element={<Protected><StudentCalendarPage /></Protected>} />
            <Route path="/parent" element={<Protected><ParentPortalPage /></Protected>} />
            <Route path="/group-study" element={<Protected><GroupStudyPage /></Protected>} />
            <Route path="/journal" element={<Protected><JournalPage /></Protected>} />
            <Route path="/homework" element={<Protected><HomeworkPage /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
