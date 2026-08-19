import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, CheckSquare, ChevronRight, Clock, ListTodo, Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { getTasks } from '../../api/endpoints';
import type { Task } from '../../api/endpoints';
import { useAuth } from '../../store/AuthContext';
import { AcademicDashboard } from './AcademicDashboard';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, track } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    if (track === 'academic_gd') {
      setLoading(false);
      return;
    }
    setError('');
    getTasks()
      .then((res) => setTasks(res.data))
      .catch((err: any) => setError(err.response?.data?.detail || 'Could not load your tasks.'))
      .finally(() => setLoading(false));
  }, [track, retryAttempt]);

  if (track === 'academic_gd') return <AcademicDashboard />;

  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const completionRate = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueTodayTasks = tasks.filter((t) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const overdueTasks = tasks.filter((t) => {
    if (!t.deadline || t.status === 'done') return false;
    return new Date(t.deadline) < new Date();
  });

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-white/10 bg-white/5">
        <Loader2 size={24} className="animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell space-y-4">
        <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-6 text-red-300">
          <h2 className="font-semibold">Dashboard unavailable</h2>
          <p className="mt-2 text-sm text-red-300/80">{error}</p>
          <button onClick={() => { setLoading(true); setError(''); setRetryAttempt((attempt) => attempt + 1); }} className="mt-4 rounded-lg border border-red-400/20 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10">Retry</button>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Total Tasks', value: totalTasks, icon: ListTodo, tone: 'from-indigo-500/20 to-indigo-400/10 text-indigo-300' },
    { label: 'In Progress', value: inProgressTasks, icon: Activity, tone: 'from-amber-500/20 to-amber-400/10 text-amber-300' },
    { label: 'Due Today', value: dueTodayTasks.length, icon: Clock, tone: 'from-cyan-500/20 to-cyan-400/10 text-cyan-300' },
    { label: 'Completion', value: `${completionRate}%`, icon: TrendingUp, tone: 'from-emerald-500/20 to-emerald-400/10 text-emerald-300' },
  ];

  return (
    <div className="page-shell space-y-6">
      <div className="ui-card bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-7 shadow-2xl shadow-black/20 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">Workspace overview</p>
            <h1 className="page-title mt-2">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}
            </h1>
            <p className="page-description mt-2">
              {isAdmin
                ? 'Review progress, manage action items, and keep the team moving.'
                : 'Track your assigned work and stay on top of deadlines.'}
            </p>
          </div>

          <button
            onClick={() => navigate('/kanban')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Open board
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={`ui-card bg-gradient-to-br ${kpi.tone} p-6`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{kpi.label}</span>
                <Icon size={16} />
              </div>
              <div className="mt-5 text-3xl font-semibold text-white">{kpi.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="ui-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Recent action items</h2>
              <p className="text-xs text-slate-500">Latest work pulled from your active tasks</p>
            </div>
            <button onClick={() => navigate('/kanban')} className="text-sm font-medium text-cyan-400">
              View board
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-950/50 text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Task</th>
                  <th className="px-5 py-3">Assignee</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 8).map((task) => (
                  <tr key={task.id} className="border-t border-white/10">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-200">{task.title}</div>
                      {task.deadline && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={12} />
                          Due {new Date(task.deadline).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-400">{task.assignedTo?.name || 'Unassigned'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        task.status === 'done'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : task.status === 'in_progress'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-white/10 text-slate-400'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {isAdmin && (
            <button
              onClick={() => navigate('/ingest')}
              className="ui-card flex w-full items-start gap-3 p-4 text-left transition hover:bg-indigo-500/10"
            >
              <div className="rounded-2xl bg-indigo-500/10 p-2 text-indigo-400">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="font-semibold text-slate-200">Process transcript</div>
                <div className="mt-1 text-sm text-slate-500">Extract tasks with AI</div>
              </div>
            </button>
          )}

          <button
            onClick={() => navigate('/kanban')}
            className="ui-card flex w-full items-start gap-3 p-4 text-left transition hover:bg-emerald-500/10"
          >
            <div className="rounded-2xl bg-emerald-500/10 p-2 text-emerald-400">
              <CheckSquare size={16} />
            </div>
            <div>
              <div className="font-semibold text-slate-200">Manage board</div>
              <div className="mt-1 text-sm text-slate-500">
                {inProgressTasks} item{inProgressTasks === 1 ? '' : 's'} in progress
              </div>
            </div>
          </button>

          {overdueTasks.length > 0 && (
            <div className="rounded-[18px] border border-red-500/20 bg-red-500/10 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-400">
                <AlertTriangle size={16} />
                Needs attention
              </div>
              <p className="mt-2 text-sm text-red-300/80">
                {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} need review.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
