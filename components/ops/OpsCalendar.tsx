import React, { useState } from 'react';
import { Project } from '../../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

interface Props {
    projects: Project[];
}

const OpsCalendar: React.FC<Props> = ({ projects = [] }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get all projects with scheduled dates
    const scheduledProjects = (projects || []).filter(p => p.post_scheduled_date);

    const getProjectsForDay = (day: Date) => {
        return scheduledProjects.filter(p => {
            const scheduledDate = p.post_scheduled_date ? new Date(p.post_scheduled_date) : null;
            return scheduledDate && isSameDay(scheduledDate, day);
        });
    };

    const getPlatformColor = (channel: string) => {
        switch (channel) {
            case 'LINKEDIN': return 'bg-blue-500';
            case 'YOUTUBE': return 'bg-red-500';
            case 'INSTAGRAM': return 'bg-purple-500';
            default: return 'bg-gray-500';
        }
    };

    // Get upcoming scheduled posts (next 7 days)
    const upcomingPosts = scheduledProjects
        .filter(p => {
            const schedDate = p.post_scheduled_date ? new Date(p.post_scheduled_date) : null;
            if (!schedDate) return false;
            const today = new Date();
            const weekFromNow = new Date(Date.now() + 7 * 86400000);
            return schedDate >= today && schedDate <= weekFromNow;
        })
        .sort((a, b) => {
            const dateA = new Date(a.post_scheduled_date!);
            const dateB = new Date(b.post_scheduled_date!);
            return dateA.getTime() - dateB.getTime();
        });

    return (
        <div className="space-y-8 animate-fade-in">
            <h1 className="text-4xl font-black uppercase text-slate-900">Posting Calendar</h1>

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
                                    {dayProjects.map(project => (
                                        <div
                                            key={project.id}
                                            className={`text-xs p-1 ${getPlatformColor(project.channel)} text-white font-bold truncate`}
                                            title={project.title}
                                        >
                                            {project.title}
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
                        📅 Upcoming Posts (Next 7 Days)
                    </h2>
                    <div className="space-y-3">
                        {upcomingPosts.map(project => (
                            <div key={project.id} className={`border-2 border-black p-4 bg-white flex items-center justify-between ${project.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 ${getPlatformColor(project.channel)} border border-black`}></div>
                                    <div>
                                        <p className="font-bold text-slate-900">{project.title}</p>
                                        <p className="text-sm text-slate-600">{project.channel}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-900">
                                        {format(new Date(project.post_scheduled_date!), 'MMM dd, yyyy')}
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        {format(new Date(project.post_scheduled_date!), 'EEEE')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {scheduledProjects.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No posts scheduled yet</p>
                </div>
            )}
        </div>
    );
};

export default OpsCalendar;