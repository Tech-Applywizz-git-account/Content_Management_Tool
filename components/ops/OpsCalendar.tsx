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

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get all projects with any dates
    const datedProjects = projects && Array.isArray(projects) ? projects.filter(p => p.shoot_date || p.delivery_date || p.post_scheduled_date) : [];

    const getProjectsForDay = (day: Date) => {
        const dayProjects = [];

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
    const allDatedProjects = [];
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
        <div className="space-y-8 animate-fade-in">
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
            <div className="border-2 border-black bg-white">
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b-2 border-black">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="p-3 text-center font-black text-sm border-r border-black last:border-r-0">
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
                                className={`min-h-[100px] p-2 border-r border-b border-black last:border-r-0 ${!isSameMonth(day, currentDate) ? 'bg-slate-50' : ''
                                    } ${isToday ? 'bg-amber-50 border-amber-500' : ''}`}
                            >
                                <div className={`text-sm font-bold mb-1 ${isToday ? 'text-amber-600' : 'text-slate-600'}`}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-1">
                                    {dayProjects.map((project: any) => (
                                        <div
                                            key={`${project.id}-${project.dateType}`}
                                            className={`text-xs p-1 ${getDateTypeColor(project.dateType)} text-white font-bold truncate`}
                                            title={`${project.title} - ${getDateTypeLabel(project.dateType)}`}
                                        >
                                            {project.title} ({getDateTypeLabel(project.dateType)})
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

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