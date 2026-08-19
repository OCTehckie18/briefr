import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, FileText, Loader2, LockKeyhole, Save, UsersRound } from 'lucide-react';
import { getAcademicTranscriptContext, updateAcademicTranscriptMapping } from '../../api/endpoints';
import type { AcademicTranscriptContext } from '../../api/endpoints';

export const AcademicParticipantMappingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [context, setContext] = useState<AcademicTranscriptContext | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAcademicTranscriptContext(id)
      .then((response) => { setContext(response.data); setMappings(response.data.mappings || {}); })
      .catch((requestError: any) => setError(requestError.response?.data?.detail || 'Unable to load transcript context.'))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async (finalize: boolean) => {
    if (!id) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await updateAcademicTranscriptMapping(id, { mappings, finalize });
      setSaved(true);
      setContext((current) => current ? { ...current, mappings, finalized: finalize } : current);
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Unable to save participant mapping.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-500" /></div>;
  if (!context) return <div className="ui-card p-6 text-sm text-red-700">{error || 'Transcript context is unavailable.'}</div>;

  return (
    <div className="page-shell mx-auto max-w-6xl space-y-6">
      <div className="page-header"><div><button onClick={() => navigate('/')} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"><ArrowLeft size={14} /> Back to overview</button><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><UsersRound size={20} /></span><div><h1 className="page-title">Map GD participants</h1><p className="page-description">Match transcript speakers to students before assessment begins.</p></div></div></div><span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${context.finalized ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{context.finalized ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{context.finalized ? 'Mapping finalized' : 'Needs mapping'}</span></div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {saved && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">Participant mapping saved.</div>}
      <div className="grid min-h-[560px] gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <section className="ui-card flex min-h-0 flex-col overflow-hidden"><div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4"><FileText size={16} className="text-indigo-500" /><h2 className="text-sm font-semibold text-slate-800">Transcript</h2></div><pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap p-5 font-sans text-sm leading-relaxed text-slate-600">{context.rawText || 'No transcript text available.'}</pre></section>
        <section className="ui-card flex min-h-0 flex-col overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-semibold text-slate-800">Speaker mapping</h2><p className="mt-1 text-xs text-slate-500">{context.speakers.length} speaker{context.speakers.length === 1 ? '' : 's'} detected</p></div><div className="flex-1 space-y-3 overflow-y-auto p-5">{context.speakers.length === 0 && <p className="text-sm text-slate-500">No speaker labels were detected. Use the format <code className="rounded bg-slate-100 px-1">Name: contribution</code>.</p>}{context.speakers.map((speaker) => <label key={speaker} className="block space-y-1.5"><span className="text-xs font-semibold text-slate-600">{speaker}</span><select disabled={context.finalized} value={mappings[speaker] || ''} onChange={(event) => setMappings((current) => ({ ...current, [speaker]: event.target.value }))} className="ui-input"><option value="">Unmapped</option>{context.students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.studentId}</option>)}</select></label>)}</div><div className="border-t border-slate-200 p-5"><div className="mb-4 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={14} /> Finalizing locks the mapping for assessment.</div><div className="flex flex-col gap-3 sm:flex-row"><button onClick={() => save(false)} disabled={saving || context.finalized} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-50"><Save size={16} /> Save mapping</button><button onClick={() => save(true)} disabled={saving || context.finalized || !context.speakers.length} className="academic-primary-button flex-1 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Finalize mapping</button></div></div></section>
      </div>
    </div>
  );
};
