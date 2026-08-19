import React, { useState, useEffect } from 'react';
import { getMeetings, getTranscripts, getTasks } from '../../api/endpoints';
import { ChevronDown, ChevronRight, FileText, CheckSquare, Loader2, CalendarDays, Inbox } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';

export const HistoryPage: React.FC = () => {
  const { track } = useAuth();
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
    <div className="page-shell space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{track === 'academic_gd' ? 'Evaluation sheets' : 'Meeting history'}</h1>
          <p className="page-description">{track === 'academic_gd' ? 'Review completed GD assessments, evidence excerpts, score adjustments, and published student reports.' : 'Browse past meetings, their source transcripts, and extracted action items.'}</p>
        </div>
      </div>

      <div className="space-y-3">
        {meetings.length === 0 && <div className="ui-card empty-state"><Inbox size={22} /><span>No meetings have been processed yet.</span></div>}
        {meetings.map((meeting) => {
          const isExpanded = expanded === meeting.id;
          const transcript = transcripts.find((t) => t.meetingId === meeting.id);
          const meetingTasks = tasks.filter((t) => t.transcriptId === transcript?.id);

          return (
            <div key={meeting.id} className="ui-card overflow-hidden transition-all hover:border-white/20">
              <button onClick={() => setExpanded(isExpanded ? null : meeting.id)}
                className={`flex w-full items-center gap-4 px-5 py-5 text-left transition-colors sm:px-6 ${isExpanded ? 'bg-white/[0.04]' : 'hover:bg-white/[0.025]'}`}>
                {isExpanded ? <ChevronDown size={18} className="text-cyan-400 shrink-0" /> : <ChevronRight size={18} className="text-slate-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-100 truncate">{meeting.title}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={13} />{new Date(meeting.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`hidden items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold sm:flex ${transcript ? 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400' : 'border-white/[0.06] bg-white/[0.03] text-slate-500'}`}><FileText size={12} /> {transcript ? 'Transcript' : 'No transcript'}</span>
                  <span className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400"><CheckSquare size={12} /> {meetingTasks.length} tasks</span>
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
