import React, { useState } from 'react';
import { Project } from '../../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

const toDateKey = (value?: string | null): string | null => {
    if (!value) return null;
    return value.split('T')[0].split(' ')[0];
};

const parseLocalDate = (dateStr?: string | null) => {
    const key = toDateKey(dateStr);
    if (!key) return null;
    return new Date(`${key}T00:00:00`);
};

interface Props {
    projects: Project[];
}

const OpsCalendar: React.FC<Props> = ({ projects = [] }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<{ date: Date; projects: any[] } | null>(null);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get all projects with any dates
    const datedProjects = projects && Array.isArray(projects) ? projects.filter(p => p.shoot_date || p.delivery_date || p.post_scheduled_date) : [];

    const getProjectsForDay = (day: Date) => {
        const dayProjects: any[] = [];

        datedProjects.forEach(project => {
            // Check shoot date
            const shootKey = toDateKey(project.shoot_date);
            if (shootKey && shootKey === format(day, 'yyyy-MM-dd')) {
                dayProjects.push({ ...project, dateType: 'shoot', displayDate: project.shoot_date });
            }

            // Check delivery date
            const deliveryKey = toDateKey(project.delivery_date);
            if (deliveryKey && deliveryKey === format(day, 'yyyy-MM-dd')) {
                dayProjects.push({ ...project, dateType: 'delivery', displayDate: project.delivery_date });
            }

            // Check post scheduled date
            const postKey = toDateKey(project.post_scheduled_date);
            if (postKey && postKey === format(day, 'yyyy-MM-dd')) {
                dayProjects.push({ ...project, dateType: 'post', displayDate: project.post_scheduled_date });
            }
        });

        return dayProjects;
    };

    const getDateTypeLabel = (dateType: string) => {
        switch (dateType) {
            case 'shoot': return 'Shoot';
            case 'delivery': return 'Delivery';
            case 'post': return 'Post';
            default: return 'Scheduled';
        }
    };

    const getDateTypeColor = (dateType: string) => {
        switch (dateType) {
            case 'shoot': return 'bg-blue-500';
            case 'delivery': return 'bg-green-500';
            case 'post': return 'bg-purple-500';
            default: return 'bg-gray-500';
        }
    };

    // Get all dated projects for upcoming section
    const allDatedProjects: any[] = [];
    datedProjects.forEach(project => {
        if (project.shoot_date) allDatedProjects.push({ ...project, dateType: 'shoot', displayDate: project.shoot_date });
        if (project.delivery_date) allDatedProjects.push({ ...project, dateType: 'delivery', displayDate: project.delivery_date });
        if (project.post_scheduled_date) allDatedProjects.push({ ...project, dateType: 'post', displayDate: project.post_scheduled_date });
    });

    const upcomingPosts = allDatedProjects
        .filter(p => {
            const dateStr = toDateKey(p.displayDate);
            if (!dateStr) return false;
            const schedDate = new Date(`${dateStr}T00:00:00`);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const weekFromNow = new Date();
            weekFromNow.setDate(today.getDate() + 7);
            weekFromNow.setHours(23, 59, 59, 999);
            return schedDate >= today && schedDate <= weekFromNow;
        })
        .sort((a, b) => {
            const dateA = toDateKey(a.displayDate);
            const dateB = toDateKey(b.displayDate);
            return new Date(`${dateA}T00:00:00`).getTime() - new Date(`${dateB}T00:00:00`).getTime();
        });

    return (
        <div className="space-y-8 animate-fade-in relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-4xl font-black uppercase text-slate-900">Workflow Calendar</h1>
                {/* Legend */}
                <div className="flex flex-wrap gap-4 bg-white border-2 border-black p-3 text-[10px] font-black uppercase">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 border border-black"></div>
                        <span>Shoot</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 border border-black"></div>
                        <span>Delivery</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 border border-black"></div>
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
                        <div key={day} className="p-3 text-center font-black text-sm border-r border-black last:border-r-0 bg-slate-50">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                    {daysInMonth.map((day, idx) => {
                        const dayProjects = getProjectsForDay(day);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => dayProjects.length > 0 && setSelectedDay({ date: day, projects: dayProjects })}
                                className={`min-h-[140px] p-2 border-r border-b border-black last:border-r-0 cursor-pointer transition-all hover:bg-slate-50 ${!isSameMonth(day, currentDate) ? 'bg-slate-50 opacity-40' : 'bg-white'
                                    } ${isToday ? 'bg-amber-50 border-amber-500' : ''}`}
                            >
                                <div className={`text-sm font-bold mb-2 flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-amber-500 text-white' : 'text-slate-600'}`}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-1">
                                    {dayProjects.slice(0, 3).map((project: any) => (
                                        <div
                                            key={`${project.id}-${project.dateType}`}
                                            className={`text-[10px] p-1.5 ${getDateTypeColor(project.dateType)} text-white font-bold truncate rounded shadow-sm border border-black/10 transition-transform cursor-default overflow-hidden`}
                                            title={`${project.title} - ${getDateTypeLabel(project.dateType)} Date`}
                                        >
                                            <div className="font-black truncate leading-tight">{project.title}</div>
                                            <div className="text-[8px] font-bold opacity-80 truncate mb-0.5">By: {project.writer_name || project.created_by_name || '—'}</div>
                                            <div className="flex items-center">
                                                <span className="text-[8px] uppercase tracking-tighter bg-black/20 px-1 rounded">{getDateTypeLabel(project.dateType)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {dayProjects.length > 3 && (
                                        <div className="text-[10px] text-amber-600 font-black text-center py-1 mt-1 border-t border-dashed border-amber-200">
                                            +{dayProjects.length - 3} more
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
                            {selectedDay.projects.map(project => (
                                <div
                                    key={`${project.id}-${project.dateType}`}
                                    className={`p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2 ${getDateTypeColor(project.dateType)} text-white`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-white/30 bg-white/20 rounded">
                                            {getDateTypeLabel(project.dateType)}
                                        </span>
                                        <div className="flex gap-2">
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-white/30 bg-black/20 rounded">
                                                {project.channel}
                                            </span>
                                            {project.priority === 'HIGH' && (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-white/30 bg-red-600 rounded">
                                                    ★ HIGH
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <h4 className="font-black uppercase leading-snug text-lg">{project.title}</h4>
                                    <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-white/20">
                                        <div className="text-xs font-bold uppercase">
                                            Writer: <span className="opacity-90">{project.writer_name || project.created_by_name || 'Unknown'}</span>
                                        </div>
                                        <div className="text-[10px] font-bold uppercase opacity-80">
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
                    <div className="absolute inset-0 -z-10" onClick={() => setSelectedDay(null)}></div>
                </div>
            )}


            {/* Upcoming Posts */}
            {upcomingPosts.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
                        📅 Upcoming Dates (Next 7 Days)
                    </h2>
                    <div className="space-y-3">
                        {upcomingPosts.map((project: any) => (
                            <div key={`${project.id}-${project.dateType}`} className="border-2 border-black p-4 bg-white flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 ${getDateTypeColor(project.dateType)} border border-black`}></div>
                                    <div>
                                        <p className="font-bold text-slate-900">{project.title}</p>
                                        <p className="text-sm text-slate-600">{project.channel} - {getDateTypeLabel(project.dateType)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-900">
                                        {format(new Date(project.displayDate), 'MMM dd, yyyy')}
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        {format(new Date(project.displayDate), 'EEEE')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {datedProjects.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No dates scheduled yet</p>
                </div>
            )}
        </div>
    );
};

export default OpsCalendar;