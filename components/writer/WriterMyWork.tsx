import React from 'react';
import { Project, Role, TaskStatus } from '../../types';
import { Clock, FileText, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
    user: { full_name: string; role: Role };
    projects: Project[];
}

const WriterMyWork: React.FC<Props> = ({ user, projects }) => {
    // Show all projects the writer has participated in (submitted / approved / rejected)
    // No filtering by assigned_to_role - show all projects from getMyWork
    const myTasks = projects || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase text-slate-900 mb-2">My Work</h2>
                <p className="text-sm sm:text-base text-slate-600 font-medium">All your assigned tasks and pending work</p>
            </div>

            <div className="grid gap-4">
                {myTasks.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-12 text-center">
                        <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-black uppercase text-slate-400 mb-2">All Caught Up!</h3>
                        <p className="text-slate-500">No pending tasks at the moment</p>
                    </div>
                ) : (
                    myTasks.map(task => (
                        <div
                            key={task.id}
                            className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${task.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                                task.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                                    'bg-[#D946EF] text-white'
                                            }`}>
                                            {task.channel}
                                        </span>
                                        <span className="px-3 py-1 bg-blue-100 text-blue-800 border-2 border-blue-600 text-xs font-black uppercase">
                                            {task.status}
                                        </span>
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-black uppercase text-slate-900 mb-2">{task.title}</h3>
                                    {task.data?.brief && (
                                        <p className="text-slate-600 mb-3">{task.data.brief}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t-2 border-slate-100">
                                <div className="flex items-center text-sm font-bold text-slate-500 uppercase">
                                    <Clock className="w-4 h-4 mr-2" />
                                    Created {formatDistanceToNow(new Date(task.created_at))} ago
                                </div>
                                <div className="flex items-center text-sm font-bold uppercase">
                                    <FileText className="w-4 h-4 mr-2" />
                                    <span className={`${task.status === TaskStatus.REJECTED ? 'text-red-600' : 'text-blue-600'
                                        }`}>
                                        {task.status === TaskStatus.REJECTED ? 'Needs Revision' : 'In Progress'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WriterMyWork;