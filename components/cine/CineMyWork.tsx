import React from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS } from '../../types';
import { format } from 'date-fns';
import { CalendarIcon, Video } from 'lucide-react';
import { getWorkflowState } from '../../services/workflowUtils';

interface Props {
    user: { full_name: string; role: Role };
    projects: Project[];
    scriptProjects?: Project[];
    onSelectProject: (project: Project) => void;
    activeFilter?: 'NEEDS_SCHEDULE' | 'SCHEDULED' | 'UPLOADED' | 'SCRIPTS' | null;
}

const CineMyWork: React.FC<Props> = ({ user, projects, scriptProjects, onSelectProject, activeFilter }) => {
    // Show all projects the cinematographer has participated in
    // No filtering by assigned_to_role - show all projects from getMyWork
    const myTasks = React.useMemo(() => {
        if (activeFilter === 'SCRIPTS') {
            // Use the script projects passed from parent when SCRIPTS filter is active
            return scriptProjects || [];
        }
        return projects || [];
    }, [projects, scriptProjects, activeFilter]);

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                    My Work
                </h1>
                <p className="font-bold text-lg text-slate-500">
                    {myTasks.length} {myTasks.length === 1 ? 'project' : 'projects'} awaiting action
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myTasks.map(project => {
                    const isScheduled = !!project.shoot_date;
                    const isUploaded = !!project.video_link;
                    
                    // Use the centralized workflow state detection
                    const workflowState = getWorkflowState(project);
                    const isRework = workflowState.isRework;
                    const isRejected = workflowState.isRejected;
                    
                    return (
                        <div
                            key={project.id}
                            onClick={() => onSelectProject(project)}
                            className={`bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer group ${project.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`}
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
                                                : project.priority === 'NORMAL'
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
                                    ) : isUploaded ? (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 border-2 border-green-600 text-[10px] font-black uppercase">
                                            ✓ Uploaded
                                        </span>
                                    ) : isScheduled ? (
                                        <span className="px-2 py-1 bg-orange-100 text-orange-800 border-2 border-orange-600 text-[10px] font-black uppercase">
                                            Scheduled
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 bg-red-100 text-red-800 border-2 border-red-600 text-[10px] font-black uppercase">
                                            Needs Schedule
                                        </span>
                                    )}
                                </div>

                                {/* Title */}
                                <h3 className="text-lg font-black text-slate-900 uppercase leading-tight">{project.title}</h3>

                                {/* Writer Name */}
                                {project.data?.writer_name && (
                                    <div className="flex justify-between text-sm">
                                        <span className="font-bold text-slate-400 uppercase text-xs">Writer</span>
                                        <span className="font-bold text-slate-900">{project.data.writer_name}</span>
                                    </div>
                                )}
                                
                                {/* Status */}
                                <div className="space-y-2 text-sm">
                                    {isScheduled && (
                                        <div className="flex justify-between">
                                            <span className="font-bold text-slate-400 uppercase text-xs">Shoot Date</span>
                                            <span className="font-bold text-slate-900">{project.shoot_date}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-400 uppercase text-xs">Due</span>
                                        <span className="font-bold text-slate-900">
                                            {format(new Date(project.due_date), 'MMM dd, yyyy h:mm a')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-400 uppercase text-xs">Submitted</span>
                                        <span className="font-bold text-slate-900">
                                            {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}
                                        </span>
                                    </div>
                                    {/* Show current stage for script preview */}
                                    {activeFilter === 'SCRIPTS' && (
                                        <div className="flex justify-between">
                                            <span className="font-bold text-slate-400 uppercase text-xs">Stage</span>
                                            <span className="font-bold text-slate-900">
                                                {STAGE_LABELS[project.current_stage] || project.current_stage.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Action Hint */}
                                <div className="border-t-2 border-slate-100 pt-3">
                                    <button className="w-full bg-[#D946EF] text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                                        {activeFilter === 'SCRIPTS' ? 'View Script' : !isScheduled ? 'Schedule Shoot' : !isUploaded ? 'Upload Video' : 'View Details'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {myTasks.length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-black p-12 text-center bg-slate-50">
                        <h3 className="text-xl font-black uppercase text-slate-400">All Caught Up!</h3>
                        <p className="text-slate-500 mt-2">No pending shoots</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CineMyWork;