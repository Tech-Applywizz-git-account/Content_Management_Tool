import React from 'react';
import { Bell, Calendar, Sparkles } from 'lucide-react';
import { getUpcomingFestivals } from '../../utils/festivalUtils';

const FestivalNotifications: React.FC = () => {
    const upcomingFestivals = getUpcomingFestivals();

    if (upcomingFestivals.length === 0) return null;

    return (
        <div className="mb-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 mb-2">
                <Bell className="w-5 h-5 text-[#D946EF]" />
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 leading-none">
                    Upcoming Festival Notifications
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingFestivals.map((festival, index) => (
                    <div
                        key={`${festival.name}-${index}`}
                        className="relative overflow-hidden bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all group"
                    >
                        {/* Decorative background element */}
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-yellow-400/20 rounded-full blur-2xl group-hover:bg-yellow-400/30 transition-colors" />

                        <div className="relative flex items-start gap-3">
                            <div className="mt-1 p-2 bg-yellow-400 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <Sparkles className="w-4 h-4 text-black" />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-black text-lg uppercase leading-tight text-slate-900 mb-1">
                                    {festival.name}
                                </h3>
                                <div className="text-sm font-bold text-slate-500">
                                    {festival.daysLeft === 0
                                        ? `Write the content for ${festival.name}, it is today!`
                                        : festival.daysLeft === 1
                                            ? `Write the content for ${festival.name}, it is coming tomorrow!`
                                            : `Write the content for ${festival.name}, it is coming in ${festival.daysLeft} days`}
                                </div>
                            </div>
                        </div>

                        {/* Neobrutalism accent line */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-yellow-400" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FestivalNotifications;
