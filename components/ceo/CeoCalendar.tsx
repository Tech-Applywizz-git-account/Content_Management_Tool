import React, { useState } from 'react';
import { Project } from '../../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

const parseLocalDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    return new Date(`${dateStr}T00:00:00`);
};

interface Props {
    projects: Project[];
}

const CeoCalendar: React.FC<Props> = ({ projects = [] }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get all projects with any dates
    const datedProjects = projects && Array.isArray(projects) ? projects.filter(p => p.shoot_date || p.delivery_date || p.post_scheduled_date || p.designer_uploaded_at || p.created_at) : [];

    const getProjectsForDay = (day: Date) => {
        const dayProjects = [];

        datedProjects.forEach(project => {
            // Check shoot date
            if (project.shoot_date) {
                const shootDate = parseLocalDate(project.shoot_date);
                if (isSameDay(shootDate, day)) {
                    dayProjects.push({
                        ...project,
                        dateType: 'shoot',
                        displayDate: project.shoot_date
                    });
                }
            }

            // Check delivery date
            if (project.delivery_date) {
                const deliveryDate = parseLocalDate(project.delivery_date);
                if (isSameDay(deliveryDate, day)) {
                    dayProjects.push({
                        ...project,
                        dateType: 'delivery',
                        displayDate: project.delivery_date
                    });
                }
            }

            // Check post scheduled date
            if (project.post_scheduled_date) {
                const postDate = parseLocalDate(project.post_scheduled_date);
                if (isSameDay(postDate, day)) {
                    dayProjects.push({
                        ...project,
                        dateType: 'post',
                        displayDate: project.post_scheduled_date
                    });
                }
            }

            // Check designer delivery date
            if (project.designer_uploaded_at) {
                const designerDate = parseLocalDate(project.designer_uploaded_at);
                if (isSameDay(designerDate, day)) {
                    dayProjects.push({
                        ...project,
                        dateType: 'designer',
                        displayDate: project.designer_uploaded_at
                    });
                }
            }

            // Check created date (when writer submits)
            if (project.created_at) {
                const createdDate = parseLocalDate(project.created_at);
                if (isSameDay(createdDate, day)) {
                    dayProjects.push({
                        ...project,
                        dateType: 'created',
                        displayDate: project.created_at
                    });
                }
            }
        });

        return dayProjects;
    };

    // Helper function to get date type label
    const getDateTypeLabel = (dateType: string) => {
        switch (dateType) {
            case 'shoot': return 'Shoot';
            case 'delivery': return 'Delivery';
            case 'post': return 'Post';
            case 'designer': return 'Designer';
            case 'created': return 'Submitted';
            default: return 'Scheduled';
        }
    };

    // Helper function to get date type color
    const getDateTypeColor = (dateType: string) => {
        switch (dateType) {
            case 'shoot': return 'bg-blue-500';
            case 'delivery': return 'bg-green-500';
            case 'post': return 'bg-purple-500';
            case 'designer': return 'bg-pink-500';
            case 'created': return 'bg-yellow-500';
            default: return 'bg-gray-500';
        }
    };

    // Get all dated projects for upcoming section
    const allDatedProjects = [];

    datedProjects.forEach(project => {
        // Add shoot date
        if (project.shoot_date) {
            allDatedProjects.push({
                ...project,
                dateType: 'shoot',
                displayDate: project.shoot_date
            });
        }

        // Add delivery date
        if (project.delivery_date) {
            allDatedProjects.push({
                ...project,
                dateType: 'delivery',
                displayDate: project.delivery_date
            });
        }

        // Add post scheduled date
        if (project.post_scheduled_date) {
            allDatedProjects.push({
                ...project,
                dateType: 'post',
                displayDate: project.post_scheduled_date
            });
        }

        // Add designer delivery date
        if (project.designer_uploaded_at) {
            allDatedProjects.push({
                ...project,
                dateType: 'designer',
                displayDate: project.designer_uploaded_at
            });
        }

        // Add created date (when writer submits)
        if (project.created_at) {
            allDatedProjects.push({
                ...project,
                dateType: 'created',
                displayDate: project.created_at
            });
        }
    });

    const getPlatformColor = (channel: string) => {
        switch (channel) {
            case 'LINKEDIN': return 'bg-blue-500';
            case 'YOUTUBE': return 'bg-red-500';
            case 'INSTAGRAM': return 'bg-purple-500';
            default: return 'bg-gray-500';
        }
    };

    // Get upcoming dates (next 7 days) for all date types
    const upcomingDates = allDatedProjects
        .filter((p: any) => {
            const schedDate = p.displayDate ? new Date(p.displayDate) : null;
            if (!schedDate) return false;
            const today = new Date();
            const weekFromNow = new Date(Date.now() + 7 * 86400000);
            return schedDate >= today && schedDate <= weekFromNow;
        })
        .sort((a: any, b: any) => {
            const dateA = new Date(a.displayDate);
            const dateB = new Date(b.displayDate);
            return dateA.getTime() - dateB.getTime();
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
                                            className={`text-xs p-1 ${getDateTypeColor(project.dateType)} text-white font-bold truncate ${project.priority === 'HIGH' ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                                            title={`${project.title} (${project.priority}) - ${getDateTypeLabel(project.dateType)} Date${project.data?.niche ? ` - Niche: ${project.data.niche}` : ''}`}
                                        >
                                            {project.title} ({getDateTypeLabel(project.dateType)})
                                            {project.priority === 'HIGH' && (
                                                <span className="ml-1 text-[8px] font-black text-red-200">★</span>
                                            )}
                                            {(project.dateType === 'post' || project.dateType === 'shoot' || project.dateType === 'delivery' || project.dateType === 'designer' || project.dateType === 'created') && project.data?.niche && (
                                                <div className="text-[8px] font-normal mt-0.5 truncate" title={project.data.niche}>
                                                    [{project.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                                        : project.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                                            : project.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                                : project.data.niche === 'OTHER' && project.data.niche_other
                                                                    ? project.data.niche_other
                                                                    : project.data.niche}]
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

            {/* Upcoming Dates */}
            {upcomingDates.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
                        📅 Upcoming Dates (Next 7 Days)
                    </h2>
                    <div className="space-y-3">
                        {upcomingDates.map((project: any) => (
                            <div key={`${project.id}-${project.dateType}`} className="border-2 border-black p-4 bg-white flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 ${getDateTypeColor(project.dateType)} border border-black`}></div>
                                    <div>
                                        <p className="font-bold text-slate-900">{project.title}</p>
                                        <p className="text-sm text-slate-600">{project.channel} - {getDateTypeLabel(project.dateType)}</p>
                                        {(project.dateType === 'post' || project.dateType === 'shoot' || project.dateType === 'delivery' || project.dateType === 'designer' || project.dateType === 'created') && project.data?.niche && (
                                            <p className="text-xs text-slate-500 font-bold">
                                                Niche: {project.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                                    : project.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                                        : project.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                            : project.data.niche === 'OTHER' && project.data.niche_other
                                                                ? project.data.niche_other
                                                                : project.data.niche}
                                            </p>
                                        )}
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

export default CeoCalendar;