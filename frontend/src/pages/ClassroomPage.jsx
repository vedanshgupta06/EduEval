import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/useAuth';
import { Plus, Clock, Users, FileText, Trash2, ClipboardList, Pencil, Save, X } from 'lucide-react';
import { getAssessmentsForClassroom } from '../api/assessments';

export default function ClassroomPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === 'TEACHER';

  const [classroom, setClassroom] = useState(null);
  const [exams, setExams] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('exams'); // 'exams' | 'assessments'
  const [editingDeadlineId, setEditingDeadlineId] = useState(null);
  const [deadlineDraft, setDeadlineDraft] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [classRes, examRes, assessmentRes] = await Promise.all([
        api.get(`/api/classrooms/${id}`),
        api.get(`/api/classrooms/${id}/exams`),
        getAssessmentsForClassroom(id),
      ]);
      setClassroom(classRes.data);
      setExams(examRes.data);
      setAssessments(assessmentRes.data);
    } catch {
      toast.error('Failed to load classroom');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isPastDeadline = (deadline) => new Date(deadline) < new Date();

  const toDateTimeLocal = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const handleExamClick = (exam) => {
    if (isTeacher) {
      navigate(`/teacher/exam/${exam.id}/submissions`);
    } else {
      navigate(`/student/exam/${exam.id}/submit`);
    }
  };

  const deleteExam = async (exam) => {
    const warning = exam.submissionCount > 0
      ? `Remove "${exam.title}" and its ${exam.submissionCount} submission${exam.submissionCount !== 1 ? 's' : ''}?`
      : `Remove "${exam.title}"?`;

    if (!confirm(warning)) return;

    try {
      await api.delete(`/api/teacher/exams/${exam.id}`);
      toast.success('Exam removed');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove exam');
    }
  };

  const startDeadlineEdit = (exam) => {
    setEditingDeadlineId(exam.id);
    setDeadlineDraft(toDateTimeLocal(exam.deadline));
  };

  const cancelDeadlineEdit = () => {
    setEditingDeadlineId(null);
    setDeadlineDraft('');
  };

  const saveDeadline = async (exam) => {
    if (!deadlineDraft) {
      toast.error('Select a new deadline');
      return;
    }

    const nextDeadline = new Date(deadlineDraft);
    if (nextDeadline <= new Date()) {
      toast.error('Deadline must be in the future');
      return;
    }

    setSavingDeadline(true);
    try {
      await api.put(`/api/teacher/exams/${exam.id}`, {
        deadline: nextDeadline.toISOString(),
      });
      toast.success('Exam deadline updated');
      cancelDeadlineEdit();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update deadline');
    } finally {
      setSavingDeadline(false);
    }
  };

  if (loading) return <div className="loading">Loading classroom...</div>;
  if (!classroom) return <div className="error">Classroom not found</div>;

  return (
    <div className="page">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h2>{classroom.className}</h2>
          <p className="page-subtitle">
            Code: <strong>{classroom.classCode}</strong>
            {' · '}
            <Users size={13} style={{ display: 'inline' }} /> {classroom.studentCount} students
          </p>
        </div>

        {/* Tab-aware action button */}
        {isTeacher && activeTab === 'exams' && (
          <button
            className="btn-primary"
            onClick={() => navigate(`/teacher/classroom/${id}/create-exam`)}
          >
            <Plus size={16} /> New Exam
          </button>
        )}
        {isTeacher && activeTab === 'assessments' && (
          <button
            className="btn-primary"
            onClick={() => navigate(`/teacher/classroom/${id}/create-assessment`)}
          >
            <Plus size={16} /> New Assessment
          </button>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        <button
          className={`tab-btn ${activeTab === 'exams' ? 'active' : ''}`}
          onClick={() => setActiveTab('exams')}
        >
          <FileText size={14} style={{ marginRight: '0.35rem' }} />
          Exams
          {exams.length > 0 && (
            <span className="tab-count">{exams.length}</span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'assessments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assessments')}
        >
          <ClipboardList size={14} style={{ marginRight: '0.35rem' }} />
          Assessments
          {assessments.length > 0 && (
            <span className="tab-count">{assessments.length}</span>
          )}
        </button>
      </div>

      {/* ── Exams tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'exams' && (
        <>
          {exams.length === 0 ? (
            <div className="empty-state-page">
              <FileText size={48} />
              <p>{isTeacher ? 'No exams yet. Create one!' : 'No exams scheduled yet.'}</p>
            </div>
          ) : (
            <div className="card-grid">
              {exams.map((exam) => {
                const past = isPastDeadline(exam.deadline);
                return (
                  <div key={exam.id} className={`exam-card ${past ? 'past' : ''}`}>
                    <div className="exam-card-header">
                      <h4>{exam.title}</h4>
                      <div className="exam-card-tools">
                        <span className={`deadline-badge ${past ? 'past' : 'active'}`}>
                          {past ? 'Closed' : 'Open'}
                        </span>
                        {isTeacher && (
                          <>
                            <button
                              className="btn-icon"
                              title="Edit deadline"
                              onClick={() => startDeadlineEdit(exam)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="btn-icon danger"
                              title="Remove exam"
                              onClick={() => deleteExam(exam)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="exam-meta">
                      <span>Total: <strong>{exam.totalMarks} marks</strong></span>
                      <span>
                        <Clock size={13} />
                        {new Date(exam.deadline).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                      {isTeacher && (
                        <span><FileText size={13} /> {exam.submissionCount} submissions</span>
                      )}
                    </div>

                    {isTeacher && editingDeadlineId === exam.id && (
                      <div className="deadline-edit-panel">
                        <input
                          type="datetime-local"
                          value={deadlineDraft}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={(e) => setDeadlineDraft(e.target.value)}
                        />
                        <button
                          className="btn-primary"
                          onClick={() => saveDeadline(exam)}
                          disabled={savingDeadline}
                          title="Save deadline"
                        >
                          <Save size={14} />
                          {savingDeadline ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={cancelDeadlineEdit}
                          disabled={savingDeadline}
                          title="Cancel deadline edit"
                        >
                          <X size={14} />
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="exam-actions">
                      <button
                        className="btn-primary"
                        onClick={() => handleExamClick(exam)}
                        disabled={!isTeacher && past}
                      >
                        {isTeacher ? 'View Submissions' : past ? 'Deadline Passed' : 'Submit Answer'}
                      </button>
                      {isTeacher && (
                        <button
                          className="btn-secondary"
                          onClick={() => navigate(`/teacher/exam/${exam.id}/review-queue`)}
                        >
                          Review Queue
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Assessments tab ─────────────────────────────────────────────────── */}
      {activeTab === 'assessments' && (
        <>
          {assessments.length === 0 ? (
            <div className="empty-state-page">
              <ClipboardList size={48} />
              <p>
                {isTeacher
                  ? 'No assessments yet. Create one!'
                  : 'No assessments available yet.'}
              </p>
            </div>
          ) : (
            <div className="card-grid">
              {assessments.map((assessment) => {
                const past = isPastDeadline(assessment.deadline);
                return (
                  <div key={assessment.id} className={`exam-card ${past ? 'past' : ''}`}>
                    <div className="exam-card-header">
                      <h4>{assessment.title}</h4>
                      <div className="exam-card-tools">
                        <span className={`deadline-badge ${past ? 'past' : 'active'}`}>
                          {past ? 'Closed' : 'Open'}
                        </span>
                      </div>
                    </div>

                    {assessment.description && (
                      <p style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-muted, #888)',
                        margin: '0.25rem 0 0.5rem',
                        lineHeight: 1.4,
                      }}>
                        {assessment.description}
                      </p>
                    )}

                    <div className="exam-meta">
                      <span>Total: <strong>{assessment.totalMarks} marks</strong></span>
                      <span>
                        <FileText size={13} /> {assessment.questions.length} question{assessment.questions.length !== 1 ? 's' : ''}
                      </span>
                      {assessment.durationMinutes && (
                        <span><Clock size={13} /> {assessment.durationMinutes} min</span>
                      )}
                      <span>
                        <Clock size={13} />
                        {new Date(assessment.deadline).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="exam-actions">
                      {isTeacher ? (
                        <button
                          className="btn-primary"
                          onClick={() => navigate(`/teacher/assessment/${assessment.id}/results`)}
                        >
                          View Results
                        </button>
                      ) : (
                        <button
                          className="btn-primary"
                          onClick={() => navigate(`/student/assessment/${assessment.id}/take`)}
                          disabled={past}
                        >
                          {past ? 'Deadline Passed' : 'Take Assessment'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
