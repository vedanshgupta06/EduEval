import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import ClassroomPage from './pages/ClassroomPage';
import CreateExamPage from './pages/CreateExamPage';
import ReviewQueuePage from './pages/ReviewQueuePage';
import SubmissionReviewPage from './pages/SubmissionReviewPage';
import ExamSubmitPage from './pages/ExamSubmitPage';
import ResultPage from './pages/ResultPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ExamQuestionsPage from './pages/ExamQuestionsPage';
import CreateAssessmentPage  from './pages/CreateAssessmentPage';
import TakeAssessmentPage    from './pages/TakeAssessmentPage';
import AssessmentResultsPage from './pages/AssessmentResultsPage';

function AppLayout() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <>
      {!isAuthPage && <Navbar />}
      <main className={isAuthPage ? 'auth-main-content' : 'main-content'}>
        <Routes>

          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Teacher routes */}
          <Route path="/teacher" element={
            <ProtectedRoute role="TEACHER"><TeacherDashboard /></ProtectedRoute>
          } />
          <Route path="/teacher/classroom/:id" element={
            <ProtectedRoute role="TEACHER"><ClassroomPage /></ProtectedRoute>
          } />
          <Route path="/teacher/classroom/:classroomId/create-exam" element={
            <ProtectedRoute role="TEACHER"><CreateExamPage /></ProtectedRoute>
          } />
          <Route path="/teacher/exam/:examId/submissions" element={
            <ProtectedRoute role="TEACHER"><ReviewQueuePage /></ProtectedRoute>
          } />
          <Route path="/teacher/exam/:examId/review-queue" element={
            <ProtectedRoute role="TEACHER"><ReviewQueuePage /></ProtectedRoute>
          } />
          <Route path="/teacher/exam/:examId/questions" element={
            <ProtectedRoute role="TEACHER"><ExamQuestionsPage /></ProtectedRoute>
          } />
          <Route path="/teacher/review/:submissionId" element={
            <ProtectedRoute role="TEACHER"><SubmissionReviewPage /></ProtectedRoute>
          } />
          <Route path="/teacher/classroom/:classroomId/analytics" element={
            <ProtectedRoute role="TEACHER"><AnalyticsPage /></ProtectedRoute>
          } />
          <Route
            path="/teacher/classroom/:classroomId/create-assessment"
            element={<ProtectedRoute role="TEACHER"><CreateAssessmentPage /></ProtectedRoute>}
          />
          <Route
            path="/teacher/assessment/:assessmentId/results"
            element={<ProtectedRoute role="TEACHER"><AssessmentResultsPage /></ProtectedRoute>}
          />
          <Route
            path="/student/assessment/:assessmentId/take"
            element={<ProtectedRoute role="STUDENT"><TakeAssessmentPage /></ProtectedRoute>}
          />
          {/* Student routes */}
          <Route path="/student" element={
            <ProtectedRoute role="STUDENT"><StudentDashboard /></ProtectedRoute>
          } />
          <Route path="/student/classroom/:id" element={
            <ProtectedRoute role="STUDENT"><ClassroomPage /></ProtectedRoute>
          } />
          <Route path="/student/exam/:examId/submit" element={
            <ProtectedRoute role="STUDENT"><ExamSubmitPage /></ProtectedRoute>
          } />
          <Route path="/student/result/:submissionId" element={
            <ProtectedRoute role="STUDENT"><ResultPage /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </main>
      <Toaster position="top-right" />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}
