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
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
          <Sparkles size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ingest Transcript</h1>
          <p className="text-sm text-slate-500 mt-1.5">Paste or upload a meeting transcript for AI extraction.</p>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 text-center">{error}</div>}

      <form onSubmit={handleSubmit} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Project</label>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.03] border border-white/[0.06] text-white focus:outline-none focus:border-cyan-500/50 transition-all [&>option]:bg-[#0f172a]">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Meeting Title</label>
            <input type="text" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="e.g. Q3 Roadmap Review" required
              className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.03] border border-white/[0.06] text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-600" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center">
            Transcript Text
            <label className="text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1 normal-case tracking-normal text-xs">
              <Upload size={14} /> Upload .txt
              <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </label>
          <textarea value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} placeholder="[00:00] Alice: Welcome everyone..." rows={10}
            className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.03] border border-white/[0.06] text-slate-300 focus:outline-none focus:border-cyan-500/50 transition-all resize-y font-sans leading-relaxed placeholder:text-slate-700" />
        </div>

        <button type="submit" disabled={loading || !transcriptText.trim() || !meetingTitle.trim()}
          className="w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 transition-all disabled:opacity-40 shadow-lg shadow-indigo-500/20">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Processing AI...</> : <><Sparkles size={16} /> Extract Action Items</>}
        </button>
      </form>
    </div>
  );
};
