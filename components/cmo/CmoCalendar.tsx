import React, { useState, useEffect } from 'react';
import { Project } from '../../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { db } from '../../services/supabaseDb';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths
} from 'date-fns';

interface Props {
  projects: Project[];
}

/**
 * Normalize any date string to YYYY-MM-DD
 */
const toDateKey = (value?: string | null): string | null => {
  if (!value) return null;
  // Extract date part from datetime strings like "2026-01-16 07:04:25+00" or "2026-01-16T07:04:25+00"
  return value.split('T')[0].split(' ')[0];
};

const CmoCalendar: React.FC<Props> = ({ projects = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: Date; entries: any[] } | null>(null);
  const [datedProjects, setDatedProjects] = useState<Project[]>([]);

  /**
   * Only keep projects that have any of the 3 target dates
   */
  useEffect(() => {
    const filteredProjects = projects.filter(p => p.shoot_date || p.delivery_date || p.post_scheduled_date);
    setDatedProjects(filteredProjects);
  }, [projects]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  /**
   * Get projects for a calendar day with date type info
   */
  const getProjectsForDay = (day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayEntries: any[] = [];

    datedProjects.forEach(project => {
      // Check Shoot Date
      if (toDateKey(project.shoot_date) === dayKey) {
        dayEntries.push({
          id: `${project.id}-shoot`,
          projectId: project.id,
          title: project.title,
          writer_name: project.writer_name,
          created_by_name: project.created_by_name,
          type: 'SHOOT',
          channel: project.channel,
          priority: project.priority,
          niche: project.data?.niche as string,
          niche_other: project.data?.niche_other as string
        });
      }
      // Check Delivery Date
      if (toDateKey(project.delivery_date) === dayKey) {
        dayEntries.push({
          id: `${project.id}-delivery`,
          projectId: project.id,
          title: project.title,
          writer_name: project.writer_name,
          created_by_name: project.created_by_name,
          type: 'DELIVERY',
          channel: project.channel,
          priority: project.priority,
          niche: project.data?.niche as string,
          niche_other: project.data?.niche_other as string
        });
      }
      // Check Post Date
      if (toDateKey(project.post_scheduled_date) === dayKey) {
        dayEntries.push({
          id: `${project.id}-post`,
          projectId: project.id,
          title: project.title,
          writer_name: project.writer_name,
          created_by_name: project.created_by_name,
          type: 'POST',
          channel: project.channel,
          priority: project.priority,
          niche: project.data?.niche as string,
          niche_other: project.data?.niche_other as string
        });
      }
    });

    return dayEntries;
  };

  const getEntryStyles = (type: string) => {
    switch (type) {
      case 'SHOOT':
        return 'bg-blue-600 from-blue-600 to-blue-700';
      case 'DELIVERY':
        return 'bg-emerald-600 from-emerald-600 to-emerald-700';
      case 'POST':
        return 'bg-purple-600 from-purple-600 to-indigo-700';
      default:
        return 'bg-slate-600';
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'SHOOT': return 'SHOOT';
      case 'DELIVERY': return 'DELV';
      case 'POST': return 'POST';
      default: return '';
    }
  };

  /**
   * Niche label formatter
   */
  const formatNiche = (niche?: string, niche_other?: string) => {
    if (niche === 'OTHER' && niche_other) return niche_other;
    switch (niche) {
      case 'PROBLEM_SOLVING':
        return 'Problem Solving';
      case 'SOCIAL_PROOF':
        return 'Social Proof';
      case 'LEAD_MAGNET':
        return 'Lead Magnet';
      default:
        return niche || '';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-black uppercase text-slate-900">
          Workflow Calendar
        </h1>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 bg-white border-2 border-black p-3 text-[10px] font-black uppercase">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600 border border-black"></div>
            <span>Shoot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-600 border border-black"></div>
            <span>Delivery</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-600 border border-black"></div>
            <span>Post</span>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between border-2 border-black p-4 bg-white">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 border-2 border-black"
        >
          <ChevronLeft size={24} />
        </button>

        <h2 className="text-2xl font-black uppercase">
          {format(currentDate, 'MMMM yyyy')}
        </h2>

        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 border-2 border-black"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b-2 border-black">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div
              key={day}
              className="p-3 text-center font-black text-sm border-r border-black last:border-r-0 bg-slate-50"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {daysInMonth.map(day => {
            const dayEntries = getProjectsForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                onClick={() => dayEntries.length > 0 && setSelectedDay({ date: day, entries: dayEntries })}
                className={`min-h-[140px] p-2 border-r border-b border-black last:border-r-0 cursor-pointer transition-all hover:bg-slate-50
                  ${!isSameMonth(day, currentDate) ? 'bg-slate-50 opacity-40' : 'bg-white'}
                  ${isToday ? 'bg-amber-50 border-amber-500' : ''}`}
              >
                <div
                  className={`text-sm font-bold mb-2 flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-amber-500 text-white' : 'text-slate-600'
                    }`}
                >
                  {format(day, 'd')}
                </div>

                <div className="space-y-1">
                  {dayEntries.slice(0, 3).map(entry => (
                    <div
                      key={entry.id}
                      className={`text-[10px] p-1.5 bg-gradient-to-br ${getEntryStyles(entry.type)} text-white font-bold rounded shadow-sm border border-black/10 overflow-hidden`}
                    >
                      <div className="truncate font-black">{entry.title}</div>
                      <div className="text-[7px] font-bold opacity-90 truncate">By: {entry.writer_name || entry.created_by_name || '—'}</div>
                      <div className="flex items-center justify-between gap-1 mt-0.5 pt-0.5 border-t border-white/10 text-[7px] uppercase tracking-tighter">
                        <span className="bg-white/20 px-1 rounded">{entry.type}</span>
                        {entry.niche && <span className="opacity-80 truncate">{formatNiche(entry.niche)}</span>}
                      </div>
                    </div>
                  ))}
                  {dayEntries.length > 3 && (
                    <div className="text-[10px] text-amber-600 font-black text-center py-1 mt-1 border-t border-dashed border-amber-200">
                      +{dayEntries.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 p-4 border-b-4 border-black flex items-center justify-between">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                Schedule for {format(selectedDay.date, 'MMM dd, yyyy')}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="bg-white border-2 border-black p-1 hover:bg-red-500 hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 bg-slate-50">
              {selectedDay.entries.map(entry => (
                <div
                  key={entry.id}
                  className={`p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2 bg-gradient-to-br ${getEntryStyles(entry.type)} text-white`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-white/30 bg-white/20 rounded">
                      {entry.type}
                    </span>
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-white/30 bg-black/20 rounded">
                        {entry.channel}
                      </span>
                      {entry.priority === 'HIGH' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-white/30 bg-red-500 rounded">
                          ★ HIGH
                        </span>
                      )}
                    </div>
                  </div>
                  <h4 className="font-black uppercase leading-snug text-lg">{entry.title}</h4>
                  <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-white/20">
                    <div className="text-xs font-bold uppercase">
                      Writer: <span className="opacity-90">{entry.writer_name || entry.created_by_name || 'Unknown'}</span>
                    </div>
                    {entry.niche && (
                      <div className="text-[10px] font-bold uppercase opacity-80">
                        Niche: {formatNiche(entry.niche, entry.niche_other)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t-4 border-black bg-white flex justify-end">
              <button
                onClick={() => setSelectedDay(null)}
                className="bg-slate-900 text-white px-6 py-2 font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                Close
              </button>
            </div>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setSelectedDay(null)}></div>
        </div>
      )}

      {/* Empty State */}
      {datedProjects.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
          <p>No post dates scheduled yet</p>
        </div>
      )}
    </div>
  );
};

export default CmoCalendar;
