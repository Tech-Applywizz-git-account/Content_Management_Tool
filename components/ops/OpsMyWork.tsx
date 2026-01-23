import React from 'react';
import { Project, WorkflowStage, Role, TaskStatus } from '../../types';
import { Calendar, FileText, Video, Image, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
    user: { full_name: string };
    projects: Project[];
    onSelectProject: (project: { project: Project, source: 'mywork' }) => void;
    filterCategory?: string; // 'all', 'ceoapproved', 'readytoschedule', 'scheduled', 'postedthisweek'
}

const OpsMyWork: React.FC<Props> = ({ projects, onSelectProject, filterCategory = 'all' }) => {
    // Filter projects based on the selected category
    const filteredProjects = projects.filter(project => {
        switch (filterCategory) {
            case 'ceoapproved':
                return (
                    project.current_stage === WorkflowStage.CINEMATOGRAPHY ||
                    project.current_stage === WorkflowStage.VIDEO_EDITING ||
                    project.current_stage === WorkflowStage.FINAL_REVIEW_CMO ||
                    project.current_stage === WorkflowStage.FINAL_REVIEW_CEO ||
                    project.current_stage === WorkflowStage.OPS_SCHEDULING ||
                    project.current_stage === WorkflowStage.POSTED
                );
            case 'readytoschedule':
                return project.current_stage === WorkflowStage.OPS_SCHEDULING &&
                    !project.post_scheduled_date;
            case 'scheduled':
                return project.current_stage === WorkflowStage.OPS_SCHEDULING &&
                    project.post_scheduled_date &&
                    !project.data?.live_url;
            case 'postedthisweek':
                if (project.current_stage !== WorkflowStage.POSTED) return false;
                const postedDate = project.post_scheduled_date ? new Date(project.post_scheduled_date) : null;
                if (!postedDate) return false;
                const weekAgo = new Date(Date.now() - 7 * 86400000);
                return postedDate >= weekAgo;
            default:
                return true; // 'all' case
        }
    });

    // Show filtered projects based on the selected category
    const myTasks = filteredProjects || [];

    const getHeaderText = () => {
        switch (filterCategory) {
            case 'ceoapproved':
                return 'CEO-approved project' + (myTasks.length !== 1 ? 's' : '');
            case 'readytoschedule':
                return 'ready to schedule project' + (myTasks.length !== 1 ? 's' : '');
            case 'scheduled':
                return 'scheduled project' + (myTasks.length !== 1 ? 's' : '');
            case 'postedthisweek':
                return 'posted this week project' + (myTasks.length !== 1 ? 's' : '');
            default:
                return 'project' + (myTasks.length !== 1 ? 's' : '') + ' I\'ve worked on';
        }
    };

    const getPlatformColor = (channel: string) => {
        switch (channel) {
            case 'LINKEDIN': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'YOUTUBE': return 'bg-red-100 text-red-800 border-red-300';
            case 'INSTAGRAM': return 'bg-purple-100 text-purple-800 border-purple-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                    My Work
                </h1>
                <p className="font-bold text-lg text-slate-500">
                    {myTasks.length} {getHeaderText()} I've worked on
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myTasks.map(project => (
                    <div
                        key={project.id}
                        onClick={() => onSelectProject({ project, source: 'mywork' })}
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
                                {project.status === 'REJECTED' ? (
                                    <span className="px-2 py-1 bg-red-100 text-red-800 border-2 border-red-600 text-[10px] font-black uppercase">
                                        Rework
                                    </span>
                                ) : project.data?.live_url ? (
                                    <span className="px-2 py-1 bg-green-100 text-green-800 border-2 border-green-600 text-[10px] font-black uppercase">
                                        ✓ Posted
                                    </span>
                                ) : project.post_scheduled_date ? (
                                    <span className="px-2 py-1 bg-orange-100 text-orange-800 border-2 border-orange-600 text-[10px] font-black uppercase">
                                        Scheduled
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 bg-red-100 text-red-800 border-2 border-red-600 text-[10px] font-black uppercase">
                                        Needs Action
                                    </span>
                                )}
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-black text-slate-900 uppercase leading-tight">{project.title}</h3>

                            {/* Status */}
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-sm">
                                    <FileText size={16} className="text-slate-500" />
                                    <span className="font-bold text-slate-900">{project.content_type}</span>
                                </div>

                                {project.content_type === 'VIDEO' && project.video_link && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Video size={16} className="text-blue-500" />
                                        <span className="text-blue-700 font-bold">Video Ready</span>
                                    </div>
                                )}

                                {(project.content_type === 'VIDEO' && project.thumbnail_link) || (project.content_type === 'CREATIVE_ONLY' && project.creative_link) ? (
                                    <div className="flex items-center gap-2 text-sm">
                                        {project.content_type === 'VIDEO' ? (
                                            <Image size={16} className="text-purple-500" />
                                        ) : (
                                            <FileText size={16} className="text-purple-500" />
                                        )}
                                        <span className="text-purple-700 font-bold">
                                            {project.content_type === 'VIDEO' ? 'Thumbnail' : 'Creative'} Delivered
                                        </span>
                                    </div>
                                ) : null}

                                {/* Approval Status Indicators */}
                                <div className="space-y-2 text-sm">
                                    {/* CMO Approval Status */}
                                    {project.cmo_approved_at ? (
                                        <div className="flex items-center gap-2 text-green-700">
                                            <span className="text-green-600 font-bold">✓</span>
                                            <span className="text-green-700 font-bold">CMO Approved</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-red-500">
                                            <span className="text-red-500 font-bold">✕</span>
                                            <span className="text-red-500 font-bold">CMO Pending</span>
                                        </div>
                                    )}

                                    {/* CEO Approval Status */}
                                    {project.ceo_approved_at ? (
                                        <div className="flex items-center gap-2 text-green-700">
                                            <span className="text-green-600 font-bold">✓</span>
                                            <span className="text-green-700 font-bold">CEO Approved</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-red-500">
                                            <span className="text-red-500 font-bold">✕</span>
                                            <span className="text-red-500 font-bold">CEO Pending</span>
                                        </div>
                                    )}
                                </div>

                                {/* Status Info */}
                                <div className="space-y-2 text-sm">
                                    {project.status === 'REJECTED' ? (
                                        <div className="bg-red-50 border-2 border-red-400 p-2">
                                            <p className="text-[10px] font-bold text-red-800 uppercase">Rework Requested</p>
                                            {project.history && project.history.length > 0 && (
                                                <p className="text-[10px] text-red-600 mt-1">
                                                    {(() => {
                                                        // Find the most recent REWORK or REJECTED action for the comment
                                                        const reworkHistory = project.history.find(h => h.action === 'REWORK' || h.action === 'REJECTED');
                                                        return reworkHistory?.comment || 'No comment provided';
                                                    })()}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {project.post_scheduled_date && (
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Calendar size={16} />
                                                    <span>Scheduled: {format(new Date(project.post_scheduled_date), 'MMM dd, yyyy')}</span>
                                                </div>
                                            )}
                                            {project.data?.live_url && (
                                                <div className="flex items-center gap-2 text-green-700">
                                                    <LinkIcon size={16} />
                                                    <span className="font-bold">Posted</span>
                                                </div>
                                            )}
                                            {!project.post_scheduled_date && !project.data?.live_url && (
                                                <div className="text-amber-600 font-bold">⏳ Needs Scheduling</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Action Hint */}
                            <div className="border-t-2 border-slate-100 pt-3">
                                <button className="w-full bg-[#FF4F4F] text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                                    {project.data?.live_url ? 'View Details' : project.post_scheduled_date ? 'Manage Post' : 'Schedule Post'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {myTasks.length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-black p-12 text-center bg-slate-50">
                        <h3 className="text-xl font-black uppercase text-slate-400">All Caught Up!</h3>
                        <p className="text-slate-500 mt-2">No projects you've worked on</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OpsMyWork;