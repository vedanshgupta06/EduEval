import api from './axios';

// ── Teacher ───────────────────────────────────────────────────────────────────

export const createAssessment = (classroomId, data) =>
  api.post(`/api/teacher/classrooms/${classroomId}/assessments`, data);

export const getAssessmentResults = (assessmentId) =>
  api.get(`/api/teacher/assessments/${assessmentId}/results`);

export const overrideAnswerMarks = (assessmentId, data) =>
  api.post(`/api/teacher/assessments/${assessmentId}/override`, data);

export const downloadAssessmentReport = async (assessmentId, title) => {
  const res = await api.get(`/api/teacher/reports/assessment/${assessmentId}`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Assessment_Report_${title}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ── Shared ────────────────────────────────────────────────────────────────────

export const getAssessmentsForClassroom = (classroomId) =>
  api.get(`/api/classrooms/${classroomId}/assessments`);

export const getAssessment = (assessmentId) =>
  api.get(`/api/assessments/${assessmentId}`);

// ── Student ───────────────────────────────────────────────────────────────────

export const submitAssessment = (assessmentId, answers) =>
  api.post(`/api/student/assessments/${assessmentId}/submit`, { answers });

export const getMySubmission = (assessmentId) =>
  api.get(`/api/student/assessments/${assessmentId}/my-submission`);
