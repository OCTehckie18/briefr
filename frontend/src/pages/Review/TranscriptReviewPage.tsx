import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTranscript, processTranscript } from '../../api/endpoints';
import {
  Loader2, Sparkles, AlertCircle, FileText,
  ChevronRight, Calendar, User, UserX, ListChecks,
} from 'lucide-react';

interface PersonResult {
  name: string;
  matched: boolean;
  kanban: { title: string; description: string; priority: string }[];
}

export const TranscriptReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [transcript, setTranscript] = useState<any>(null);
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<{
    tasks_created: number;
    matched_users: string[];
    unmatched_names: string[];
    people_in_transcript: string[];
    structured: Record<string, { kanban: any[]; calendar: any[] }>;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getTranscript(id)
      .then((res) => setTranscript(res.data))
      .catch(() => setError('Could not load transcript.'));
  }, [id]);

  const handleProcess = async () => {
    if (!id || !meetingDate) return;
    setError('');
    setProcessing(true);
    try {
      const res = await processTranscript(id, meetingDate);
      const data = res.data;
      // Pull structured people map from the transcript's stored extraction
      const transcriptRes = await getTranscript(id);
      const people = transcriptRes.data.structuredExtraction?.people ?? {};
      setResults({
        tasks_created: data.tasks_created,
        matched_users: data.matched_users,
        unmatched_names: data.unmatched_names,
        people_in_transcript: data.people_in_transcript,
        structured: people,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Processing failed. Check your API key and transcript.');
    } finally {
      setProcessing(false);
    }
  };

  const priorityClass = (p: string) =>
    p === 'high'
      ? 'bg-red-500/10 text-red-400 border-red-500/20'
      : p === 'medium'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

  const personResults: PersonResult[] = results
    ? results.people_in_transcript.map((name) => ({
        name,
        matched: results.matched_users.includes(name),
        kanban: results.structured[name]?.kanban ?? [],
      }))
    : [];

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -mx-6 -mt-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center shrink-0 bg-[#050510]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight">Meeting Intelligence</h1>
            <p className="text-xs text-slate-500">AI extracts action items and wires them to your team</p>
          </div>
        </div>
        {done ? (
          <button
            onClick={() => navigate('/kanban')}
            className="text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 rounded-xl flex items-center gap-1 shadow-lg shadow-emerald-500/20"
          >
            Go to Kanban <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleProcess}
            disabled={processing || !transcript}
            className="text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 disabled:opacity-30 px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
          >
            {processing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {processing ? 'Analyzing with AI...' : 'Extract Action Items'}
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl text-sm bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-2 shrink-0">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Split pane */}
      <div className="flex-1 flex gap-4 p-6 min-h-0">

        {/* Left: Transcript + date picker */}
        <div className="w-1/2 flex flex-col gap-4 min-h-0">
          {/* Meeting date */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] shrink-0">
            <Calendar size={15} className="text-cyan-400 shrink-0" />
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">
              Meeting date
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              disabled={processing || done}
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-200 [color-scheme:dark] disabled:opacity-50"
            />
          </div>

          {/* Transcript text */}
          <div className="flex flex-col rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden flex-1 min-h-0">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2 bg-white/[0.02] shrink-0">
              <FileText size={14} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transcript</span>
            </div>
            <div className="flex-1 p-5 overflow-y-auto">
              <pre className="text-sm leading-relaxed text-slate-400 font-sans whitespace-pre-wrap">
                {transcript?.rawText || 'Loading...'}
              </pre>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="w-1/2 flex flex-col rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex justify-between items-center bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-2">
              <ListChecks size={14} className="text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Action Items</span>
            </div>
            {done && results && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {results.tasks_created} tasks saved
              </span>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {!done && !processing && (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <Sparkles size={36} className="text-slate-700" />
                <p className="text-sm text-slate-600 max-w-[240px]">
                  Set the meeting date and click <strong className="text-slate-400">Extract Action Items</strong> to run the AI pipeline.
                </p>
              </div>
            )}

            {processing && (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <Sparkles size={36} className="text-cyan-400 animate-pulse" />
                <p className="text-sm font-medium text-slate-500">Analyzing conversation with AI...</p>
              </div>
            )}

            {done && personResults.map((person) => (
              <div key={person.name} className="rounded-xl border border-white/[0.06] overflow-hidden">
                {/* Person header */}
                <div className="px-4 py-2.5 flex items-center justify-between bg-white/[0.03] border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    {person.matched
                      ? <User size={13} className="text-cyan-400" />
                      : <UserX size={13} className="text-slate-600" />
                    }
                    <span className={`text-sm font-semibold ${person.matched ? 'text-slate-200' : 'text-slate-500'}`}>
                      {person.name}
                    </span>
                    {!person.matched && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500 border border-white/[0.06] uppercase tracking-wider">
                        Not in DB
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-500 border border-white/[0.06]">
                    {person.kanban.length} {person.kanban.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>

                {/* Tasks */}
                {person.kanban.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-600 italic">No action items assigned.</p>
                ) : (
                  <div className="divide-y divide-white/[0.03]">
                    {person.kanban.map((task, i) => (
                      <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 leading-snug">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{task.description}</p>
                          )}
                        </div>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${priorityClass(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {done && results && results.unmatched_names.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-xs text-amber-400">
                <strong>Heads up:</strong> Tasks for{' '}
                <strong>{results.unmatched_names.join(', ')}</strong> were saved without an assignee â€”
                their names weren't found in the user database. You can assign them manually from the Kanban board.
              </div>
            )}

            {done && results && results.tasks_created === 0 && (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                No action items were found in this transcript.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

