import React, { useState } from 'react';
import { Project } from '../../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Palette, Video, Calendar as CalendarIconLucide } from 'lucide-react';
import { isInfluencerVideo } from '../../services/workflowUtils';

const toDateKey = (value?: string | null): string | null => {
    if (!value) return null;
    return value.split('T')[0].split(' ')[0];
};

interface Props {
    projects: Project[];
}

const DesignerCalendar: React.FC<Props> = ({ projects }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<{ date: Date; projects: Project[] } | null>(null);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get delivery dates from projects
    const deliveryDates = projects && Array.isArray(projects) ? projects
        .filter(p => p.delivery_date)
        .map(p => ({
            date: p.delivery_date!,
            project: p
        })) : [];

    const getDeliveriesForDay = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return deliveryDates.filter(dd => toDateKey(dd.date) === dateStr).map(dd => dd.project);
    };

    const previousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    };

    return (
        <div className="space-y-8 animate-fade-in relative">
            <div>
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                    Design Calendar
                </h1>
                <p className="font-bold text-lg text-slate-500">Track your delivery deadlines</p>
            </div>

            {/* Calendar */}
            <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={previousMonth}
                        className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-black uppercase">{format(currentDate, 'MMMM yyyy')}</h2>
                    <button
                        onClick={nextMonth}
                        className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-xs font-black uppercase text-slate-400 py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                    {/* Empty cells for days before month starts */}
                    {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square"></div>
                    ))}

                    {/* Days */}
                    {daysInMonth.map(date => {
                        const dayProjects = getDeliveriesForDay(date);
                        const isCurrentDay = isToday(date);
                        const hasHighPriority = dayProjects.some(p => p.priority === 'HIGH');
                        const hasVideo = dayProjects.some(p => p.content_type === 'VIDEO' || isInfluencerVideo(p));

                        return (
                            <div
                                key={date.toISOString()}
                                onClick={() => dayProjects.length > 0 && setSelectedDay({ date: date, projects: dayProjects })}
                                className={`aspect-square border-2 border-black p-2 flex flex-col items-center transition-all cursor-pointer ${isCurrentDay
                                    ? 'bg-yellow-100 font-black'
                                    : dayProjects.length > 0
                                        ? hasVideo
                                            ? `bg-blue-50 hover:bg-blue-100 ${hasHighPriority ? 'ring-2 ring-red-500 ring-offset-1' : ''}`
                                            : `bg-purple-50 hover:bg-purple-100 ${hasHighPriority ? 'ring-2 ring-red-500 ring-offset-1' : ''}`
                                        : 'bg-white hover:bg-slate-50'
                                    }`}
                            >
                                <div className={`text-sm font-bold flex items-center justify-center w-6 h-6 rounded-full mb-1 ${isCurrentDay ? 'bg-yellow-500 text-white' : 'text-slate-600'}`}>
                                    {format(date, 'd')}
                                </div>
                                <div className="w-full space-y-0.5 overflow-hidden">
                                    {dayProjects.slice(0, 3).map(project => (
                                        <div key={project.id} className={`text-[7px] text-white px-1 py-0.5 rounded font-black uppercase truncate w-full text-center ${project.content_type === 'VIDEO' || isInfluencerVideo(project) ? 'bg-blue-600' : 'bg-purple-600'}`}>
                                            {project.title}
                                        </div>
                                    ))}
                                    {dayProjects.length > 3 && (
                                        <div className="text-[8px] text-slate-500 font-black text-center pt-0.5 border-t border-dashed border-slate-200">
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
                                Deliveries for {format(selectedDay.date, 'MMM dd, yyyy')}
                            </h3>
                            <button
                                onClick={() => setSelectedDay(null)}
                                className="bg-white border-2 border-black p-1 hover:bg-red-500 hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 bg-slate-50">
                            {selectedDay.projects.map(project => {
                                const isVideo = project.content_type === 'VIDEO' || isInfluencerVideo(project);
                                return (
                                    <div
                                        key={project.id}
                                        className={`p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2 ${isVideo ? 'bg-blue-50' : 'bg-purple-50'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 rounded ${isVideo ? 'border-blue-600 bg-blue-600 text-white' : 'border-purple-600 bg-purple-600 text-white'}`}>
                                                {isVideo ? 'Thumbnail' : 'Creative'}
                                            </span>
                                            <div className="flex gap-2">
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black bg-white rounded">
                                                    {project.channel}
                                                </span>
                                                {project.priority === 'HIGH' && (
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-red-600 bg-red-600 text-white rounded">
                                                        ★ HIGH
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <h4 className="font-black uppercase leading-snug text-lg text-slate-900">{project.title}</h4>
                                        <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-black/10">
                                            <div className="text-xs font-bold uppercase text-slate-600">
                                                Writer: <span className="text-slate-900">{project.writer_name || project.created_by_name || 'Unknown'}</span>
                                            </div>
                                            <div className="text-[10px] font-bold uppercase text-slate-400">
                                                Stage: {project.current_stage?.replace(/_/g, ' ') || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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


            {/* Upcoming Deliveries */}
            <div className="space-y-4">
                <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
                    Upcoming Deliveries
                </h2>

                {deliveryDates.length > 0 ? (
                    <div className="space-y-3">
                        {deliveryDates.map(({ date, project }) => {
                            const isVideo = project.content_type === 'VIDEO' || isInfluencerVideo(project);
                            return (
                                <div
                                    key={project.id}
                                    className={`bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex items-center justify-between ${project.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`border-2 border-black px-3 py-2 ${isVideo ? 'bg-blue-100' : 'bg-purple-100'
                                                }`}
                                        >
                                            <div className="text-xs font-bold text-slate-500 uppercase">
                                                {format(new Date(date), 'MMM')}
                                            </div>
                                            <div className="text-2xl font-black">{format(new Date(date), 'd')}</div>
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 uppercase">{project.title}</h3>
                                            <p className="text-xs font-bold text-slate-500 uppercase">By: {project.writer_name || project.created_by_name || '—'}</p>
                                            <div className="flex gap-2 mt-1">
                                                <span
                                                    className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE'
                                                        ? 'bg-[#FF4F4F] text-white'
                                                        : project.channel === 'LINKEDIN'
                                                            ? 'bg-[#0085FF] text-white'
                                                            : 'bg-[#D946EF] text-white'
                                                        }`}
                                                >
                                                    {project.channel}
                                                </span>
                                                <span
                                                    className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${isVideo ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                                        }`}
                                                >
                                                    {isVideo ? '🎬 Thumbnail' : '🎨 Creative'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="border-2 border-dashed border-black p-8 text-center bg-slate-50">
                        <p className="text-slate-400 font-bold uppercase">No deliveries scheduled</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DesignerCalendar;
