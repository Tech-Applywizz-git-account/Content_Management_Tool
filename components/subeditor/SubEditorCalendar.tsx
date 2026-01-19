import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Video, Upload } from 'lucide-react';
import { db } from '../../services/supabaseDb';
import { Project, Role } from '../../types';

const SubEditorCalendar: React.FC<{ user: any }> = ({ user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        // Get all projects for this user
        const allProjects = await db.getProjects(user);
        
        // Filter for projects assigned to this sub-editor
        const subEditorProjects = allProjects.filter(p => 
          p.assigned_to_role === Role.SUB_EDITOR &&
          p.assigned_to_user_id === user.id
        );
        
        setProjects(subEditorProjects);
      } catch (error) {
        console.error('Error fetching projects for calendar:', error);
        // Set empty array to prevent infinite loading
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }

    // Add actual days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getProjectsForDate = (date: Date | null) => {
    if (!date) return [];
    
    const dateString = formatDate(date);
    return projects.filter(project => 
      project.delivery_date === dateString || project.due_date === dateString
    );
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isCurrentMonth = (date: Date | null) => {
    if (!date) return false;
    return date.getMonth() === currentDate.getMonth() &&
           date.getFullYear() === currentDate.getFullYear();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl font-black text-slate-600">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black uppercase text-slate-900">Sub-Editor Calendar</h1>
              <p className="font-bold text-lg text-slate-500">Welcome back, {user.full_name}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={goToPreviousMonth}
                className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-black uppercase text-slate-900">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="p-3 text-center font-black uppercase text-slate-500 text-sm">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth(currentDate).map((date, index) => {
              const dayProjects = getProjectsForDate(date);
              const today = isToday(date);
              const currentMonth = isCurrentMonth(date);

              return (
                <div
                  key={index}
                  className={`
                    min-h-24 p-2 border border-slate-200
                    ${today ? 'bg-yellow-100 border-yellow-400' : ''}
                    ${currentMonth ? 'bg-white' : 'bg-slate-50 text-slate-400'}
                  `}
                >
                  <div className="text-right mb-1">
                    <span className={`
                      inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold
                      ${today ? 'bg-black text-white' : ''}
                    `}>
                      {date ? date.getDate() : ''}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {dayProjects.slice(0, 2).map(project => (
                      <div
                        key={project.id}
                        className={`
                          p-1 text-xs font-bold rounded truncate
                          ${
                            project.status === 'DONE' ? 'bg-green-500 text-white' :
                            project.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white' :
                            project.status === 'WAITING_APPROVAL' ? 'bg-yellow-500 text-black' :
                            'bg-gray-500 text-white'
                          }
                        `}
                      >
                        <div className="truncate">{project.title}</div>
                      </div>
                    ))}
                    {dayProjects.length > 2 && (
                      <div className="text-xs font-bold text-slate-500">
                        +{dayProjects.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4">
          <h3 className="text-lg font-black uppercase mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500"></div>
              <span className="font-bold text-sm">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500"></div>
              <span className="font-bold text-sm">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500"></div>
              <span className="font-bold text-sm">Waiting Approval</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-500"></div>
              <span className="font-bold text-sm">Other</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubEditorCalendar;