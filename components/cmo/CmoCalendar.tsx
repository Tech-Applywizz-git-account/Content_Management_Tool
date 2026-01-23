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
          type: 'SHOOT',
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
          type: 'DELIVERY',
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
          type: 'POST',
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
    <div className="space-y-8 animate-fade-in">
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
      <div className="border-2 border-black bg-white">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b-2 border-black">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div
              key={day}
              className="p-3 text-center font-black text-sm border-r border-black last:border-r-0"
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
                className={`min-h-[120px] p-2 border-r border-b border-black last:border-r-0
                  ${!isSameMonth(day, currentDate) ? 'bg-slate-50' : ''}
                  ${isToday ? 'bg-amber-50 border-amber-500' : ''}`}
              >
                <div
                  className={`text-sm font-bold mb-1 ${isToday ? 'text-amber-600' : 'text-slate-600'
                    }`}
                >
                  {format(day, 'd')}
                </div>

                <div className="space-y-1">
                  {dayEntries.map(entry => (
                    <div
                      key={entry.id}
                      className={`text-[10px] p-1.5 bg-gradient-to-br ${getEntryStyles(entry.type)} text-white font-bold rounded shadow-sm border border-black/10 hover:scale-[1.02] transition-transform cursor-default`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="bg-white/20 px-1 rounded text-[8px] tracking-tighter">{getLabel(entry.type)}</span>
                        <div className="line-clamp-1 flex-1 text-right">{entry.title}</div>
                      </div>
                      {entry.niche && (
                        <div className="text-[7px] font-black uppercase tracking-wider opacity-80 truncate">
                          {formatNiche(entry.niche, entry.niche_other)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
