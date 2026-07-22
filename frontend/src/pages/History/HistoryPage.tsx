import React, { useState, useEffect } from 'react';
import { getMeetings, getTranscripts, getTasks } from '../../api/endpoints';
import { ChevronDown, ChevronRight, FileText, CheckSquare, Loader2 } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMeetings(), getTranscripts(), getTasks()])
      .then(([mRes, tRes, taskRes]) => { setMeetings(mRes.data); setTranscripts(tRes.data); setTasks(taskRes.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-cyan-400" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Meeting History</h1>
        <p className="text-sm text-slate-500 mt-1">Browse past meetings, transcripts, and extracted tasks.</p>
      </div>

      <div className="space-y-3">
        {meetings.map((meeting) => {
          const isExpanded = expanded === meeting.id;
          const transcript = transcripts.find((t) => t.meetingId === meeting.id);
          const meetingTasks = tasks.filter((t) => t.transcriptId === transcript?.id);

          return (
            <div key={meeting.id} className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden transition-all hover:border-white/[0.1]">
              <button onClick={() => setExpanded(isExpanded ? null : meeting.id)}
                className={`w-full px-5 py-4 flex items-center gap-4 text-left transition-colors ${isExpanded ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}>
                {isExpanded ? <ChevronDown size={18} className="text-cyan-400 shrink-0" /> : <ChevronRight size={18} className="text-slate-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-200 truncate">{meeting.title}</h3>
                  <p className="text-xs text-slate-600 mt-1">{new Date(meeting.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {transcript && <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20"><FileText size={12} /> Transcript</span>}
                  {meetingTasks.length > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20"><CheckSquare size={12} /> {meetingTasks.length}</span>}
                </div>
              </button>

              {isExpanded && (
                <div className="p-5 border-t border-white/[0.06] space-y-6">
                  {transcript?.rawText && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Raw Transcript</h4>
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] max-h-64 overflow-y-auto">
                        <pre className="text-sm font-sans text-slate-400 whitespace-pre-wrap leading-relaxed">{transcript.rawText}</pre>
                      </div>
                    </div>
                  )}
                  {meetingTasks.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Extracted Actions</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {meetingTasks.map((task: any) => (
                          <div key={task.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-slate-200 line-clamp-2 leading-snug">{task.title}</span>
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${
                                task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                task.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-white/[0.04] text-slate-500 border-white/[0.06]'
                              }`}>{task.status.replace('_', ' ')}</span>
                            </div>
                            <div className="text-xs text-slate-600 flex items-center justify-between pt-2 border-t border-white/[0.04]">
                              <span>{task.assignedTo?.name || 'Unassigned'}</span>
                              {task.deadline && <span>Due {new Date(task.deadline).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
