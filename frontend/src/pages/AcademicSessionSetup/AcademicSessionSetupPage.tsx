import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, GraduationCap, Loader2, Plus, Save, UsersRound } from 'lucide-react';
import {
  createAcademicCohort,
  createAcademicRubric,
  createAcademicStudent,
  createAcademicSession,
  getAcademicCohorts,
  getAcademicRubrics,
  getAcademicStudents,
} from '../../api/endpoints';
import type { AcademicCohort, AcademicRubric, AcademicStudent } from '../../api/endpoints';

export const AcademicSessionSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState<AcademicCohort[]>([]);
  const [students, setStudents] = useState<AcademicStudent[]>([]);
  const [rubrics, setRubrics] = useState<AcademicRubric[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [rubricId, setRubricId] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);
  const [cohortForm, setCohortForm] = useState({ name: '', grade: '', section: '', academicYear: '' });
  const [rubricName, setRubricName] = useState('');
  const [studentForm, setStudentForm] = useState({ studentId: '', name: '', email: '' });

  useEffect(() => {
    Promise.all([getAcademicCohorts(), getAcademicRubrics()])
      .then(([cohortResponse, rubricResponse]) => {
        setCohorts(cohortResponse.data);
        setRubrics(rubricResponse.data);
        setCohortId(cohortResponse.data[0]?.id || '');
        setRubricId(rubricResponse.data[0]?.id || '');
      })
      .catch(() => setError('Unable to load cohorts and rubrics.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!cohortId) {
      setStudents([]);
      setParticipantIds([]);
      return;
    }
    getAcademicStudents(cohortId)
      .then((response) => {
        setStudents(response.data);
        setParticipantIds(response.data.map((student) => student.id));
      })
      .catch(() => setError('Unable to load students for this cohort.'));
  }, [cohortId]);

  const selectedRubric = useMemo(() => rubrics.find((rubric) => rubric.id === rubricId), [rubrics, rubricId]);
  const allSelected = students.length > 0 && participantIds.length === students.length;

  const toggleStudent = (studentId: string) => {
    setParticipantIds((current) => current.includes(studentId)
      ? current.filter((id) => id !== studentId)
      : [...current, studentId]);
  };

  const createCohort = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setSetupSaving(true);
    try { const response = await createAcademicCohort(cohortForm); setCohorts((current) => [...current, response.data]); setCohortId(response.data.id); setCohortForm({ name: '', grade: '', section: '', academicYear: '' }); }
    catch (requestError: any) { setError(requestError.response?.data?.detail || 'Unable to create cohort.'); }
    finally { setSetupSaving(false); }
  };

  const createRubric = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setSetupSaving(true);
    try { const response = await createAcademicRubric({ name: rubricName, description: 'Baseline academic group discussion rubric', dimensions: [{ key: 'communication', label: 'Communication clarity', description: 'Clarity, confidence, and listening', maxScore: 5 }, { key: 'critical_thinking', label: 'Critical thinking', description: 'Reasoning, relevance, and evidence', maxScore: 5 }, { key: 'collaboration', label: 'Collaboration', description: 'Respect, turn-taking, and building on peers', maxScore: 5 }, { key: 'initiative', label: 'Initiative', description: 'Constructive participation and leadership', maxScore: 5 }] }); setRubrics((current) => [...current, response.data]); setRubricId(response.data.id); setRubricName(''); }
    catch (requestError: any) { setError(requestError.response?.data?.detail || 'Unable to create rubric.'); }
    finally { setSetupSaving(false); }
  };

  const addStudent = async (event: React.FormEvent) => {
    event.preventDefault(); if (!cohortId) return; setError(''); setSetupSaving(true);
    try { const response = await createAcademicStudent({ ...studentForm, cohortId }); setStudents((current) => [...current, response.data]); setParticipantIds((current) => [...current, response.data.id]); setStudentForm({ studentId: '', name: '', email: '' }); }
    catch (requestError: any) { setError(requestError.response?.data?.detail || 'Unable to add student.'); }
    finally { setSetupSaving(false); }
  };

  const handleSubmit = async (event: React.FormEvent, shouldSchedule: boolean) => {
    event.preventDefault();
    setError('');
    if (!cohortId || !rubricId) return setError('Select a cohort and rubric first.');
    if (!participantIds.length) return setError('Select at least one student.');
    setSubmitting(true);
    try {
      await createAcademicSession({
        title: title.trim(),
        topic: topic.trim(),
        cohortId,
        rubricId,
        participantIds,
        durationMinutes: Number(durationMinutes),
        ...(shouldSchedule && scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
      });
      navigate('/');
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Unable to create the GD session.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="page-shell mx-auto max-w-5xl space-y-6">
      <div className="page-header">
        <div>
          <button onClick={() => navigate('/')} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"><ArrowLeft size={14} /> Back to overview</button>
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><GraduationCap size={20} /></span><div><h1 className="page-title">Set up a GD session</h1><p className="page-description">Define the cohort, participants, and rubric before collecting the discussion.</p></div></div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {!cohorts.length || !rubrics.length ? (
        <div className="grid gap-5 md:grid-cols-2"><form onSubmit={createCohort} className="ui-card space-y-4 p-6"><div><h2 className="text-base font-semibold text-slate-800">Create your first cohort</h2><p className="mt-1 text-sm text-slate-500">Set up the class you are assessing.</p></div><input required placeholder="Cohort name · e.g. Class XI A" value={cohortForm.name} onChange={(event) => setCohortForm({ ...cohortForm, name: event.target.value })} className="ui-input" /><div className="grid grid-cols-2 gap-3"><input required placeholder="Grade" value={cohortForm.grade} onChange={(event) => setCohortForm({ ...cohortForm, grade: event.target.value })} className="ui-input" /><input required placeholder="Section" value={cohortForm.section} onChange={(event) => setCohortForm({ ...cohortForm, section: event.target.value })} className="ui-input" /></div><input required placeholder="Academic year · e.g. 2026-27" value={cohortForm.academicYear} onChange={(event) => setCohortForm({ ...cohortForm, academicYear: event.target.value })} className="ui-input" /><button disabled={setupSaving} className="academic-primary-button w-full disabled:opacity-50"><Plus size={16} /> Create cohort</button></form><form onSubmit={createRubric} className="ui-card space-y-4 p-6"><div><h2 className="text-base font-semibold text-slate-800">Choose your first rubric</h2><p className="mt-1 text-sm text-slate-500">Start with a balanced four-dimension baseline rubric.</p></div><input required placeholder="Rubric name · e.g. Baseline GD rubric" value={rubricName} onChange={(event) => setRubricName(event.target.value)} className="ui-input" /><div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Communication clarity · Critical thinking · Collaboration · Initiative</div><button disabled={setupSaving} className="academic-primary-button w-full disabled:opacity-50"><Plus size={16} /> Use baseline rubric</button></form></div>
      ) : (
        <form className="space-y-5" onSubmit={(event) => handleSubmit(event, Boolean(scheduledAt))}>
          <section className="ui-card space-y-5 p-6">
            <div><h2 className="text-base font-semibold text-slate-800">Session details</h2><p className="mt-1 text-sm text-slate-500">Give the discussion a clear identity for review and reporting.</p></div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-1.5"><span className="ui-label">Session title</span><input required value={title} onChange={(event) => setTitle(event.target.value)} className="ui-input" placeholder="e.g. AI in classrooms" /></label>
              <label className="space-y-1.5"><span className="ui-label">Discussion topic</span><input required value={topic} onChange={(event) => setTopic(event.target.value)} className="ui-input" placeholder="e.g. Should AI be used in classrooms?" /></label>
              <label className="space-y-1.5"><span className="ui-label">Cohort</span><span className="relative block"><select required value={cohortId} onChange={(event) => setCohortId(event.target.value)} className="ui-input appearance-none pr-10">{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name} · {cohort.grade} · Section {cohort.section}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-3 text-slate-400" /></span></label>
              <label className="space-y-1.5"><span className="ui-label">Rubric</span><span className="relative block"><select required value={rubricId} onChange={(event) => setRubricId(event.target.value)} className="ui-input appearance-none pr-10">{rubrics.map((rubric) => <option key={rubric.id} value={rubric.id}>{rubric.name} · {rubric.dimensions.length} dimensions</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-3 text-slate-400" /></span></label>
              <label className="space-y-1.5"><span className="ui-label">Date and time <span className="font-normal text-slate-400">(optional)</span></span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="ui-input" /></label>
              <label className="space-y-1.5"><span className="ui-label">Duration</span><select value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className="ui-input"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></label>
            </div>
          </section>

          <section className="ui-card space-y-5 p-6">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold text-slate-800">Participants</h2><p className="mt-1 text-sm text-slate-500">Choose the students whose contributions will be assessed.</p></div><span className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700"><UsersRound size={14} /> {participantIds.length} selected</span></div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-xs text-slate-500">{students.length} students in this cohort</span><button type="button" onClick={() => setParticipantIds(allSelected ? [] : students.map((student) => student.id))} className="text-xs font-semibold text-indigo-600">{allSelected ? 'Clear all' : 'Select all'}</button></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{students.map((student) => { const selected = participantIds.includes(student.id); return <button type="button" key={student.id} onClick={() => toggleStudent(student.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{selected ? <Check size={15} /> : student.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="min-w-0"><strong className="block truncate text-sm text-slate-700">{student.name}</strong><small className="text-xs text-slate-400">{student.studentId}</small></span></button>; })}</div>
            {!students.length && <form onSubmit={addStudent} className="grid gap-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4 md:grid-cols-[.7fr_1fr_1fr_auto]"><input required placeholder="Student ID" value={studentForm.studentId} onChange={(event) => setStudentForm({ ...studentForm, studentId: event.target.value })} className="ui-input" /><input required placeholder="Student name" value={studentForm.name} onChange={(event) => setStudentForm({ ...studentForm, name: event.target.value })} className="ui-input" /><input type="email" placeholder="Email (optional)" value={studentForm.email} onChange={(event) => setStudentForm({ ...studentForm, email: event.target.value })} className="ui-input" /><button disabled={setupSaving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} /> Add student</button></form>}
          </section>

          <section className="ui-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Selected rubric</p><p className="mt-1 text-sm font-semibold text-slate-700">{selectedRubric?.name}</p><p className="mt-1 text-xs text-slate-500">{selectedRubric?.dimensions.map((dimension) => dimension.label).join(' · ')}</p></div><div className="flex flex-col-reverse gap-3 sm:flex-row"><button type="button" onClick={() => navigate('/')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" disabled={submitting} className="academic-primary-button disabled:opacity-50">{submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {scheduledAt ? 'Schedule GD session' : 'Save draft'}</button></div></section>
        </form>
      )}
    </div>
  );
};
