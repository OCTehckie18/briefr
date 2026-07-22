import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Clock, ListTodo, Activity, Sparkles, Loader2, ChevronRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { getTasks } from '../../api/endpoints';
import { useAuth } from '../../store/AuthContext';

interface Task {
  id: string; title: string; status: string; priority: string; deadline?: string;
  assignedTo?: { name: string };
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getTasks().then((res) => setTasks(res.data)).finally(() => setLoading(false)); }, []);

  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const completionRate = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueTodayTasks = tasks.filter((t) => { if (!t.deadline) return false; const d = new Date(t.deadline); d.setHours(0,0,0,0); return d.getTime() === today.getTime(); });
  const overdueTasks = tasks.filter((t) => { if (!t.deadline || t.status === 'done') return false; return new Date(t.deadline) < new Date(); });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-cyan-400" /></div>;

  const kpis = [
    { label: 'Total Tasks', value: totalTasks, icon: ListTodo, accent: 'from-slate-600 to-slate-700', textColor: 'text-white' },
    { label: 'In Progress', value: inProgressTasks, icon: Activity, accent: 'from-amber-600/20 to-amber-500/10', textColor: 'text-amber-400' },
    { label: 'Due Today', value: dueTodayTasks.length, icon: Clock, accent: 'from-cyan-600/20 to-cyan-500/10', textColor: 'text-cyan-400' },
    { label: 'Completion', value: `${completionRate}%`, icon: TrendingUp, accent: 'from-emerald-600/20 to-emerald-500/10', textColor: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back, {user?.name?.split(' ')[0] || 'User'}</h1>
        <p className="text-slate-500 text-sm mt-1">{isAdmin ? 'Here is the workspace overview.' : 'Your personalized summary.'}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 flex flex-col justify-between h-[120px] group hover:bg-white/[0.05] hover:border-white/[0.1] transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{kpi.label}</span>
              <kpi.icon size={16} className="text-slate-600" />
            </div>
            <div className={`text-3xl font-bold tracking-tight ${kpi.textColor}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Action Items Table */}
        <div className="lg:col-span-2 rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden flex flex-col h-[480px]">
          <div className="px-5 py-4 border-b border-white/[0.06] flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-white">Action Items</h2>
              <p className="text-xs text-slate-500 mt-0.5">Recent tasks across all transcripts</p>
            </div>
            <button onClick={() => navigate('/kanban')} className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
              View Board <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#050510] border-b border-white/[0.06] z-10">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Task</th>
                  <th className="px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Assignee</th>
                  <th className="px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 8).map((task, i) => (
                  <tr key={task.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-slate-200">{task.title}</div>
                      {task.deadline && <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1"><Clock size={10} /> Due {new Date(task.deadline).toLocaleDateString()}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">{task.assignedTo?.name || 'Unassigned'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
                        task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        task.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-white/[0.04] text-slate-400 border-white/[0.06]'
                      }`}>{task.status.replace('_', ' ')}</span>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-600 text-sm">No tasks yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
            {isAdmin && (
              <button onClick={() => navigate('/ingest')}
                className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all text-left group">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors"><Sparkles size={16} /></div>
                <div>
                  <div className="text-sm font-semibold text-slate-200">Process Transcript</div>
                  <div className="text-xs text-slate-500 mt-0.5">Extract tasks with AI</div>
                </div>
              </button>
            )}
            <button onClick={() => navigate('/kanban')}
              className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all text-left group">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors"><CheckSquare size={16} /></div>
              <div>
                <div className="text-sm font-semibold text-slate-200">Manage Board</div>
                <div className="text-xs text-slate-500 mt-0.5">{inProgressTasks} in progress</div>
              </div>
            </button>
          </div>

          {overdueTasks.length > 0 && (
            <div className="rounded-xl bg-red-500/[0.06] border border-red-500/20 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2"><AlertTriangle size={16} /> Needs Attention</h2>
              <p className="text-xs text-red-400/70 leading-relaxed">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} requiring action.</p>
              <button onClick={() => navigate('/kanban')}
                className="w-full text-sm font-semibold py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">View Overdue</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
