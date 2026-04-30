import React, { useState, useEffect } from 'react';
import { Project } from '../../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface PACalendarProps {
  projects: Project[];
}

/**
 * Normalize any date string to YYYY-MM-DD
 */
const toDateKey = (value?: string | null): string | null => {
  if (!value) return null;
  return value.split('T')[0].split(' ')[0];
};

const PACalendar: React.FC<PACalendarProps> = ({ projects = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: Date; entries: any[] } | null>(null);
  const [datedProjects, setDatedProjects] = useState<Project[]>([]);

  /**
   * Only keep projects that have a post_scheduled_date AND are PA Brand projects
   */
  useEffect(() => {
    const filteredProjects = projects.filter(p => 
        p.data?.is_pa_brand === true && !!p.post_scheduled_date
    );
    setDatedProjects(filteredProjects);
  }, [projects]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  /**
   * Get projects for a calendar day (Strictly Filtering for Publishing Dates)
   */
  const getProjectsForDay = (day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayEntries: any[] = [];

    datedProjects.forEach(project => {
      // Check Post Date Only
      if (toDateKey(project.post_scheduled_date) === dayKey) {
        dayEntries.push({
          id: `${project.id}-post`,
          projectId: project.id,
          title: project.title,
          writer_name: project.writer_name,
          created_by_name: project.created_by_name,
          influencer_name: project.data?.influencer_name as string,
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
    return 'bg-purple-600 from-purple-600 to-indigo-700';
  };

  const formatNiche = (niche?: string, niche_other?: string) => {
    if (niche === 'OTHER' && niche_other) return niche_other;
    switch (niche) {
      case 'PROBLEM_SOLVING': return 'Problem Solving';
      case 'SOCIAL_PROOF': return 'Social Proof';
      case 'LEAD_MAGNET': return 'Lead Magnet';
      default: return niche || '';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase text-slate-900 tracking-tight">
            Publishing Calendar
          </h1>
          <p className="font-bold text-slate-400 text-sm italic">Tracking final publishing dates for PA Brand campaigns.</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 bg-white border-2 border-black p-3 text-[10px] font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="w-3 h-3 bg-purple-600 border border-black"></div>
          <span>Scheduled Post</span>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between border-2 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 border-2 border-black transition-all active:translate-y-[1px]"
        >
          <ChevronLeft size={24} />
        </button>

        <h2 className="text-2xl font-black uppercase tracking-tight">
          {format(currentDate, 'MMMM yyyy')}
        </h2>

        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 border-2 border-black transition-all active:translate-y-[1px]"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <div className="grid grid-cols-7 border-b-2 border-black">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center font-black text-xs border-r border-black last:border-r-0 bg-slate-50 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

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
                  ${isToday ? 'bg-amber-50' : ''}`}
              >
                <div className={`text-sm font-black mb-2 flex items-center justify-center w-7 h-7 ${isToday ? 'bg-amber-500 text-white rounded-full' : 'text-slate-400'}`}>
                  {format(day, 'd')}
                </div>

                <div className="space-y-1">
                  {dayEntries.slice(0, 3).map(entry => (
                    <div
                      key={entry.id}
                      className="text-[10px] p-2 bg-gradient-to-br from-purple-600 to-indigo-700 text-white font-bold rounded shadow-sm border border-black/10 overflow-hidden group"
                    >
                      <div className="truncate font-black text-[9px] uppercase tracking-tight">{entry.title}</div>
                      <div className="text-[7px] font-bold opacity-80 truncate mt-0.5">By: {entry.writer_name || entry.created_by_name || '—'}</div>
                      {entry.influencer_name && (
                        <div className="text-[7px] font-black text-white truncate flex items-center gap-1 mt-1 border-t border-white/20 pt-1 uppercase tracking-wider">
                          <span className="w-1 h-1 bg-white rounded-full flex-shrink-0 animate-pulse" />
                          {entry.influencer_name}
                        </div>
                      )}
                    </div>
                  ))}
                  {dayEntries.length > 3 && (
                    <div className="text-[9px] text-purple-600 font-black text-center py-1 mt-1 border-t border-dashed border-purple-200 uppercase">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedDay(null)}>
          <div
            className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] w-full max-w-md overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 p-4 border-b-4 border-black flex items-center justify-between">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                Schedule: {format(selectedDay.date, 'MMM dd, yyyy')}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="bg-white border-2 border-black p-1 hover:bg-red-500 hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 bg-slate-50">
              {selectedDay.entries.map(entry => (
                <div
                  key={entry.id}
                  className="p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-3 bg-white"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase px-2 py-1 border-2 border-black bg-purple-600 text-white">
                      {entry.type}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-1 border-2 border-black bg-slate-100">
                      {entry.channel}
                    </span>
                  </div>
                  <h4 className="font-black uppercase leading-tight text-xl text-slate-900">{entry.title}</h4>
                  <div className="space-y-3 mt-2 pt-4 border-t-2 border-slate-100">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400">Influencer</span>
                        <span className="text-xs font-black text-purple-600 uppercase flex items-center gap-2">
                            <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                            {entry.influencer_name || 'Unassigned'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400">Campaign Lead</span>
                        <span className="text-xs font-bold text-slate-900 uppercase">
                            {entry.writer_name || entry.created_by_name || 'System'}
                        </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t-4 border-black bg-white">
              <button
                onClick={() => setSelectedDay(null)}
                className="w-full bg-slate-900 text-white py-4 font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {datedProjects.length === 0 && (
        <div className="text-center py-24 border-4 border-dashed border-slate-200 bg-slate-50/50">
          <CalendarIcon size={56} className="mx-auto mb-6 text-slate-300" />
          <p className="font-black text-slate-400 uppercase tracking-widest text-sm">No publishing schedules found</p>
        </div>
      )}
    </div>
  );
};

export default PACalendar;
