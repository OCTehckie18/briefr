import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BookOpenCheck, CheckCircle2, Clock3, FileSearch, GraduationCap, Loader2, Plus, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAcademicAssessments, getAcademicCohorts, getAcademicReports, getAcademicSessions, getAcademicStudents } from '../../api/endpoints';
import type { AcademicAssessment, AcademicCohort, AcademicReport, AcademicSession } from '../../api/endpoints';
import { useAuth } from '../../store/AuthContext';

const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-cyan-500', 'bg-amber-500'];

export const AcademicDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [assessments, setAssessments] = useState<AcademicAssessment[]>([]);
  const [reports, setReports] = useState<AcademicReport[]>([]);
  const [cohorts, setCohorts] = useState<AcademicCohort[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getAcademicSessions(), getAcademicAssessments(), getAcademicReports(), getAcademicCohorts(), getAcademicStudents()])
      .then(([sessionResponse, assessmentResponse, reportResponse, cohortResponse, studentResponse]) => {
        setSessions(sessionResponse.data); setAssessments(assessmentResponse.data); setReports(reportResponse.data); setCohorts(cohortResponse.data); setStudentCount(studentResponse.data.length);
      }).catch(() => setError('Unable to load academic overview.')).finally(() => setLoading(false));
  }, []);

  const rubric = useMemo(() => {
    const totals = new Map<string, { label: string; score: number; max: number; count: number }>();
    assessments.forEach((assessment) => assessment.scores.forEach((score) => { const current = totals.get(score.key) || { label: score.label, score: 0, max: score.maxScore, count: 0 }; current.score += score.score; current.max += score.maxScore; current.count += 1; totals.set(score.key, current); }));
    return Array.from(totals.values()).map((item, index) => ({ label: item.label, value: item.count ? Math.round((item.score / item.max) * 100) : 0, color: colors[index % colors.length] }));
  }, [assessments]);
  const awaiting = assessments.filter((assessment) => assessment.status === 'ai_recommendation').length;
  const assessed = new Set([...assessments.map((assessment) => assessment.studentId), ...reports.map((report) => report.studentId)]).size;
  const publishedRate = assessments.length ? Math.round((reports.length / assessments.length) * 100) : 0;
  const sessionStatus = (session: AcademicSession) => session.status === 'published' ? 'Published' : session.status === 'ready_for_review' ? 'Ready for review' : session.status === 'processing' ? 'Transcript processing' : session.status === 'scheduled' ? 'Scheduled' : 'Draft';
  const sessionTone = (session: AcademicSession) => session.status === 'published' ? 'published' : session.status === 'ready_for_review' ? 'ready' : session.status === 'processing' ? 'processing' : 'ready';

  if (loading) return <div className="flex min-h-[320px] items-center justify-center"><Loader2 size={26} className="animate-spin text-indigo-500" /></div>;
  return <div className="academic-dashboard"><header className="academic-hero"><div><div className="academic-kicker"><GraduationCap size={16} /> Academic assessment workspace</div><h1>Good morning, {user?.name?.split(' ')[0] || 'Evaluator'}.</h1><p>Turn every group discussion into a fair, reviewable learning outcome.</p></div><button onClick={() => navigate('/academic/sessions/new')} className="academic-primary-button"><Plus size={17} /> New GD session</button></header>
    {error && <div className="mx-auto mb-4 max-w-[1400px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <section className="academic-stat-grid" aria-label="Assessment overview"><article className="academic-stat"><span className="academic-stat__icon indigo"><BookOpenCheck size={18} /></span><span className="academic-stat__label">Sessions</span><strong>{sessions.length}</strong><small>{cohorts.length} cohorts</small></article><article className="academic-stat"><span className="academic-stat__icon violet"><FileSearch size={18} /></span><span className="academic-stat__label">Awaiting review</span><strong>{awaiting}</strong><small>AI recommendations</small></article><article className="academic-stat"><span className="academic-stat__icon cyan"><UsersRound size={18} /></span><span className="academic-stat__label">Students assessed</span><strong>{assessed}</strong><small>{studentCount} enrolled</small></article><article className="academic-stat"><span className="academic-stat__icon amber"><CheckCircle2 size={18} /></span><span className="academic-stat__label">Reports published</span><strong>{publishedRate}%</strong><small>{reports.length} published</small></article></section>
    <div className="academic-content-grid"><section className="academic-panel academic-sessions"><div className="academic-panel__header"><div><h2>GD sessions</h2><p>Latest discussion assessments</p></div><button onClick={() => navigate('/calendar')} className="academic-text-button">View calendar <ArrowUpRight size={15} /></button></div><div className="academic-session-list">{sessions.slice(0, 5).map((session) => <article className="academic-session" key={session.id}><span className={`academic-session__mark ${sessionTone(session)}`}><BookOpenCheck size={17} /></span><div className="academic-session__main"><h3>{session.title}</h3><p>{session.topic} <span>•</span> {session.participantIds.length} participants</p></div><div className="academic-session__meta"><span className={`academic-status ${sessionTone(session)}`}>{sessionStatus(session)}</span><small>{session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : 'Not scheduled'}</small></div></article>)}{!sessions.length && <div className="p-6 text-sm text-slate-500">No GD sessions created yet.</div>}</div></section><section className="academic-panel academic-rubric"><div className="academic-panel__header"><div><h2>Class performance</h2><p>Average reviewed rubric score</p></div><span className="academic-score">{rubric.length ? Math.round(rubric.reduce((sum, item) => sum + item.value, 0) / rubric.length) : 0}<small>/100</small></span></div><div className="academic-rubric-list">{rubric.map((item) => <div className="academic-rubric-row" key={item.label}><div><span>{item.label}</span><strong>{item.value}%</strong></div><div className="academic-progress"><span className={item.color} style={{ width: `${item.value}%` }} /></div></div>)}{!rubric.length && <p className="text-sm text-slate-500">Scores will appear after assessments are generated.</p>}</div><div className="academic-rubric-note"><Clock3 size={15} /> Based on {assessments.length} assessment recommendations</div></section></div>
    <section className="academic-panel academic-review-panel"><div className="academic-panel__header"><div><h2>Review queue</h2><p>AI recommendations are ready for teacher review</p></div><button onClick={() => navigate('/academic/reports')} className="academic-text-button">Open evaluation sheets <ArrowUpRight size={15} /></button></div><div className="academic-review-callout"><div className="academic-review-number">{String(awaiting).padStart(2, '0')}</div><div><strong>{awaiting ? 'Student reports need your review' : 'Review queue is clear'}</strong><p>{awaiting ? 'Check evidence excerpts, adjust rubric scores, and publish when you are satisfied.' : 'New recommendations will appear here after transcript assessment.'}</p></div><button onClick={() => navigate('/academic/reports')} className="academic-outline-button">View reports</button></div></section>
  </div>;
};
