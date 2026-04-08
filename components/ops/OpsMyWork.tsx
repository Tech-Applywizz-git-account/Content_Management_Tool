import React from 'react';
import { Project, WorkflowStage, Role, TaskStatus } from '../../types';
import { Calendar, FileText, Video, Image, Link as LinkIcon, Eye, Clock, CheckCircle, AlertTriangle, CalendarCheck } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
    user: { full_name: string };
    projects: Project[];
    onSelectProject: (project: { project: Project, source: 'mywork' }) => void;
    filterCategory?: string; // 'pending', 'completed', 'ceoapproved', 'readytoschedule', 'scheduled', 'postedthisweek'
}

const OpsMyWork: React.FC<Props> = ({ projects, onSelectProject, filterCategory = 'pending' }) => {
    // Only show projects currently assigned to OPS role
    const opsProjects = projects.filter(project => project.assigned_to_role === 'OPS');

    // Filter projects to show only pending works by default
    const filteredProjects = opsProjects.filter(project => {
        // Check if project is completed/posted
        const isCompleted = project.status === TaskStatus.DONE ||
            project.data?.live_url ||
            project.current_stage === WorkflowStage.POSTED;

        switch (filterCategory) {
            case 'pending':
                // Show only pending/active projects (not completed)
                return !isCompleted;
            case 'completed':
                // Show only completed/posted projects
                return isCompleted;
            case 'ceoapproved':
                // CEO approved projects - must be approved by CEO and not completed
                // STRICT CHECK: Only check the timestamp and ensure it is past script phase
                return !!project.ceo_approved_at && 
                       project.current_stage !== WorkflowStage.SCRIPT &&
                       project.current_stage !== WorkflowStage.SCRIPT_REVIEW_L1 &&
                       project.current_stage !== WorkflowStage.SCRIPT_REVIEW_L2 &&
                       !isCompleted;
            case 'readytoschedule':
                // Strict filter for ready to schedule projects
                return (
                    project.assigned_to_role === 'OPS' &&
                    project.current_stage === WorkflowStage.OPS_SCHEDULING &&
                    project.status !== 'COMPLETED' &&
                    project.status !== 'REJECTED' &&
                    !project.post_scheduled_date &&
                    !isCompleted
                );
            case 'scheduled':
                // Have a post_scheduled_date but not yet posted/completed
                return project.post_scheduled_date &&
                    !project.data?.live_url &&
                    project.status !== TaskStatus.DONE &&
                    !isCompleted;
            case 'postedthisweek':
                // Show only completed projects posted this week
                if (!(project.status === TaskStatus.DONE || project.data?.live_url || project.current_stage === WorkflowStage.POSTED)) return false;
                const postedDate = project.post_scheduled_date ? new Date(project.post_scheduled_date) : new Date(project.updated_at || project.created_at);
                const weekAgo = new Date(Date.now() - 7 * 86400000);
                return postedDate >= weekAgo;
            default:
                // 'pending' case - show only pending/active projects (not completed)
                return !isCompleted;
        }
    });

    // Show filtered projects based on the selected category
    const myTasks = filteredProjects || [];

    const getHeaderText = () => {
        switch (filterCategory) {
            case 'pending':
                return 'pending project' + (myTasks.length !== 1 ? 's' : '');
            case 'completed':
                return 'completed project' + (myTasks.length !== 1 ? 's' : '');
            case 'ceoapproved':
                return 'CEO-approved project' + (myTasks.length !== 1 ? 's' : '');
            case 'readytoschedule':
                return 'ready to schedule project' + (myTasks.length !== 1 ? 's' : '');
            case 'scheduled':
                return 'scheduled project' + (myTasks.length !== 1 ? 's' : '');
            case 'postedthisweek':
                return 'posted this week project' + (myTasks.length !== 1 ? 's' : '');
            default:
                return 'pending project' + (myTasks.length !== 1 ? 's' : '');
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
                    {myTasks.length} {getHeaderText()} needing attention
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myTasks.map(project => (
                    <div
                        key={project.id}
                        onClick={() => onSelectProject({ project, source: 'mywork' })}
                        className={`bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer group ${project.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`}
                    >
                        <div className="p-6">
                            {/* Header Section */}
                            <div className="flex justify-between items-start mb-4">
                                <span
                                    className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE'
                                        ? 'bg-[#FF4F4F] text-white'
                                        : project.channel === 'LINKEDIN'
                                            ? 'bg-[#0085FF] text-white'
                                            : 'bg-[#D946EF] text-white'
                                        }`}
                                >
                                    {project.channel}
                                </span>

                                <div className="flex gap-2">
                                    <span
                                        className={`px-2 py-1 text-xs font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                                            ? 'bg-red-500 text-white'
                                            : project.priority === 'NORMAL'
                                                ? 'bg-yellow-500 text-black'
                                                : 'bg-green-500 text-white'
                                            }`}
                                    >
                                        {project.priority}
                                    </span>

                                    {project.status === 'REJECTED' ? (
                                        <span className="px-2 py-1 bg-red-100 text-red-800 border-2 border-red-600 text-[10px] font-black uppercase flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            Rework
                                        </span>
                                    ) : project.data?.live_url ? (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 border-2 border-green-600 text-[10px] font-black uppercase flex items-center gap-1">
                                            <CheckCircle size={12} />
                                            ✓ Posted
                                        </span>
                                    ) : project.post_scheduled_date ? (
                                        <span className="px-2 py-1 bg-orange-100 text-orange-800 border-2 border-orange-600 text-[10px] font-black uppercase flex items-center gap-1">
                                            <CalendarCheck size={12} />
                                            Scheduled
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 bg-red-100 text-red-800 border-2 border-red-600 text-[10px] font-black uppercase flex items-center gap-1">
                                            <Clock size={12} />
                                            Needs Action
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-black text-slate-900 uppercase leading-tight mb-3">{project.title}</h3>

                            {/* Content Type */}
                            <div className="flex items-center gap-2 mb-4 text-sm">
                                <FileText size={16} className="text-slate-500" />
                                <span className="font-bold text-slate-900">{project.content_type}</span>
                            </div>

                            {/* Asset Status */}
                            <div className="mb-4">
                                {['VIDEO', 'APPLYWIZZ_USA_JOBS'].includes(project.content_type) && project.video_link && (
                                    <div className="flex items-center gap-2 text-sm mb-2">
                                        <Video size={16} className="text-blue-500" />
                                        <span className="text-blue-700 font-bold">Video Ready</span>
                                    </div>
                                )}

                                {(['VIDEO', 'APPLYWIZZ_USA_JOBS'].includes(project.content_type) && project.thumbnail_link) || (project.content_type === 'CREATIVE_ONLY' && project.creative_link) ? (
                                    <div className="flex items-center gap-2 text-sm">
                                        {['VIDEO', 'APPLYWIZZ_USA_JOBS'].includes(project.content_type) ? (
                                            <Image size={16} className="text-purple-500" />
                                        ) : (
                                            <FileText size={16} className="text-purple-500" />
                                        )}
                                        <span className="text-purple-700 font-bold">
                                            {['VIDEO', 'APPLYWIZZ_USA_JOBS'].includes(project.content_type) ? 'Thumbnail' : 'Creative'} Delivered
                                        </span>
                                    </div>
                                ) : null}
                            </div>

                            {/* Approval Status Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                {(() => {
                                    // Infer Final Review Status from Stage because timestamps might capture Script Approval
                                    const isCmoFinalApproved = [
                                        WorkflowStage.FINAL_REVIEW_CEO,
                                        WorkflowStage.OPS_SCHEDULING,
                                        WorkflowStage.POSTED
                                    ].includes(project.current_stage) || !!project.data?.live_url;

                                    const isCeoFinalApproved = [
                                        WorkflowStage.OPS_SCHEDULING,
                                        WorkflowStage.POSTED
                                    ].includes(project.current_stage) || !!project.data?.live_url;

                                    return (
                                        <>
                                            {/* CMO Approval Status */}
                                            <div className="flex items-center gap-2 text-sm p-2 bg-slate-50 border border-slate-200 rounded">
                                                {isCmoFinalApproved ? (
                                                    <CheckCircle size={14} className="text-green-600" />
                                                ) : (
                                                    <AlertTriangle size={14} className="text-amber-500" />
                                                )}
                                                <span className={`font-bold ${isCmoFinalApproved ? 'text-green-700' : 'text-amber-600'}`}>
                                                    {isCmoFinalApproved ? 'CMO Approved' : 'CMO Review'}
                                                </span>
                                            </div>

                                            {/* CEO Approval Status */}
                                            <div className="flex items-center gap-2 text-sm p-2 bg-slate-50 border border-slate-200 rounded">
                                                {isCeoFinalApproved ? (
                                                    <CheckCircle size={14} className="text-green-600" />
                                                ) : (
                                                    <AlertTriangle size={14} className="text-amber-500" />
                                                )}
                                                <span className={`font-bold ${isCeoFinalApproved ? 'text-green-700' : 'text-amber-600'}`}>
                                                    {isCeoFinalApproved ? 'CEO Approved' : 'CEO Review'}
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Status Info */}
                            <div className="mb-4">
                                {project.status === 'REJECTED' ? (
                                    <div className="bg-red-50 border-2 border-red-400 p-3 rounded">
                                        <p className="text-[10px] font-bold text-red-800 uppercase flex items-center gap-1 mb-1">
                                            <AlertTriangle size={12} />
                                            Rework Requested
                                        </p>
                                        {project.history && project.history.length > 0 && (
                                            <p className="text-xs text-red-600">
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
                                            <div className="flex items-center gap-2 text-sm p-2 bg-blue-50 border border-blue-200 rounded mb-2">
                                                <Calendar size={14} className="text-blue-600" />
                                                <span>Scheduled: {format(new Date(project.post_scheduled_date), 'MMM dd, yyyy')}</span>
                                            </div>
                                        )}
                                        {project.data?.live_url && (
                                            <div className="flex items-center gap-2 text-sm p-2 bg-green-50 border border-green-200 rounded">
                                                <LinkIcon size={14} className="text-green-600" />
                                                <span className="font-bold text-green-700">Posted</span>
                                            </div>
                                        )}
                                        {!project.post_scheduled_date && !project.data?.live_url && (
                                            <div className="flex items-center gap-2 text-sm p-2 bg-amber-50 border border-amber-200 rounded">
                                                <Clock size={14} className="text-amber-600" />
                                                <span className="font-bold text-amber-700">⏳ Needs Scheduling</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Action Button */}
                            <div className="pt-3 border-t border-slate-200">
                                <button className="w-full bg-[#FF4F4F] text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2">
                                    <Eye size={12} />
                                    {project.data?.live_url ? 'View Details' : project.post_scheduled_date ? 'Manage Post' : 'Schedule Post'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {myTasks.length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-black p-12 text-center bg-slate-50 rounded-lg">
                        <h3 className="text-xl font-black uppercase text-slate-400">All Caught Up!</h3>
                        <p className="text-slate-500 mt-2">No pending projects requiring your attention</p>
                        <div className="mt-4 text-4xl">🎉</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OpsMyWork;