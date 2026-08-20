import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { getProjects, createMeeting, createTranscript } from '../../api/endpoints';
import type { Project } from '../../api/endpoints';
import { Loader2, Upload, Sparkles } from 'lucide-react';

export const TranscriptIngestPage: React.FC = () => {
  const { isAdmin, track } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getProjects()
      .then((res) => {
        setProjects(res.data);
        setSelectedProject((current) => current || res.data[0]?.id || '');
      })
      .catch((err: any) => setError(err.response?.data?.detail || 'Could not load projects.'))
      .finally(() => setProjectsLoading(false));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setError('Please upload a plain text (.txt) transcript.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setTranscriptText(typeof ev.target?.result === 'string' ? ev.target.result : '');
    reader.onerror = () => setError('Could not read that transcript file.');
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return setError('Select a project before continuing.');
    if (!transcriptText.trim()) return setError('Add a transcript before continuing.');
    if (!meetingTitle.trim()) return setError('Add a meeting title before continuing.');
    setError(''); setLoading(true);
    try {
      const meetingRes = await createMeeting({ title: meetingTitle.trim(), projectId: selectedProject, meetingType: track === 'academic_gd' ? 'academic_gd' : 'industry' });
      const transcriptRes = await createTranscript({ meetingId: meetingRes.data.id, rawText: transcriptText.trim() });
      navigate(track === 'academic_gd' ? `/academic/transcripts/${transcriptRes.data.id}/map` : `/transcripts/${transcriptRes.data.id}/review`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not save the meeting and transcript. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) { navigate('/'); return null; }

  return (
    <div className="page-shell space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{track === 'academic_gd' ? 'Analyze recorded GD' : 'Ingest transcript'}</h1>
          <p className="page-description">{track === 'academic_gd' ? 'Upload a recorded group discussion transcript to prepare participant evidence and evaluation recommendations.' : 'Paste a transcript or upload a text file to extract clear, actionable follow-ups.'}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
          <Sparkles size={20} />
        </div>
      </div>

      {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 text-center">{error}</div>}

      <form onSubmit={handleSubmit} className="ui-card p-5 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="ui-label">{track === 'academic_gd' ? 'Class / cohort' : 'Project'}</label>
            <select required value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} disabled={projectsLoading || loading}
              className="ui-input [&>option]:bg-[#0f172a] disabled:opacity-50">
              <option value="">{projectsLoading ? 'Loading projects...' : 'Select a project'}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {!projectsLoading && projects.length === 0 && <p className="text-xs text-amber-400">Create a project before ingesting a transcript.</p>}
          </div>
          <div className="space-y-1.5">
            <label className="ui-label">{track === 'academic_gd' ? 'GD topic' : 'Meeting title'}</label>
            <input type="text" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="e.g. Q3 Roadmap Review" required
              className="ui-input" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="ui-label flex justify-between items-center">
            {track === 'academic_gd' ? 'Recorded discussion transcript' : 'Transcript Text'}
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
          {loading ? <><Loader2 size={16} className="animate-spin" /> Saving transcript...</> : <><Sparkles size={16} /> Continue to review</>}
        </button>
      </form>
    </div>
  );
};
