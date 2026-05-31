import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Plus, Clock, Users, FileText } from 'lucide-react';

export default function ClassroomPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === 'TEACHER';

  const [classroom, setClassroom] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    try {
      const [classRes, examRes] = await Promise.all([
        api.get(`/api/classrooms/${id}`),
        api.get(`/api/classrooms/${id}/exams`),
      ]);
      setClassroom(classRes.data);
      setExams(examRes.data);
    } catch {
      toast.error('Failed to load classroom');
    } finally {
      setLoading(false);
    }
  };

  const isPastDeadline = (deadline) => new Date(deadline) < new Date();

  const handleExamClick = (exam) => {
    if (isTeacher) {
      navigate(`/teacher/exam/${exam.id}/submissions`);
    } else {
      navigate(`/student/exam/${exam.id}/submit`);
    }
  };

  if (loading) return <div className="loading">Loading classroom...</div>;
  if (!classroom) return <div className="error">Classroom not found</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>{classroom.className}</h2>
          <p className="page-subtitle">
            Code: <strong>{classroom.classCode}</strong>
            {' · '}
            <Users size={13} style={{ display: 'inline' }} /> {classroom.studentCount} students
          </p>
        </div>
        {isTeacher && (
          <button
            className="btn-primary"
            onClick={() => navigate(`/teacher/classroom/${id}/create-exam`)}
          >
            <Plus size={16} /> New Exam
          </button>
        )}
      </div>

      <h3>Exams</h3>

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
                  <span className={`deadline-badge ${past ? 'past' : 'active'}`}>
                    {past ? 'Closed' : 'Open'}
                  </span>
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
    </div>
  );
}