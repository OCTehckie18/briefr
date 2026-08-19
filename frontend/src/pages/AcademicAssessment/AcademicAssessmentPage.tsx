import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, FileSearch, Loader2, Sparkles } from 'lucide-react';
import { generateAcademicAssessments, getAcademicAssessments, getAcademicTranscriptContext } from '../../api/endpoints';
import type { AcademicAssessment, AcademicTranscriptContext } from '../../api/endpoints';

export const AcademicAssessmentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [context, setContext] = useState<AcademicTranscriptContext | null>(null);
  const [assessments, setAssessments] = useState<AcademicAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([getAcademicTranscriptContext(id), getAcademicAssessments(id)])
      .then(([contextResponse, assessmentResponse]) => { setContext(contextResponse.data); setAssessments(assessmentResponse.data); })
      .catch((requestError: any) => setError(requestError.response?.data?.detail || 'Unable to load assessment workspace.'))
      .finally(() => setLoading(false));
  }, [id]);

  const runAssessment = async () => {
    if (!id) return;
    setGenerating(true); setError('');
    try { const response = await generateAcademicAssessments(id); setAssessments(response.data); }
    catch (requestError: any) { setError(requestError.response?.data?.detail || 'Assessment generation failed.'); }
    finally { setGenerating(false); }
  };

  const studentName = (studentId: string) => context?.students.find((student) => student.id === studentId)?.name || studentId;
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-500" /></div>;

  return <div className="page-shell mx-auto max-w-6xl space-y-6">
    <div className="page-header"><div><button onClick={() => navigate(`/academic/transcripts/${id}/map`)} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"><ArrowLeft size={14} /> Back to mapping</button><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><FileSearch size={20} /></span><div><h1 className="page-title">Assessment recommendations</h1><p className="page-description">AI-generated scores grounded in the mapped transcript. Review before publishing.</p></div></div></div><button onClick={runAssessment} disabled={generating || !context?.finalized} className="academic-primary-button disabled:opacity-50">{generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {assessments.length ? 'Regenerate recommendations' : 'Generate recommendations'}</button></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
    {!assessments.length && !generating && <div className="ui-card flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center"><Sparkles size={34} className="text-violet-400" /><h2 className="text-base font-semibold text-slate-800">Ready for AI assessment</h2><p className="max-w-md text-sm text-slate-500">Generate a recommendation for each mapped student. Every score will include rationale and transcript evidence where available.</p></div>}
    {generating && <div className="ui-card flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center"><Loader2 size={30} className="animate-spin text-violet-500" /><p className="text-sm text-slate-500">Analyzing mapped contributions and rubric evidence…</p></div>}
    <div className="grid gap-5 lg:grid-cols-2">{assessments.map((assessment) => <article key={assessment.id} className="ui-card overflow-hidden"><div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="text-base font-semibold text-slate-800">{studentName(assessment.studentId)}</h2><p className="mt-1 text-xs text-slate-500">AI recommendation · requires teacher review</p></div><span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700"><AlertCircle size={12} /> Recommendation</span></div><div className="space-y-4 p-5"><p className="text-sm leading-relaxed text-slate-600">{assessment.summary}</p><div className="space-y-3">{assessment.scores.map((score) => <div key={score.key}><div className="flex justify-between text-xs"><span className="font-semibold text-slate-600">{score.label}</span><strong className="text-slate-800">{score.score}/{score.maxScore}</strong></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, (score.score / score.maxScore) * 100)}%` }} /></div><p className="mt-1 text-xs text-slate-500">{score.rationale}</p>{score.evidence.slice(0, 1).map((evidence, index) => <blockquote key={index} className="mt-2 border-l-2 border-violet-200 pl-3 text-xs italic text-slate-400">“{evidence.quote}” {evidence.timestamp && <span>· {evidence.timestamp}</span>}</blockquote>)}</div>)}</div><div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"><div><h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Strengths</h3><ul className="mt-2 space-y-1 text-xs text-slate-500">{assessment.strengths.map((item) => <li key={item}>• {item}</li>)}</ul></div><div><h3 className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Improve</h3><ul className="mt-2 space-y-1 text-xs text-slate-500">{assessment.improvements.map((item) => <li key={item}>• {item}</li>)}</ul></div></div></div></article>)}</div>
  </div>;
};
