import React, { useState, useEffect } from 'react';
import { getTasks, updateTaskStatus } from '../../api/endpoints';
import type { Task } from '../../api/endpoints';
import { Loader2, GripVertical, Inbox } from 'lucide-react';

const COLUMNS: { key: Task['status']; label: string; dot: string; accent: string }[] = [
  { key: 'todo', label: 'To Do', dot: 'bg-slate-500', accent: 'border-white/[0.06]' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-amber-400', accent: 'border-amber-500/20' },
  { key: 'done', label: 'Done', dot: 'bg-emerald-400', accent: 'border-emerald-500/20' },
];

export const KanbanPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { loadTasks(); }, []);

  const loadTasks = async () => {
    setError('');
    try { const res = await getTasks(); setTasks(res.data); }
    catch (err: any) { setError(err.response?.data?.detail || 'Could not load tasks.'); }
    finally { setLoading(false); }
  };

  const handleDrop = async (newStatus: Task['status']) => {
    if (!draggedTask) return;
    const task = tasks.find((t) => t.id === draggedTask);
    if (!task || task.status === newStatus) { setDraggedTask(null); return; }
    const previousTasks = tasks;
    setTasks((prev) => prev.map((t) => (t.id === draggedTask ? { ...t, status: newStatus } : t)));
    setDraggedTask(null);
    setError('');
    try {
      const response = await updateTaskStatus(task.id, newStatus);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? response.data : t)));
    } catch (err: any) {
      setTasks(previousTasks);
      setError(err.response?.data?.detail || 'Could not save that status change.');
    }
  };

  const getInitials = (name: string) => name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-cyan-400" /></div>;

  return (
    <div className="page-shell flex h-full flex-col space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kanban board</h1>
          <p className="page-description">Drag and drop tasks to keep every meeting follow-up moving.</p>
        </div>
      </div>
      {error && <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"><span>{error}</span><button onClick={loadTasks} className="font-semibold text-red-300 hover:text-white">Retry</button></div>}
      <div className="grid min-h-[500px] flex-1 grid-cols-1 gap-5 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key}
              className={`flex min-h-[360px] flex-col overflow-hidden rounded-[18px] border bg-white/[0.015] ${col.accent}`}
              onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(col.key)}>
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <h3 className="text-sm font-semibold text-slate-200">{col.label}</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-500 border border-white/[0.06]">{columnTasks.length}</span>
              </div>
              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {columnTasks.length === 0 && <div className="empty-state min-h-[180px]"><Inbox size={20} className="text-slate-600" /><span>No tasks here yet.</span></div>}
                {columnTasks.map((task) => (
                  <div key={task.id} draggable onDragStart={() => setDraggedTask(task.id)}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-grab active:cursor-grabbing hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group">
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} className="mt-0.5 shrink-0 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-200 leading-snug">{task.title}</h4>
                        {task.description && <p className="text-xs mt-1.5 text-slate-500 line-clamp-2 leading-relaxed">{task.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        {task.assignedTo && (
                          <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] text-white font-bold bg-gradient-to-br from-indigo-500 to-cyan-500" title={task.assignedTo.name}>
                            {getInitials(task.assignedTo.name)}
                          </div>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${
                          task.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>{task.priority}</span>
                      </div>
                      {task.deadline && <span className="text-[10px] font-medium text-slate-600">{new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
