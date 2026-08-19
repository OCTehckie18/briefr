import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, FileText, Loader2, Search } from 'lucide-react';
import { getMeeting, getTasks, getTranscripts, updateTaskStatus } from '../../api/endpoints';
import type { Meeting, Task, Transcript } from '../../api/endpoints';
import { Badge } from '../../components/ui/Badge';
import './MeetingReport.css';

const statusLabel: Record<string, string> = { pending: 'Scheduled', joining: 'Bot joining', recording: 'Recording', done: 'Complete', failed: 'Failed' };
const taskStatusClass: Record<string, string> = { todo: 'border-white/[0.06] bg-white/[0.04] text-slate-400', in_progress: 'border-amber-500/20 bg-amber-500/10 text-amber-400', done: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' };

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const MeetingReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([getMeeting(id), getTranscripts(), getTasks()])
      .then(([meetingRes, transcriptRes, taskRes]) => {
        const currentMeeting = meetingRes.data;
        const currentTranscript = transcriptRes.data.find((item) => item.meetingId === currentMeeting.id) || null;
        setMeeting(currentMeeting);
        setTranscript(currentTranscript);
        setTasks(taskRes.data.filter((task) => task.projectId === currentMeeting.projectId || task.transcriptId === currentTranscript?.id));
      })
      .catch((err: any) => setError(err.response?.data?.detail || 'Could not load this meeting.'))
      .finally(() => setLoading(false));
  }, [id, retryAttempt]);

  const retry = () => {
    setLoading(true);
    setError('');
    setRetryAttempt((attempt) => attempt + 1);
  };

  const transcriptParts = useMemo(() => {
    const text = transcript?.rawText || '';
    if (!search.trim()) return [text];
    return text.split(new RegExp(`(${escapeRegExp(search)})`, 'gi'));
  }, [transcript, search]);

  const changeTaskStatus = async (task: Task, status: Task['status']) => {
    setUpdatingTask(task.id);
    try {
      const response = await updateTaskStatus(task.id, status);
      setTasks((current) => current.map((item) => item.id === task.id ? response.data : item));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not update task status.');
    } finally {
      setUpdatingTask(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-cyan-400" /></div>;
  if (error && !meeting) return <div className="page-shell space-y-4"><div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400"><AlertCircle className="mr-2 inline" size={16} />{error}</div><div className="flex gap-4"><button onClick={retry} className="text-sm font-semibold text-cyan-400">Retry</button><button onClick={() => navigate('/history')} className="text-sm text-slate-500">Back to history</button></div></div>;
  if (!meeting) return null;

  return (
    <div className="page-shell space-y-6">
      <button onClick={() => navigate('/history')} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-cyan-400"><ArrowLeft size={16} /> Back to meeting history</button>
      <div className="page-header">
        <div>
          <h1 className="page-title">{meeting.title}</h1>
          <p className="page-description flex flex-wrap items-center gap-2"><Clock size={14} />{new Date(meeting.scheduledAt || meeting.createdAt).toLocaleString()}<span>·</span>{meeting.memberIds.length} participant{meeting.memberIds.length === 1 ? '' : 's'}</p>
        </div>
        {meeting.botStatus && <Badge variant={meeting.botStatus === 'failed' ? 'danger' : meeting.botStatus === 'done' ? 'success' : 'warning'}>{statusLabel[meeting.botStatus] || meeting.botStatus}</Badge>}
      </div>
      {error && <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"><span><AlertCircle className="mr-2 inline" size={15} />{error}</span><button onClick={retry} className="font-semibold text-red-300 hover:text-white">Retry</button></div>}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="ui-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div className="flex items-center gap-2"><FileText size={16} className="text-cyan-400" /><h2 className="text-sm font-semibold text-white">Transcript</h2></div><span className="text-xs text-slate-500">{transcript ? `${transcript.rawText.length.toLocaleString()} characters` : 'Pending'}</span></div>
          {transcript ? <><div className="border-b border-white/[0.06] px-5 py-3"><div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2"><Search size={14} className="text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transcript" className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600" /></div></div><pre className="max-h-[620px] overflow-y-auto whitespace-pre-wrap p-5 font-sans text-sm leading-relaxed text-slate-400">{transcriptParts.map((part, index) => part.toLowerCase() === search.toLowerCase() && search ? <mark key={index}>{part}</mark> : part)}</pre></> : <div className="p-8 text-center text-sm text-slate-600">The transcript is not available yet.</div>}
        </section>

        <section className="ui-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-white">Action items</h2><span className="text-xs text-slate-500">{tasks.length} total</span></div>
          <div className="space-y-3 p-4">
            {tasks.length === 0 && <div className="py-8 text-center text-sm text-slate-600">No tasks are linked to this meeting.</div>}
            {tasks.map((task) => <div key={task.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex items-start justify-between gap-3"><p className={`text-sm font-medium ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{task.title}</p>{task.status === 'done' && <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />}</div>{task.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{task.description}</p>}<div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3"><span className="text-xs text-slate-600">{task.assignedTo?.name || 'Unassigned'}</span><select value={task.status} disabled={updatingTask === task.id} onChange={(event) => changeTaskStatus(task, event.target.value as Task['status'])} className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase outline-none ${taskStatusClass[task.status]}`}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></div></div>)}
          </div>
        </section>
      </div>
    </div>
  );
};
