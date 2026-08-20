import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, FileSearch, Loader2, Save, Sparkles } from 'lucide-react';
import { generateAcademicAssessments, getAcademicAssessments, getAcademicTranscriptContext, publishAcademicAssessment, reviewAcademicAssessment } from '../../api/endpoints';
import type { AcademicAssessment, AcademicAssessmentScore, AcademicTranscriptContext } from '../../api/endpoints';

export const AcademicAssessmentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [context, setContext] = useState<AcademicTranscriptContext | null>(null);
  const [assessments, setAssessments] = useState<AcademicAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [draftScores, setDraftScores] = useState<Record<string, AcademicAssessmentScore[]>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [published, setPublished] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!id) return;
    Promise.all([getAcademicTranscriptContext(id), getAcademicAssessments(id)])
      .then(([contextResponse, assessmentResponse]) => { setContext(contextResponse.data); setAssessments(assessmentResponse.data); setDraftScores(Object.fromEntries(assessmentResponse.data.map((item) => [item.id, item.scores]))); setReviewNotes(Object.fromEntries(assessmentResponse.data.map((item) => [item.id, item.reviewNote || '']))); })
      .catch((requestError: any) => setError(requestError.response?.data?.detail || 'Unable to load assessment workspace.'))
      .finally(() => setLoading(false));
  }, [id]);

  const runAssessment = async () => {
    if (!id) return;
    setGenerating(true); setError('');
    try { const response = await generateAcademicAssessments(id); setAssessments(response.data); setDraftScores(Object.fromEntries(response.data.map((item) => [item.id, item.scores]))); setReviewNotes(Object.fromEntries(response.data.map((item) => [item.id, '']))); }
    catch (requestError: any) { setError(requestError.response?.data?.detail || 'Assessment generation failed.'); }
    finally { setGenerating(false); }
  };

  const saveReview = async (assessment: AcademicAssessment) => {
    setError('');
    try {
      const response = await reviewAcademicAssessment(assessment.id, { scores: draftScores[assessment.id] || assessment.scores, reviewNote: reviewNotes[assessment.id] || '' });
      setAssessments((current) => current.map((item) => item.id === assessment.id ? response.data : item));
    } catch (requestError: any) { setError(requestError.response?.data?.detail || 'Unable to save teacher review.'); }
  };

  const publish = async (assessment: AcademicAssessment) => {
    setError('');
    try { await publishAcademicAssessment(assessment.id); setPublished((current) => ({ ...current, [assessment.id]: true })); }
    catch (requestError: any) { setError(requestError.response?.data?.detail || 'Unable to publish report.'); }
  };

  const studentName = (studentId: string) => context?.students.find((student) => student.id === studentId)?.name || studentId;
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-500" /></div>;

  return <div className="page-shell mx-auto max-w-6xl space-y-6">
    <div className="page-header"><div><button onClick={() => navigate(`/academic/transcripts/${id}/map`)} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"><ArrowLeft size={14} /> Back to mapping</button><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><FileSearch size={20} /></span><div><h1 className="page-title">Assessment recommendations</h1><p className="page-description">AI-generated scores grounded in the mapped transcript. Review before publishing.</p></div></div></div><button onClick={runAssessment} disabled={generating || !context?.finalized} className="academic-primary-button disabled:opacity-50">{generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {assessments.length ? 'Regenerate recommendations' : 'Generate recommendations'}</button></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
    {!assessments.length && !generating && <div className="ui-card flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center"><Sparkles size={34} className="text-violet-400" /><h2 className="text-base font-semibold text-slate-800">Ready for AI assessment</h2><p className="max-w-md text-sm text-slate-500">Generate a recommendation for each mapped student. Every score will include rationale and transcript evidence where available.</p></div>}
    {generating && <div className="ui-card flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center"><Loader2 size={30} className="animate-spin text-violet-500" /><p className="text-sm text-slate-500">Analyzing mapped contributions and rubric evidence…</p></div>}
    <div className="grid gap-5 lg:grid-cols-2">{assessments.map((assessment) => <article key={assessment.id} className="ui-card overflow-hidden"><div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="text-base font-semibold text-slate-800">{studentName(assessment.studentId)}</h2><p className="mt-1 text-xs text-slate-500">{assessment.status === 'reviewed' ? 'Teacher reviewed' : 'AI recommendation · requires teacher review'}</p></div><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${assessment.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>{assessment.status === 'reviewed' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}{assessment.status === 'reviewed' ? 'Reviewed' : 'Recommendation'}</span></div><div className="space-y-4 p-5"><p className="text-sm leading-relaxed text-slate-600">{assessment.summary}</p><div className="space-y-3">{(draftScores[assessment.id] || assessment.scores).map((score, index) => <div key={score.key}><div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{score.label}</span><span className="flex items-center gap-1"><input type="number" min={0} max={score.maxScore} step="0.5" value={score.score} onChange={(event) => setDraftScores((current) => ({ ...current, [assessment.id]: (current[assessment.id] || assessment.scores).map((item, itemIndex) => itemIndex === index ? { ...item, score: Number(event.target.value) } : item) }))} className="w-14 rounded border border-slate-200 px-1.5 py-1 text-right text-xs text-slate-700" /><span className="text-slate-400">/{score.maxScore}</span></span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, (score.score / score.maxScore) * 100)}%` }} /></div><p className="mt-1 text-xs text-slate-500">{score.rationale}</p>{score.evidence.slice(0, 1).map((evidence, evidenceIndex) => <blockquote key={evidenceIndex} className="mt-2 border-l-2 border-violet-200 pl-3 text-xs italic text-slate-400">“{evidence.quote}” {evidence.timestamp && <span>· {evidence.timestamp}</span>}</blockquote>)}</div>)}</div><div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"><div><h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Strengths</h3><ul className="mt-2 space-y-1 text-xs text-slate-500">{assessment.strengths.map((item) => <li key={item}>• {item}</li>)}</ul></div><div><h3 className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Improve</h3><ul className="mt-2 space-y-1 text-xs text-slate-500">{assessment.improvements.map((item) => <li key={item}>• {item}</li>)}</ul></div></div><textarea value={reviewNotes[assessment.id] || ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [assessment.id]: event.target.value }))} placeholder="Optional teacher review note" className="ui-input min-h-20 resize-y text-xs" /><div className="flex gap-3"><button onClick={() => saveReview(assessment)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"><Save size={15} /> Save review</button><button onClick={() => publish(assessment)} disabled={assessment.status !== 'reviewed' || published[assessment.id]} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 disabled:opacity-50">{published[assessment.id] ? <CheckCircle2 size={15} /> : <Sparkles size={15} />} {published[assessment.id] ? 'Published' : 'Publish report'}</button></div></div></article>)}</div>
  </div>;
};
