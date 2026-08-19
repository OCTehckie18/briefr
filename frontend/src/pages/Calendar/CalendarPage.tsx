import React, { useState, useEffect } from 'react';
import { getTasks } from '../../api/endpoints';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, format, isSameMonth, isSameDay, isToday } from 'date-fns';

interface Task { id: string; title: string; deadline?: string; priority: string; status: string; assignedTo?: { name: string }; }

export const CalendarPage: React.FC = () => {
  const { track } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getTasks().then((res) => setTasks(res.data)).finally(() => setLoading(false)); }, []);

  const getTasksForDate = (date: Date) => tasks.filter((t) => t.deadline && isSameDay(new Date(t.deadline), date));

  const renderDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    const rows: React.ReactNode[] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: React.ReactNode[] = [];
      for (let i = 0; i < 7; i++) {
        const d = day;
        const dayTasks = getTasksForDate(d);
        const inMonth = isSameMonth(d, monthStart);
        const today = isToday(d);
        const selected = selectedDate && isSameDay(d, selectedDate);
        week.push(
          <td key={d.toISOString()} onClick={() => setSelectedDate(d)}
            className={`p-2 align-top cursor-pointer transition-all border border-white/[0.04] h-28 relative ${
              selected ? 'bg-cyan-500/[0.08] border-cyan-500/30' :
              today ? 'bg-white/[0.03]' :
              inMonth ? 'hover:bg-white/[0.02]' : 'opacity-40'
            }`}>
            <div className="flex justify-between items-start">
              <span className={`text-[11px] font-semibold w-6 h-6 rounded-md flex items-center justify-center ${
                today ? 'bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow-sm shadow-cyan-500/30' : inMonth ? 'text-slate-400' : 'text-slate-700'
              }`}>{format(d, 'd')}</span>
              {dayTasks.length > 0 && <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">{dayTasks.length}</span>}
            </div>
            <div className="mt-2 space-y-1">
              {dayTasks.slice(0, 2).map((t) => (
                <div key={t.id} className={`w-full px-1.5 py-0.5 rounded text-[9px] font-medium truncate border ${
                  t.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  t.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>{t.title}</div>
              ))}
              {dayTasks.length > 2 && <div className="text-[9px] text-slate-600 pl-1">+{dayTasks.length - 2} more</div>}
            </div>
          </td>
        );
        day = addDays(day, 1);
      }
      rows.push(<tr key={day.toISOString()}>{week}</tr>);
    }
    return rows;
  };

  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-cyan-400" /></div>;

  return (
    <div className="page-shell flex h-full flex-col space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{track === 'academic_gd' ? 'GD calendar' : 'Schedule'}</h1>
          <p className="page-description">{track === 'academic_gd' ? 'View group discussions by class, topic, evaluator, and scheduled time.' : 'Track task deadlines and priorities across the month.'}</p>
          {track === 'academic_gd' && <button className="academic-primary-button"><Plus size={16} /> Add GD event</button>}
        </div>
      </div>
      <div className="flex min-h-[550px] flex-1 flex-col gap-5 xl:flex-row">
        {/* Calendar */}
        <div className="ui-card flex flex-1 flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <CalendarIcon size={18} className="text-cyan-400" /> {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
              <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors">Today</button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>
          <table className="w-full h-full table-fixed border-collapse">
            <thead>
              <tr>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                  <th key={d} className="py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 border-b border-white/[0.04]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>{renderDays()}</tbody>
          </table>
        </div>

        {/* Side Panel */}
        <div className="ui-card flex w-full shrink-0 flex-col overflow-hidden xl:w-72">
          <div className="px-5 py-4 border-b border-white/[0.06] bg-white/[0.02]">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a Date'}
            </h3>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {!selectedDate ? <p className="text-sm text-slate-600 text-center mt-10">Click a date to view tasks.</p> :
             selectedTasks.length === 0 ? <p className="text-sm text-slate-600 text-center mt-10">No tasks due.</p> :
             selectedTasks.map((t) => (
              <div key={t.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h4 className="text-sm font-medium text-slate-200 leading-snug">{t.title}</h4>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${
                    t.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    t.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>{t.priority}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-xs text-slate-500">
                  <span>{t.assignedTo?.name || 'Unassigned'}</span>
                  <span className={`${t.status === 'done' ? 'text-emerald-400' : t.status === 'in_progress' ? 'text-amber-400' : 'text-slate-500'}`}>{t.status.replace('_',' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
