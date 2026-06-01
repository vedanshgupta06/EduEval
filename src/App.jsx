import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="main-content">
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
            <Route path="/teacher/review/:submissionId" element={
              <ProtectedRoute role="TEACHER"><SubmissionReviewPage /></ProtectedRoute>
            } />
            <Route path="/teacher/classroom/:classroomId/analytics" element={
              <ProtectedRoute role="TEACHER"><AnalyticsPage /></ProtectedRoute>
            } />
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
      </BrowserRouter>
    </AuthProvider>
  );
}