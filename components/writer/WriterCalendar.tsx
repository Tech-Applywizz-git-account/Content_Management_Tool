import React, { useState } from 'react';
import { Project } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns';

interface Props {
  projects?: Project[];
}


const WriterCalendar: React.FC<Props> = ({ projects = [] }) => {

    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const getProjectsForDay = (day: Date) => {
        return projects.filter(p => {
            const createdDate = new Date(p.created_at);
            return isSameDay(createdDate, day);
        });
    };

    return (
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black uppercase text-slate-900 mb-2">Content Calendar</h2>
                    <p className="text-sm sm:text-base text-slate-600 font-medium">Schedule and track your content</p>
                </div>

                <div className="flex items-center justify-center gap-2 sm:gap-4">
                    <button
                        onClick={prevMonth}
                        className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <h3 className="text-lg sm:text-xl font-black uppercase min-w-[150px] sm:min-w-[200px] text-center">
                        {format(currentMonth, 'MMMM yyyy')}
                    </h3>
                    <button
                        onClick={nextMonth}
                        className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {/* Week Days Header */}
                <div className="grid grid-cols-7 border-b-2 border-black">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="p-2 sm:p-4 text-center font-black uppercase text-xs sm:text-sm border-r-2 border-black last:border-r-0 bg-slate-50">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                    {days.map((day, idx) => {
                        const dayProjects = getProjectsForDay(day);
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div
                                key={idx}
                                className={`min-h-[80px] sm:min-h-[100px] md:min-h-[120px] p-2 sm:p-3 border-r-2 border-b-2 border-black last:border-r-0 ${!isCurrentMonth ? 'bg-slate-50 opacity-40' : 'bg-white'
                                    } ${isToday ? 'bg-blue-50' : ''}`}
                            >
                                <div className={`text-sm font-bold mb-2 ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-slate-600'
                                    }`}>
                                    {format(day, 'd')}
                                </div>

                                <div className="space-y-1">
                                    {dayProjects.slice(0, 2).map(project => (
                                        <div
                                            key={project.id}
                                            className={`text-xs p-2 border border-black truncate ${project.channel === 'YOUTUBE' ? 'bg-red-100' :
                                                    project.channel === 'LINKEDIN' ? 'bg-blue-100' :
                                                        'bg-purple-100'
                                                } ${project.priority === 'HIGH' ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                                            title={project.title}
                                        >
                                            {project.title}
                                            {project.priority === 'HIGH' && (
                                                <span className="ml-1 text-[8px] font-black text-red-700">★</span>
                                            )}
                                        </div>
                                    ))}
                                    {dayProjects.length > 2 && (
                                        <div className="text-xs text-slate-500 font-bold">
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
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 p-3 sm:p-4 bg-slate-50 border-2 border-black">
                <span className="font-black uppercase text-xs sm:text-sm">Legend:</span>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border border-black"></div>
                    <span className="text-xs sm:text-sm font-bold">YouTube</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border border-black"></div>
                    <span className="text-xs sm:text-sm font-bold">LinkedIn</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-100 border border-black"></div>
                    <span className="text-xs sm:text-sm font-bold">Instagram</span>
                </div>
            </div>
        </div>
    );
};

export default WriterCalendar;
