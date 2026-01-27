import React, { useState } from 'react';
import { Project } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns';

interface Props {
    projects?: Project[];
}


const WriterCalendar: React.FC<Props> = ({ projects = [] }) => {

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<{ date: Date; projects: Project[] } | null>(null);

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
        <div className="space-y-4 sm:space-y-6 animate-fade-in relative">
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
                                onClick={() => dayProjects.length > 0 && setSelectedDay({ date: day, projects: dayProjects })}
                                className={`min-h-[80px] sm:min-h-[100px] md:min-h-[120px] p-2 sm:p-3 border-r-2 border-b-2 border-black last:border-r-0 cursor-pointer transition-all hover:bg-slate-50 ${!isCurrentMonth ? 'bg-slate-50 opacity-40' : 'bg-white'
                                    } ${isToday ? 'bg-blue-50' : ''}`}
                            >
                                <div className={`text-sm font-bold mb-2 inline-flex items-center justify-center ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full' : 'text-slate-600'
                                    }`}>
                                    {format(day, 'd')}
                                </div>

                                <div className="space-y-1">
                                    {dayProjects.slice(0, 3).map(project => (
                                        <div
                                            key={project.id}
                                            className={`text-[10px] p-1.5 border border-black relative ${project.channel === 'YOUTUBE' ? 'bg-red-100' :
                                                project.channel === 'LINKEDIN' ? 'bg-blue-100' :
                                                    'bg-purple-100'
                                                } ${project.priority === 'HIGH' ? 'ring-1 ring-red-500 ring-offset-0' : ''}`}
                                            title={`${project.title} - ${project.writer_name || project.created_by_name || 'Unknown'}`}
                                        >
                                            <div className="font-black truncate leading-tight">{project.title}</div>
                                            <div className="text-[9px] text-slate-700 font-bold truncate opacity-80">
                                                {project.writer_name || project.created_by_name || '—'}
                                            </div>
                                            {project.priority === 'HIGH' && (
                                                <span className="absolute top-0 right-1 text-[8px] font-black text-red-700">★</span>
                                            )}
                                        </div>
                                    ))}
                                    {dayProjects.length > 3 && (
                                        <div className="text-[10px] text-blue-600 font-black text-center py-1 mt-1 border-t border-dashed border-blue-200">
                                            +{dayProjects.length - 3} more
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

            {/* Day Detail Modal */}
            {selectedDay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-slate-900 p-4 border-b-4 border-black flex items-center justify-between">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">
                                Projects for {format(selectedDay.date, 'MMM dd, yyyy')}
                            </h3>
                            <button
                                onClick={() => setSelectedDay(null)}
                                className="bg-white border-2 border-black p-1 hover:bg-red-500 hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 bg-slate-50">
                            {selectedDay.projects.map(project => (
                                <div
                                    key={project.id}
                                    className={`p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2 ${project.channel === 'YOUTUBE' ? 'bg-red-50' :
                                        project.channel === 'LINKEDIN' ? 'bg-blue-50' :
                                            'bg-purple-50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black text-white ${project.channel === 'YOUTUBE' ? 'bg-red-500' :
                                            project.channel === 'LINKEDIN' ? 'bg-blue-500' :
                                                'bg-purple-500'
                                            }`}>
                                            {project.channel}
                                        </span>
                                        {project.priority === 'HIGH' && (
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black bg-yellow-400 text-black">
                                                High Priority ★
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-black text-slate-900 uppercase leading-snug">{project.title}</h4>
                                    <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-black/10">
                                        <div className="text-xs font-bold text-slate-600 uppercase">
                                            Writer: <span className="text-slate-900">{project.writer_name || project.created_by_name || 'Unknown'}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                                            Stage: {project.current_stage?.replace(/_/g, ' ') || 'N/A'}
                                        </div>
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
                    {/* Backdrop click */}
                    <div className="absolute inset-0 -z-10" onClick={() => setSelectedDay(null)}></div>
                </div>
            )}
        </div>
    );
};

export default WriterCalendar;
