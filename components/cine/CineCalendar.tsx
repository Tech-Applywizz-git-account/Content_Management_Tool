import React, { useState } from 'react';
import { Project } from '../../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';

interface Props {
    projects: Project[];
}

const CineCalendar: React.FC<Props> = ({ projects }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get shoot dates from projects
    const shootDates = projects
        .filter(p => p.shoot_date)
        .map(p => ({
            date: p.shoot_date!,
            project: p
        }));

    const hasShootOnDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return shootDates.find(sd => sd.date === dateStr);
    };

    const previousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                    Shoot Calendar
                </h1>
                <p className="font-bold text-lg text-slate-500">Schedule and track your shoots</p>
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
                        const shoot = hasShootOnDate(date);
                        const isCurrentDay = isToday(date);

                        return (
                            <div
                                key={date.toISOString()}
                                className={`aspect-square border-2 border-black p-2 flex flex-col items-center justify-center transition-all ${isCurrentDay
                                        ? 'bg-yellow-200 font-black'
                                        : shoot
                                            ? 'bg-blue-100 hover:bg-blue-200 cursor-pointer'
                                            : 'bg-white hover:bg-slate-50'
                                    } ${!isSameMonth(date, currentDate) ? 'opacity-40' : ''}`}
                                title={shoot ? shoot.project.title : undefined}
                            >
                                <div className="text-sm font-bold">{format(date, 'd')}</div>
                                {shoot && (
                                    <div className="mt-1">
                                        <Video className="w-3 h-3 text-blue-600" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Upcoming Shoots */}
            <div className="space-y-4">
                <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
                    Upcoming Shoots
                </h2>

                {shootDates.length > 0 ? (
                    <div className="space-y-3">
                        {shootDates.map(({ date, project }) => (
                            <div
                                key={project.id}
                                className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-100 border-2 border-black px-3 py-2">
                                        <div className="text-xs font-bold text-slate-500 uppercase">
                                            {format(new Date(date), 'MMM')}
                                        </div>
                                        <div className="text-2xl font-black">{format(new Date(date), 'd')}</div>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 uppercase">{project.title}</h3>
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
                                            {project.video_link && (
                                                <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-green-600 bg-green-100 text-green-800">
                                                    ✓ Uploaded
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="border-2 border-dashed border-black p-8 text-center bg-slate-50">
                        <p className="text-slate-400 font-bold uppercase">No shoots scheduled</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CineCalendar;
