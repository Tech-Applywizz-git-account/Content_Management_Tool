import React from 'react';
import { Project, Role } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { Video, Palette, FileImage, CalendarIcon } from 'lucide-react';

interface Props {
    user: { full_name: string; role: Role };
    projects: Project[];
    onSelectProject: (project: Project) => void;
}

const DesignerMyWork: React.FC<Props> = ({ user, projects, onSelectProject }) => {
    // Show all projects the designer has participated in
    // No filtering by assigned_to_role - show all projects from getMyWork
    const myTasks = projects || [];

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                    My Work
                </h1>
                <p className="font-bold text-lg text-slate-500">
                    {myTasks.length} design {myTasks.length === 1 ? 'task' : 'tasks'} awaiting action
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myTasks.map(project => {
                    const isVideo = project.content_type === 'VIDEO';
                    const isDelivered = isVideo ? !!project.thumbnail_link : !!project.creative_link;
                    
                    // Check if this is a rework project (REWORK_* actions)
                    const isRework = project.history?.some(h => 
                                     h.action?.startsWith('REWORK_')
                                   );
                    
                    // Check if this is a rejected project (only if there are no rework actions)
                    // This prevents projects that were sent for rework from showing as rejected
                    const isRejected = !isRework && (project.status === 'REJECTED' || 
                                     project.history?.some(h => 
                                       h.action === 'REJECTED'
                                     ));
                    
                    return (
                        <div
                            key={project.id}
                            onClick={() => onSelectProject(project)}
                            className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer group"
                        >
                            <div className="p-6 space-y-4">
                                {/* Channel and Priority Badges */}
                                <div className="flex justify-between items-start">
                                    <span
                                        className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE'
                                                ? 'bg-[#FF4F4F] text-white'
                                                : project.channel === 'LINKEDIN'
                                                    ? 'bg-[#0085FF] text-white'
                                                    : 'bg-[#D946EF] text-white'
                                            }`}
                                    >
                                        {project.channel}
                                    </span>
                                    <span
                                        className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                                                ? 'bg-red-500 text-white'
                                                : project.priority === 'MEDIUM'
                                                    ? 'bg-yellow-500 text-black'
                                                    : 'bg-green-500 text-white'
                                            }`}
                                    >
                                        {project.priority}
                                    </span>
                                    {isRejected ? (
                                        <span className="px-2 py-1 bg-red-100 text-red-800 border-2 border-red-600 text-[10px] font-black uppercase">
                                            Rejected
                                        </span>
                                    ) : isRework ? (
                                        <span className="px-2 py-1 bg-orange-100 text-orange-800 border-2 border-orange-600 text-[10px] font-black uppercase">
                                            Rework
                                        </span>
                                    ) : isDelivered ? (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 border-2 border-green-600 text-[10px] font-black uppercase">
                                            ✓ Delivered
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 bg-orange-100 text-orange-800 border-2 border-orange-600 text-[10px] font-black uppercase">
                                            In Progress
                                        </span>
                                    )}
                                </div>

                                {/* Title */}
                                <h3 className="text-lg font-black text-slate-900 uppercase leading-tight">{project.title}</h3>

                                {/* Status */}
                                <div className="space-y-2 text-sm">
                                    {!project.delivery_date ? (
                                        <div className="bg-red-50 border-2 border-red-400 p-2">
                                            <p className="text-[10px] font-bold text-red-800 uppercase">Needs Delivery Date</p>
                                        </div>
                                    ) : isDelivered ? (
                                        <div className="bg-green-50 border-2 border-green-400 p-2">
                                            <p className="text-[10px] font-bold text-green-800">
                                                <FileImage className="w-3 h-3 inline mr-1" />
                                                Delivered
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-orange-50 border-2 border-orange-400 p-2">
                                            <p className="text-[10px] font-bold text-orange-800 uppercase">In Progress</p>
                                        </div>
                                    )}

                                    {project.delivery_date && (
                                        <div className="flex justify-between">
                                            <span className="font-bold text-slate-400 uppercase text-xs">Delivery</span>
                                            <span className="font-bold text-slate-900">{project.delivery_date}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-400 uppercase text-xs">Due</span>
                                        <span className="font-bold text-slate-900">
                                            {formatDistanceToNow(new Date(project.due_date))}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Hint */}
                                <div className="border-t-2 border-slate-100 pt-3">
                                    <button className="w-full bg-[#D946EF] text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                                        {!project.delivery_date ? 'Set Delivery Date' : isDelivered ? 'View Details' : `Upload ${isVideo ? 'Thumbnail' : 'Creative'}`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {myTasks.length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-black p-12 text-center bg-slate-50">
                        <h3 className="text-xl font-black uppercase text-slate-400">All Caught Up!</h3>
                        <p className="text-slate-500 mt-2">No design tasks</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DesignerMyWork;