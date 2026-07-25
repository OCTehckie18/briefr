import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTranscript, extractTasks, getUsers, createTask } from '../../api/endpoints';
import { Loader2, Sparkles, AlertCircle, FileText, CheckCircle2, ChevronRight, User, Clock } from 'lucide-react';

interface ExtractedTask {
  title: string; description: string; assigneeHint: string; deadlineHint: string;
  priority: 'high' | 'medium' | 'low'; assignedUserId?: string; deadline?: string;
}

export const TranscriptReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState<any>(null);
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [extracting, setExtracting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([getTranscript(id), getUsers()])
      .then(([tRes, uRes]) => { setTranscript(tRes.data); setUsers(uRes.data); return extractTasks(id); })
      .then((res) => { const extracted = res.data.extractedTasks || []; setTasks(extracted.map((t: any) => ({ ...t, assignedUserId: '', deadline: '' }))); setExtracting(false); })
      .catch((err) => { setError(err.response?.data?.detail || 'Extraction failed'); setExtracting(false); });
  }, [id]);

  const updateTask = (index: number, field: string, value: any) => {
    setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const handleSaveAll = async () => {
    if (!transcript || !id) return; setSaving(true); setError('');
    try {
      for (const task of tasks) {
        const assignedUser = users.find((u) => u.id === task.assignedUserId);
        await createTask({ title: task.title, description: task.description, transcriptId: id, projectId: transcript.meetingId,
          assignedTo: assignedUser ? { userId: assignedUser.id, name: assignedUser.name, email: assignedUser.email } : undefined,
          deadline: task.deadline || undefined, priority: task.priority, status: 'todo' });
      }
      setSaved(true);
    } catch (err: any) { setError(err.response?.data?.detail || 'Failed to save tasks'); } finally { setSaving(false); }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -mx-6 -mt-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center shrink-0 bg-[#050510]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Sparkles size={18} /></div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight">Meeting Intelligence</h1>
            <p className="text-xs text-slate-500">Review and confirm AI extracted action items</p>
          </div>
        </div>
        {saved ? (
          <button onClick={() => navigate('/kanban')} className="text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 rounded-xl flex items-center gap-1 shadow-lg shadow-emerald-500/20">
            Go to Kanban <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={handleSaveAll} disabled={saving || extracting || tasks.length === 0}
            className="text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 disabled:opacity-30 px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {saving ? 'Saving...' : 'Confirm & Save'}
          </button>
        )}
      </div>

      {error && <div className="mx-6 mt-4 p-3 rounded-xl text-sm bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-2 shrink-0"><AlertCircle size={16} /> {error}</div>}

      {/* Split Pane */}
      <div className="flex-1 flex gap-4 p-6 min-h-0">
        {/* Left: Transcript */}
        <div className="w-1/2 flex flex-col rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2 bg-white/[0.02]">
            <FileText size={14} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transcript</span>
          </div>
          <div className="flex-1 p-5 overflow-y-auto">
            <pre className="text-sm leading-relaxed text-slate-400 font-sans whitespace-pre-wrap">{transcript?.rawText || 'Loading...'}</pre>
          </div>
        </div>

        {/* Right: Extracted Actions */}
        <div className="w-1/2 flex flex-col rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex justify-between items-center bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Extracted Actions</span>
            </div>
            {!extracting && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-500 border border-white/[0.06]">{tasks.length} found</span>}
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {extracting ? (
              <div className="h-full flex flex-col items-center justify-center gap-4"><Sparkles size={36} className="text-cyan-400 animate-pulse" /><p className="text-sm font-medium text-slate-500">Analyzing conversation...</p></div>
            ) : tasks.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-sm">No actionable items found.</div>
            ) : tasks.map((task, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-all space-y-3">
                <div className="flex gap-3">
                  <input value={task.title} onChange={(e) => updateTask(i, 'title', e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-white placeholder:text-slate-600" placeholder="Task title" />
                  <select value={task.priority} onChange={(e) => updateTask(i, 'priority', e.target.value)}
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border outline-none bg-transparent [&>option]:bg-[#0f172a] ${
                      task.priority === 'high' ? 'text-red-400 border-red-500/30' : task.priority === 'medium' ? 'text-amber-400 border-amber-500/30' : 'text-emerald-400 border-emerald-500/30'
                    }`}>
                    <option value="high">HIGH</option><option value="medium">MED</option><option value="low">LOW</option>
                  </select>
                </div>
                <textarea value={task.description} onChange={(e) => updateTask(i, 'description', e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-xs text-slate-400 resize-none h-16 outline-none focus:border-cyan-500/40 transition-all placeholder:text-slate-700" placeholder="Add details..." />
                {(task.assigneeHint || task.deadlineHint) && (
                  <div className="px-3 py-2 bg-cyan-500/[0.06] rounded-lg border border-cyan-500/20 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1"><Sparkles size={10} /> AI Suggestion</span>
                    <span className="text-xs text-slate-300">{task.assigneeHint && `Assignee: ${task.assigneeHint} `}{task.deadlineHint && `| Due: ${task.deadlineHint}`}</span>
                  </div>
                )}
                <div className="flex gap-3 pt-2 border-t border-white/[0.04]">
                  <div className="flex-1 flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-1.5 focus-within:border-cyan-500/40 transition-colors">
                    <User size={14} className="text-slate-600 shrink-0" />
                    <select value={task.assignedUserId || ''} onChange={(e) => updateTask(i, 'assignedUserId', e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-xs text-slate-300 w-full [&>option]:bg-[#0f172a]">
                      <option value="">Assign owner...</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-1.5 focus-within:border-cyan-500/40 transition-colors">
                    <Clock size={14} className="text-slate-600 shrink-0" />
                    <input type="date" value={task.deadline || ''} onChange={(e) => updateTask(i, 'deadline', e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-xs text-slate-300 w-full [color-scheme:dark]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
