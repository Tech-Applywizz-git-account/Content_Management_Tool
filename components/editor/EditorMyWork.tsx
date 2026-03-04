import React from 'react';
import { Project, Role, TaskStatus } from '../../types';
import { format } from 'date-fns';
import { CalendarIcon, Video, Film } from 'lucide-react';
import { isActiveRework } from '../../services/workflowUtils';
import EditorScripts from './EditorScripts';

interface Props {
    user: { full_name: string; role: Role };
    projects: Project[];
    scriptProjects?: Project[];
    onSelectProject: (project: Project) => void;
    activeFilter?: 'NEEDS_DELIVERY' | 'IN_PROGRESS' | 'COMPLETED' | 'SCRIPTS' | 'CINE' | null;
    completedSubTab?: 'POST' | 'POSTED' | null;
    onSetCompletedSubTab?: (tab: 'POST' | 'POSTED' | null) => void;
}

const EditorMyWork: React.FC<Props> = ({ user, projects, scriptProjects, onSelectProject, activeFilter, completedSubTab, onSetCompletedSubTab }) => {
    const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
    const [activeRoleFilter, setActiveRoleFilter] = React.useState<Role | 'ALL' | 'POSTED'>('ALL');


    // Show all projects the editor has participated in
    // No filtering by assigned_to_role - show all projects from getMyWork
    const myTasks = React.useMemo(() => {
        if (activeFilter === 'SCRIPTS') {
            let filtered = scriptProjects || [];

            if (activeRoleFilter !== 'ALL') {
                if (activeRoleFilter === 'POSTED') {
                    filtered = filtered.filter(p => p.status === 'DONE' && p.data?.live_url);
                } else {
                    filtered = filtered.filter(p => {
                        if (activeRoleFilter === Role.SUB_EDITOR) {
                            return p.assigned_to_role === Role.SUB_EDITOR || p.assigned_to_role === Role.EDITOR;
                        }
                        return p.assigned_to_role === activeRoleFilter;
                    });
                }
            }
            return filtered;
        }

        if (activeFilter === 'CINE') {
            return (scriptProjects || []).filter(p => p.current_stage === 'CINEMATOGRAPHY');
        }

        // Sort projects by priority:
        // 1. Projects without delivery date (highest priority)
        // 2. Projects in progress without uploaded video
        // 3. Projects with uploaded videos (lowest priority)
        const sortedProjects = [...(projects || [])].sort((a, b) => {
            const aHasDeliveryDate = !!a.delivery_date;
            const bHasDeliveryDate = !!b.delivery_date;
            const aHasVideo = !!a.edited_video_link;
            const bHasVideo = !!b.edited_video_link;

            // Projects without delivery date come first
            if (aHasDeliveryDate && !bHasDeliveryDate) return 1;
            if (!aHasDeliveryDate && bHasDeliveryDate) return -1;

            // Among projects with delivery date, those without video come before those with video
            if (aHasVideo && !bHasVideo) return 1;
            if (!aHasVideo && bHasVideo) return -1;

            // If both have same status, maintain original order
            return 0;
        });

        return sortedProjects;
    }, [projects, scriptProjects, activeFilter, activeRoleFilter]);

    if (selectedProject && activeFilter === 'SCRIPTS') {
        return (
            <EditorScripts
                project={selectedProject}
                userRole={user.role}
                onBack={() => setSelectedProject(null)}
            />
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                    My Work
                </h1>
                <p className="font-bold text-lg text-slate-500">
                    {myTasks.length} editing {myTasks.length === 1 ? 'project' : 'projects'} awaiting action
                </p>
            </div>

            {/* Sub-tabs for COMPLETED filter */}
            {activeFilter === 'COMPLETED' && onSetCompletedSubTab && (
                <div className="flex space-x-4 border-b-2 border-black pb-2">
                    <button
                        onClick={() => onSetCompletedSubTab('POST')}
                        className={`px-4 py-2 font-bold uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${completedSubTab === 'POST'
                            ? 'bg-[#3B82F6] text-white'
                            : 'bg-white text-black hover:bg-slate-100'}`}
                    >
                        Post
                    </button>
                    <button
                        onClick={() => onSetCompletedSubTab('POSTED')}
                        className={`px-4 py-2 font-bold uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${completedSubTab === 'POSTED'
                            ? 'bg-[#10B981] text-white'
                            : 'bg-white text-black hover:bg-slate-100'}`}
                    >
                        Posted
                    </button>
                    <button
                        onClick={() => onSetCompletedSubTab(null)}
                        className={`px-4 py-2 font-bold uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${completedSubTab === null
                            ? 'bg-black text-white'
                            : 'bg-white text-black hover:bg-slate-100'}`}
                    >
                        All
                    </button>
                </div>
            )}

            {/* Role Filters for SCRIPTS view */}
            {activeFilter === 'SCRIPTS' && (
                <div className="overflow-x-auto pb-4">
                    <div className="flex space-x-2 min-w-max">
                        {['ALL', 'POSTED', Role.WRITER, Role.CMO, Role.CEO, Role.CINE, Role.SUB_EDITOR, Role.DESIGNER, Role.OPS].map((role) => (
                            <button
                                key={role}
                                onClick={() => setActiveRoleFilter(role as Role | 'ALL' | 'POSTED')}
                                className={`px-4 py-2 text-xs font-black uppercase border-2 border-black transition-all ${activeRoleFilter === role
                                    ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(100,100,100,1)]'
                                    : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {role === 'ALL' ? 'ALL' : role === 'POSTED' ? 'POSTED' : role === Role.SUB_EDITOR ? 'EDITOR' : role}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myTasks.map(project => {
                    const isDelivered = !!project.edited_video_link;

                    // Use the canonical rework condition
                    const isRework = isActiveRework(project, user.role);
                    const isRejected = project.status === TaskStatus.REJECTED && project.assigned_to_role === user.role;

                    return (
                        <div
                            key={project.id}
                            onClick={() => {
                                if (activeFilter === 'SCRIPTS') {
                                    setSelectedProject(project);
                                } else {
                                    onSelectProject(project);
                                }
                            }}
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
                                                : project.channel === 'JOBBOARD'
                                                    ? 'bg-[#F59E0B] text-white'
                                                    : project.channel === 'LEAD_MAGNET'
                                                        ? 'bg-[#10B981] text-white'
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
                                    {activeFilter !== 'SCRIPTS' && project.video_link && (
                                        <div className="bg-blue-50 border-2 border-blue-400 p-2">
                                            <p className="text-[10px] font-bold text-blue-800">
                                                <Video className="w-3 h-3 inline mr-1" />
                                                Raw Video Ready
                                            </p>
                                        </div>
                                    )}
                                    {activeFilter !== 'SCRIPTS' && !project.delivery_date && (
                                        <div className="bg-red-50 border-2 border-red-400 p-2">
                                            <p className="text-[10px] font-bold text-red-800 uppercase">Needs Delivery Date</p>
                                        </div>
                                    )}
                                    {activeFilter !== 'SCRIPTS' && project.delivery_date && (
                                        <div className="flex justify-between">
                                            <span className="font-bold text-slate-400 uppercase text-xs">Delivery</span>
                                            <span className="font-bold text-slate-900">{project.delivery_date}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-400 uppercase text-xs">Writer</span>
                                        <span className="font-bold text-slate-900">{project.data?.writer_name || project.writer_name || 'Unknown'}</span>
                                    </div>
                                    {(activeFilter === 'SCRIPTS' || activeFilter === 'COMPLETED') && (
                                        <div className="flex justify-between">
                                            <span className="font-bold text-slate-400 uppercase text-xs">Current Stage</span>
                                            <span className="font-bold text-slate-900">{project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'N/A'}</span>
                                        </div>
                                    )}

                                    {/* Show live URL for completed projects */}
                                    {project.status === 'DONE' && project.data?.live_url && (
                                        <div className="pt-2 border-t border-slate-100 mt-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-400 uppercase text-xs">Live URL</span>
                                                <a
                                                    href={project.data.live_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-bold text-blue-600 hover:underline truncate max-w-[120px]"
                                                    title={project.data.live_url}
                                                >
                                                    View Live
                                                </a>
                                            </div>
                                            <div className="text-xs text-slate-600 truncate" title={project.data.live_url}>
                                                {project.data.live_url}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Hint */}
                                <div className="border-t-2 border-slate-100 pt-3">
                                    <button className="w-full bg-[#FF4F4F] text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                                        {activeFilter === 'SCRIPTS' || activeFilter === 'CINE' ? 'View Script' : !project.delivery_date ? 'Set Delivery Date' : project.edited_video_link ? 'View Details' : 'Upload Edited Video'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {myTasks.length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-black p-12 text-center bg-slate-50">
                        <h3 className="text-xl font-black uppercase text-slate-400">All Caught Up!</h3>
                        <p className="text-slate-500 mt-2">No pending edits</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditorMyWork;