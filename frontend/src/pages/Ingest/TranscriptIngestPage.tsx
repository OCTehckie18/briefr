import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { getProjects, createMeeting, createTranscript } from '../../api/endpoints';
import { Loader2, Upload, Sparkles } from 'lucide-react';

export const TranscriptIngestPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getProjects().then((res) => { setProjects(res.data); if (res.data.length > 0) setSelectedProject(res.data[0].id); }); }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.txt')) { const reader = new FileReader(); reader.onload = (ev) => setTranscriptText(ev.target?.result as string); reader.readAsText(file); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcriptText.trim() || !meetingTitle.trim()) return;
    setError(''); setLoading(true);
    try {
      const meetingRes = await createMeeting({ title: meetingTitle, projectId: selectedProject });
      const transcriptRes = await createTranscript({ meetingId: meetingRes.data.id, rawText: transcriptText });
      navigate(`/transcripts/${transcriptRes.data.id}/review`);
    } catch (err: any) { setError(err.response?.data?.detail || 'Failed to submit'); setLoading(false); }
  };

  if (!isAdmin) { navigate('/'); return null; }

  return (
    <div className="page-shell space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ingest transcript</h1>
          <p className="page-description">Paste a transcript or upload a text file to extract clear, actionable follow-ups.</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
          <Sparkles size={20} />
        </div>
      </div>

      {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 text-center">{error}</div>}

      <form onSubmit={handleSubmit} className="ui-card p-5 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="ui-label">Project</label>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
              className="ui-input [&>option]:bg-[#0f172a]">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="ui-label">Meeting title</label>
            <input type="text" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="e.g. Q3 Roadmap Review" required
              className="ui-input" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="ui-label flex justify-between items-center">
            Transcript Text
            <label className="text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1 normal-case tracking-normal text-xs">
              <Upload size={14} /> Upload .txt
              <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </label>
          <textarea value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} placeholder="[00:00] Alice: Welcome everyone..." rows={10}
            className="ui-input min-h-64 resize-y leading-relaxed text-slate-300" />
        </div>

        <button type="submit" disabled={loading || !transcriptText.trim() || !meetingTitle.trim()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 disabled:opacity-40">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Processing AI...</> : <><Sparkles size={16} /> Extract Action Items</>}
        </button>
      </form>
    </div>
  );
};
