import React from 'react';
import { ArrowUpRight, BookOpenCheck, CheckCircle2, Clock3, FileSearch, GraduationCap, Plus, UsersRound } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate } from 'react-router-dom';

const sessions = [
  { title: 'Should AI be used in classrooms?', group: 'Class XI · Section A', status: 'Ready for review', participants: '8 / 8', date: 'Today, 10:30 AM', tone: 'ready' },
  { title: 'The future of sustainable cities', group: 'Class XII · Section B', status: 'Transcript processing', participants: '7 / 8', date: 'Yesterday, 2:00 PM', tone: 'processing' },
  { title: 'Social media and student wellbeing', group: 'Class XI · Section C', status: 'Published', participants: '8 / 8', date: '12 Aug 2026', tone: 'published' },
];

const rubric = [
  { label: 'Communication clarity', value: 82, color: 'bg-indigo-500' },
  { label: 'Critical thinking', value: 74, color: 'bg-violet-500' },
  { label: 'Collaboration', value: 68, color: 'bg-cyan-500' },
  { label: 'Initiative', value: 61, color: 'bg-amber-500' },
];

export const AcademicDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="academic-dashboard">
      <header className="academic-hero">
        <div>
          <div className="academic-kicker"><GraduationCap size={16} /> Academic assessment workspace</div>
          <h1>Good morning, {user?.name?.split(' ')[0] || 'Evaluator'}.</h1>
          <p>Turn every group discussion into a fair, reviewable learning outcome.</p>
        </div>
        <button onClick={() => navigate('/academic/sessions/new')} className="academic-primary-button"><Plus size={17} /> New GD session</button>
      </header>

      <section className="academic-stat-grid" aria-label="Assessment overview">
        <article className="academic-stat"><span className="academic-stat__icon indigo"><BookOpenCheck size={18} /></span><span className="academic-stat__label">Sessions this term</span><strong>24</strong><small>+6 from last term</small></article>
        <article className="academic-stat"><span className="academic-stat__icon violet"><FileSearch size={18} /></span><span className="academic-stat__label">Awaiting review</span><strong>03</strong><small>Needs your attention</small></article>
        <article className="academic-stat"><span className="academic-stat__icon cyan"><UsersRound size={18} /></span><span className="academic-stat__label">Students assessed</span><strong>186</strong><small>Across 8 cohorts</small></article>
        <article className="academic-stat"><span className="academic-stat__icon amber"><CheckCircle2 size={18} /></span><span className="academic-stat__label">Reports published</span><strong>91%</strong><small>12 reports this week</small></article>
      </section>

      <div className="academic-content-grid">
        <section className="academic-panel academic-sessions">
          <div className="academic-panel__header"><div><h2>GD sessions</h2><p>Your latest discussion assessments</p></div><button className="academic-text-button">View all <ArrowUpRight size={15} /></button></div>
          <div className="academic-session-list">
            {sessions.map((session) => <article className="academic-session" key={session.title}>
              <span className={`academic-session__mark ${session.tone}`}><BookOpenCheck size={17} /></span>
              <div className="academic-session__main"><h3>{session.title}</h3><p>{session.group} <span>•</span> {session.participants} participants</p></div>
              <div className="academic-session__meta"><span className={`academic-status ${session.tone}`}>{session.status}</span><small>{session.date}</small></div>
            </article>)}
          </div>
        </section>

        <section className="academic-panel academic-rubric">
          <div className="academic-panel__header"><div><h2>Class performance</h2><p>Average rubric score</p></div><span className="academic-score">72<small>/100</small></span></div>
          <div className="academic-rubric-list">{rubric.map((item) => <div className="academic-rubric-row" key={item.label}><div><span>{item.label}</span><strong>{item.value}%</strong></div><div className="academic-progress"><span className={item.color} style={{ width: `${item.value}%` }} /></div></div>)}</div>
          <div className="academic-rubric-note"><Clock3 size={15} /> Based on 186 reviewed participant reports</div>
        </section>
      </div>

      <section className="academic-panel academic-review-panel"><div className="academic-panel__header"><div><h2>Review queue</h2><p>AI recommendations are ready for teacher review</p></div><button className="academic-text-button">Open review queue <ArrowUpRight size={15} /></button></div><div className="academic-review-callout"><div className="academic-review-number">03</div><div><strong>Student reports need your review</strong><p>Check evidence excerpts, adjust rubric scores, and publish when you are satisfied.</p></div><button className="academic-outline-button">Review reports</button></div></section>
    </div>
  );
};
