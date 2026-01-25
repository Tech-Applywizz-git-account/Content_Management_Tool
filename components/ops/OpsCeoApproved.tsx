import React from 'react';
import { Project, WorkflowStage, TaskStatus, Role } from '../../types';
import { Calendar, FileText, Video, Image, Link as LinkIcon, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
    projects: Project[];
    onSelectProject: (project: { project: Project, source: 'ceoapproved' }) => void;
}

const OpsCeoApproved: React.FC<Props> = ({ projects, onSelectProject }) => {
    const ceoApprovedProjects = projects.filter(p =>
        p.current_stage === WorkflowStage.CINEMATOGRAPHY ||
        p.current_stage === WorkflowStage.VIDEO_EDITING ||
        p.current_stage === WorkflowStage.FINAL_REVIEW_CMO ||
        p.current_stage === WorkflowStage.FINAL_REVIEW_CEO ||
        p.current_stage === WorkflowStage.OPS_SCHEDULING ||
        p.current_stage === WorkflowStage.POSTED
    );

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
            <div className="border-b-2 border-black pb-4">
                <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">
                    CEO Approved Scripts
                </h1>
                <p className="font-bold text-base text-slate-500">
                    {ceoApprovedProjects.length} CEO-approved {ceoApprovedProjects.length === 1 ? 'project' : 'projects'} ready for scheduling
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ceoApprovedProjects.map(project => (
                    <div
                        key={project.id}
                        className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all group"
                    >
                        <div className="p-6 space-y-4">
                            {/* Badges */}
                            <div className="flex flex-wrap gap-2">
                                <span
                                    className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black text-white ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F]' :
                                            project.channel === 'LINKEDIN' ? 'bg-[#0085FF]' :
                                                'bg-[#D946EF]'
                                        }`}
                                >
                                    {project.channel}
                                </span>
                                <span
                                    className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black ${project.priority === 'HIGH' ? 'bg-red-500 text-white' :
                                            project.priority === 'NORMAL' ? 'bg-yellow-500 text-black' :
                                                'bg-green-500 text-white'
                                        }`}
                                >
                                    {project.priority}
                                </span>
                                <span className="px-2 py-0.5 bg-green-100 text-green-800 border-2 border-green-600 text-xs font-black uppercase">
                                    CEO Approved
                                </span>
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-black text-slate-900 uppercase leading-tight">{project.title}</h3>

                            {/* Content Type */}
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-sm">
                                    <FileText size={16} className="text-slate-500" />
                                    <span className="font-bold text-slate-900">{project.content_type}</span>
                                </div>

                                {/* Writer Name */}
                                <div className="flex items-center gap-2 text-sm">
                                    <FileText size={16} className="text-slate-500" />
                                    <span className="font-bold text-slate-900">Writer: {project.data?.writer_name || project.data?.cmo_name || 'Unknown'}</span>
                                </div>

                                {/* Thumbnail Required */}
                                {project.data?.thumbnail_required && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Image size={16} className="text-purple-500" />
                                        <span className="font-bold text-purple-700">Thumbnail Required: {project.data.thumbnail_required ? 'Yes' : 'No'}</span>
                                    </div>
                                )}

                                {/* Cinematographer Instructions */}
                                {project.data?.brief && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <FileText size={16} className="text-blue-500" />
                                        <span className="font-bold text-blue-700">Instructions: {project.data.brief.substring(0, 50)}{project.data.brief.length > 50 ? '...' : ''}</span>
                                    </div>
                                )}

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

                                {/* Status Info */}
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <Calendar size={16} />
                                        <span>Created: {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}</span>
                                    </div>
                                    <div className="text-green-600 font-bold">✓ Approved by CEO</div>
                                </div>
                            </div>

                            {/* Read-only view - no action button */}
                            <div className="border-t-2 border-slate-100 pt-3">
                                <button
                                    onClick={() => onSelectProject({ project, source: 'ceoapproved' })}
                                    className="w-full bg-[#8B5CF6] text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                >
                                    <Eye size={12} className="inline mr-1" /> View Details
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {ceoApprovedProjects.length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-black p-12 text-center bg-slate-50">
                        <h3 className="text-xl font-black uppercase text-slate-400">No CEO Approved Scripts</h3>
                        <p className="text-slate-500 mt-2">No scripts have been approved by the CEO yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OpsCeoApproved;