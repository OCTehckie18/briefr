import React, { useEffect, useState, useRef } from 'react';
import {
  Video,
  Calendar,
  Users,
  Link2,
  ChevronDown,
  Bot,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Radio,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axios';
import { getMeetings, getProjects, getUsers, createMeeting } from '../../api/endpoints';
import type { Meeting, Project, User } from '../../api/endpoints';
import { useAuth } from '../../store/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────

// ── Bot status badge ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType; pulse: boolean }> = {
  pending: { label: 'Scheduled', color: 'text-slate-400 bg-slate-800 border-slate-700', Icon: Clock, pulse: false },
  joining: { label: 'Bot joining…', color: 'text-blue-300 bg-blue-950 border-blue-700', Icon: Loader2, pulse: true },
  recording: { label: 'Recording', color: 'text-red-300 bg-red-950 border-red-700', Icon: Radio, pulse: true },
  done: { label: 'Complete', color: 'text-emerald-300 bg-emerald-950 border-emerald-700', Icon: CheckCircle2, pulse: false },
  failed: { label: 'Failed', color: 'text-rose-300 bg-rose-950 border-rose-700', Icon: XCircle, pulse: false },
};

function BotStatusBadge({ status }: { status: string | null }) {
  const cfg = status ? STATUS_CONFIG[status] : null;
  if (!cfg) return null;
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${cfg.color}`}>
      <Icon size={12} className={cfg.pulse ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  );
}

// ── Scheduled meeting status card ──────────────────────────────────────────

function MeetingStatusCard({ meeting, onDismiss }: { meeting: Meeting; onDismiss: () => void }) {
  const [liveStatus, setLiveStatus] = useState<string | null>(meeting.botStatus ?? null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const TERMINAL = new Set(['done', 'failed', null]);
    if (TERMINAL.has(liveStatus)) return;

    pollRef.current = window.setInterval(async () => {
      try {
        const { data } = await axiosClient.get<Meeting>(`/api/meetings/${meeting.id}`);
        const nextStatus = data.botStatus ?? null;
        setLiveStatus(nextStatus);
        if (TERMINAL.has(nextStatus)) clearInterval(pollRef.current!);
      } catch {}
    }, 10_000);

    return () => clearInterval(pollRef.current!);
  }, [meeting.id, liveStatus]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{meeting.title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{meeting.meetingLink}</p>
          {meeting.scheduledAt && (
            <p className="mt-1 text-xs text-slate-500">
              {new Date(meeting.scheduledAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <BotStatusBadge status={liveStatus} />
          {(liveStatus === 'done' || liveStatus === 'failed') && (
            <button
              onClick={onDismiss}
              className="text-xs text-slate-600 hover:text-slate-400"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {liveStatus === 'joining' && (
        <p className="mt-3 rounded-xl border border-blue-900/40 bg-blue-950/30 px-3 py-2 text-xs text-blue-300">
          <AlertCircle size={11} className="mr-1 inline" />
          The bot is in the waiting room. Please admit it from your Google Meet lobby.
        </p>
      )}
      {liveStatus === 'done' && (
        <div className="mt-3 rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-3 text-xs text-emerald-300">
          <p className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="shrink-0" />
            Transcript processed! Tasks have been created and assigned.
          </p>
          <div className="mt-3 text-right">
            <Link
              to={`/meetings/${meeting.id}`}
              className="inline-flex items-center gap-1 rounded bg-emerald-900/50 px-3 py-1.5 font-medium text-emerald-200 hover:bg-emerald-800/60 hover:text-white transition-colors"
            >
              Analyze transcript <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export const ScheduleMeetingPage: React.FC = () => {
  const { track } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scheduledMeetings, setScheduledMeetings] = useState<Meeting[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [projRes, userRes, meetingRes] = await Promise.all([
          getProjects(),
          getUsers(),
          getMeetings(),
        ]);
        setProjects(projRes.data);
        setUsers(userRes.data);
        setScheduledMeetings(meetingRes.data.filter((meeting) => meeting.meetingType === (track || 'industry')));
        if (projRes.data.length > 0) setProjectId(projRes.data[0].id);
      } catch {
        setError('Failed to load projects or users.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) return setError('Meeting title is required.');
    if (!projectId) return setError('Please select a project.');
    if (!meetingLink.trim()) return setError('Meeting link is required.');
    if (!scheduledAt) return setError('Please set a date and time.');

    setSubmitting(true);
    try {
      const { data } = await createMeeting({
        title: title.trim(),
        projectId,
        meetingLink: meetingLink.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
        memberIds: selectedMembers,
        meetingType: track || 'industry',
      });

      // Keep the status panel in sync with the persisted meeting record.
      setScheduledMeetings((prev) => [data, ...prev.filter((meeting) => meeting.id !== data.id)]);

      // Reset form
      setTitle('');
      setMeetingLink('');
      setScheduledAt('');
      setSelectedMembers([]);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to schedule meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMemberNames = users
    .filter((u) => selectedMembers.includes(u.id))
    .map((u) => u.name);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" size={28} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">{track === 'academic_gd' ? 'Schedule a GD' : 'Schedule Meeting'}</h1>
          <p className="page-description">
            Add a Google Meet link and datetime — Briefr Bot will join automatically, transcribe, and generate tasks.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">

        {/* ── Left: Form ─────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-7 backdrop-blur"
        >
          <div className="space-y-6">

            {/* Title */}
            <div>
              <label htmlFor="meeting-title" className="ui-label">Meeting Title</label>
              <input
                id="meeting-title"
                type="text"
                className="ui-input mt-1.5 w-full"
                placeholder="e.g. Q3 Sprint Planning"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Project */}
            <div>
              <label htmlFor="project-select" className="ui-label">Project</label>
              <select
                id="project-select"
                className="ui-input mt-1.5 w-full"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Meeting link */}
            <div>
              <label htmlFor="meeting-link" className="ui-label flex items-center gap-1.5">
                <Link2 size={13} className="text-cyan-500" />
                Google Meet URL
              </label>
              <input
                id="meeting-link"
                type="url"
                className="ui-input mt-1.5 w-full font-mono text-sm"
                placeholder="https://meet.google.com/xxx-yyyy-zzz"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
              />
            </div>

            {/* Date & time */}
            <div>
              <label htmlFor="scheduled-at" className="ui-label flex items-center gap-1.5">
                <Calendar size={13} className="text-cyan-500" />
                Date &amp; Time
              </label>
              <input
                id="scheduled-at"
                type="datetime-local"
                className="ui-input mt-1.5 w-full"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            {/* Members */}
            <div>
              <label className="ui-label flex items-center gap-1.5">
                <Users size={13} className="text-cyan-500" />
                Team Members
              </label>
              <div className="relative mt-1.5">
                <button
                  type="button"
                  id="member-dropdown-btn"
                  onClick={() => setMemberDropdownOpen((o) => !o)}
                  className="ui-input flex w-full items-center justify-between text-sm"
                >
                  <span className={selectedMemberNames.length ? 'text-slate-200' : 'text-slate-500'}>
                    {selectedMemberNames.length
                      ? selectedMemberNames.join(', ')
                      : 'Select members…'}
                  </span>
                  <ChevronDown size={14} className="ml-2 shrink-0 text-slate-500" />
                </button>

                {memberDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-slate-900 shadow-xl">
                    {users.map((u) => (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          className="accent-cyan-500"
                          checked={selectedMembers.includes(u.id)}
                          onChange={() => toggleMember(u.id)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200">{u.name}</p>
                          <p className="truncate text-xs text-slate-500">{u.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
                {error}
              </p>
            )}

            {/* Bot notice */}
            <div className="flex items-start gap-3 rounded-xl border border-cyan-900/30 bg-cyan-950/20 px-4 py-3">
              <Bot size={16} className="mt-0.5 shrink-0 text-cyan-400" />
              <p className="text-xs leading-relaxed text-cyan-200/70">
                Briefr Bot will join this meeting automatically at the scheduled time.
                You will need to <strong className="text-cyan-200">admit the bot</strong> from
                the Google Meet lobby. After the meeting, tasks will be generated and
                assigned to matched team members.
              </p>
            </div>

            <button
              id="schedule-meeting-submit"
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
              {submitting ? 'Scheduling…' : track === 'academic_gd' ? 'Schedule GD' : 'Schedule Meeting'}
            </button>
          </div>
        </form>

        {/* ── Right: Status panel ────────────────────────────────── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Bot Sessions</h2>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-slate-500">
              {scheduledMeetings.length} this session
            </span>
          </div>

          {scheduledMeetings.length === 0 ? (
            <div className="empty-state rounded-2xl border border-white/5 bg-slate-900/40 py-14">
              <Bot size={28} className="mx-auto text-slate-700" />
              <p className="mt-3 text-sm text-slate-600">
                No meetings scheduled this session.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledMeetings.map((m) => (
                <MeetingStatusCard
                  key={m.id}
                  meeting={m}
                  onDismiss={() =>
                    setScheduledMeetings((prev) => prev.filter((x) => x.id !== m.id))
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
