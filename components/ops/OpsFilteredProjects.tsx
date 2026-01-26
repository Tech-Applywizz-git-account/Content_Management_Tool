import React from 'react';
import { Project, TaskStatus, WorkflowStage } from '../../types';
import { FileText, Video, Image, Link as LinkIcon, Eye, Clock, CheckCircle, AlertTriangle, CalendarCheck, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
    user: { full_name: string };
    projects: Project[];
    viewMode: 'ceo-approved-ideas' | 'ready-to-schedule' | 'scheduled-projects' | 'posted-this-week';
    onSelectProject: (project: { project: Project, source: string }) => void;
    onBack: () => void;
}

const OpsFilteredProjects: React.FC<Props> = ({ user, projects, viewMode, onSelectProject, onBack }) => {
    // Apply specific filtering based on view mode
    const filteredProjects = projects.filter(project => {
        switch (viewMode) {
            case 'ceo-approved-ideas':
                // CEO approved projects that are not yet scheduled
                return (
                    (project.ceo_approved_at || 
                     project.current_stage === WorkflowStage.FINAL_REVIEW_CEO ||
                     project.current_stage === WorkflowStage.OPS_SCHEDULING ||
                     project.current_stage === WorkflowStage.POSTED) &&
                    !project.post_scheduled_date &&
                    !(project.status === TaskStatus.DONE || project.data?.live_url)
                );
            
            case 'ready-to-schedule':
                // Strict filter for ready to schedule projects
                return (
                    project.assigned_to_role === 'OPS' &&
                    project.current_stage === WorkflowStage.OPS_SCHEDULING &&
                    project.status !== 'COMPLETED' &&
                    project.status !== 'REJECTED' &&
                    !project.post_scheduled_date
                );
            
            case 'scheduled-projects':
                // Projects with scheduled date but not yet posted
                return (
                    project.post_scheduled_date &&
                    !project.data?.live_url &&
                    project.status !== TaskStatus.DONE
                );
            
            case 'posted-this-week':
                // Completed projects posted this week
                if (!(project.status === TaskStatus.DONE || project.data?.live_url || project.current_stage === WorkflowStage.POSTED)) return false;
                const postedDate = project.post_scheduled_date ? new Date(project.post_scheduled_date) : new Date(project.updated_at || project.created_at);
                const weekAgo = new Date(Date.now() - 7 * 86400000);
                return postedDate >= weekAgo;
            
            default:
                return false;
        }
    });

    const getViewTitle = () => {
        switch (viewMode) {
            case 'ceo-approved-ideas': return 'CEO Approved Projects';
            case 'ready-to-schedule': return 'Ready to Schedule';
            case 'scheduled-projects': return 'Scheduled Projects';
            case 'posted-this-week': return 'Posted This Week';
            default: return 'Projects';
        }
    };

    const getViewDescription = () => {
        switch (viewMode) {
            case 'ceo-approved-ideas': 
                return `${filteredProjects.length} CEO-approved projects ready for scheduling`;
            case 'ready-to-schedule': 
                return `${filteredProjects.length} projects ready to be scheduled`;
            case 'scheduled-projects': 
                return `${filteredProjects.length} projects scheduled for posting`;
            case 'posted-this-week': 
                return `${filteredProjects.length} projects posted this week`;
            default: 
                return `${filteredProjects.length} projects`;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Back button and header */}
            <div className="border-b-2 border-black pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <button
                            onClick={onBack}
                            className="flex items-center text-sm font-black text-slate-700 hover:text-slate-900 py-2 px-4 bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all mb-4"
                        >
                            ← Back to Dashboard
                        </button>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">
                            {getViewTitle()}
                        </h1>
                        <p className="font-bold text-base text-slate-500">
                            {getViewDescription()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Projects grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map(project => (
                    <div
                        key={project.id}
                        onClick={() => onSelectProject({ project, source: viewMode })}
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
                                {project.content_type === 'VIDEO' && project.video_link && (
                                    <div className="flex items-center gap-2 text-sm mb-2">
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
                            </div>

                            {/* Approval Status Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                {/* CMO Approval Status */}
                                <div className="flex items-center gap-2 text-sm p-2 bg-slate-50 border border-slate-200 rounded">
                                    {project.cmo_approved_at ? (
                                        <CheckCircle size={14} className="text-green-600" />
                                    ) : (
                                        <AlertTriangle size={14} className="text-red-500" />
                                    )}
                                    <span className={`font-bold ${project.cmo_approved_at ? 'text-green-700' : 'text-red-500'}`}>
                                        {project.cmo_approved_at ? 'CMO Approved' : 'CMO Pending'}
                                    </span>
                                </div>

                                {/* CEO Approval Status */}
                                <div className="flex items-center gap-2 text-sm p-2 bg-slate-50 border border-slate-200 rounded">
                                    {project.ceo_approved_at ? (
                                        <CheckCircle size={14} className="text-green-600" />
                                    ) : (
                                        <AlertTriangle size={14} className="text-red-500" />
                                    )}
                                    <span className={`font-bold ${project.ceo_approved_at ? 'text-green-700' : 'text-red-500'}`}>
                                        {project.ceo_approved_at ? 'CEO Approved' : 'CEO Pending'}
                                    </span>
                                </div>
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

                {filteredProjects.length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-black p-12 text-center bg-slate-50 rounded-lg">
                        <h3 className="text-xl font-black uppercase text-slate-400">No Projects Found</h3>
                        <p className="text-slate-500 mt-2">
                            {viewMode === 'ceo-approved-ideas' && 'No CEO-approved projects available'}
                            {viewMode === 'ready-to-schedule' && 'No projects ready to schedule'}
                            {viewMode === 'scheduled-projects' && 'No scheduled projects found'}
                            {viewMode === 'posted-this-week' && 'No projects posted this week'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OpsFilteredProjects;