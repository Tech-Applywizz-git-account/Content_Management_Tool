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
   * Only keep projects that have POST dates
   */
  useEffect(() => {
    const filteredProjects = projects.filter(p => p.post_scheduled_date);
    setDatedProjects(filteredProjects);
  }, [projects]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  /**
   * Get projects for a calendar day (POST date only)
   */
  const getProjectsForDay = (day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd');

    return datedProjects
      .filter(
        project => {
          const projectDate = toDateKey(project.post_scheduled_date);
          return projectDate === dayKey;
        }
      )
      .map(project => ({
        id: project.id,
        title: project.title,
        niche: project.data?.niche as string,
        niche_other: project.data?.niche_other as string
      }));
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
      <h1 className="text-4xl font-black uppercase text-slate-900">
        Posting Calendar
      </h1>

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
            const dayProjects = getProjectsForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[100px] p-2 border-r border-b border-black last:border-r-0
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
                  {dayProjects.map(project => (
                    <div
                      key={project.id}
                      className="text-xs p-1.5 bg-gradient-to-br from-purple-600 to-indigo-700 text-white font-bold rounded shadow-sm border border-black/10 hover:scale-[1.02] transition-transform cursor-default"
                    >
                      <div className="line-clamp-2 leading-tight">
                        {project.title}
                      </div>
                      {project.niche && (
                        <div className="text-[9px] font-black uppercase tracking-wider mt-0.5 opacity-80 bg-white/20 px-1 py-0.5 rounded w-fit">
                          {formatNiche(project.niche, project.niche_other)}
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
