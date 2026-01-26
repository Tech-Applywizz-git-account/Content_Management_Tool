import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, WorkflowStage, TaskStatus, Role } from '../../types';
import { format } from 'date-fns';

interface Props {
    projects: Project[];
    onSelectProject: (project: { project: Project, source: 'ceoapproved' }) => void;
}

const OpsCeoApproved: React.FC<Props> = ({ projects, onSelectProject }) => {
    const navigate = useNavigate();
    // We keep the role filter as it's useful for Ops, but removed the Idea/Script tabs
    const [activeRoleFilter, setActiveRoleFilter] = useState<'ALL' | 'POSTED' | Role>('ALL');

    const ceoApprovedProjectsBase = projects.filter(p =>
        p.current_stage === WorkflowStage.CINEMATOGRAPHY ||
        p.current_stage === WorkflowStage.VIDEO_EDITING ||
        p.current_stage === WorkflowStage.FINAL_REVIEW_CMO ||
        p.current_stage === WorkflowStage.FINAL_REVIEW_CEO ||
        p.current_stage === WorkflowStage.OPS_SCHEDULING ||
        p.current_stage === WorkflowStage.POSTED
    );

    // Filter to show only Scripts (or Ideas that have become Scripts/Production ready)
    // "I need only the scripts i donot need the idea"
    const scriptProjects = ceoApprovedProjectsBase.filter(p =>
        p.data?.source !== 'IDEA_PROJECT' || p.data?.script_content
    );

    const projectsToShow = scriptProjects.filter(p => {
        if (activeRoleFilter === 'ALL') return true;
        if (activeRoleFilter === 'POSTED') {
            return p.current_stage === WorkflowStage.POSTED || p.status === TaskStatus.DONE;
        }
        return p.assigned_to_role === activeRoleFilter;
    });

    const handleProjectClick = (projectId: string) => {
        // Navigate to the same review page used in CMO Overview
        navigate(`/ops/ceo-approved-project/${projectId}`);

    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="border-b-2 border-black pb-4">
                <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">
                    CEO Approved Projects
                </h1>
                <p className="font-bold text-base text-slate-500">
                    {projectsToShow.length} projects ready for scheduling
                </p>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex flex-col space-y-4 border-b border-gray-200 pb-4">
                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                    <span className="text-xs font-bold uppercase text-slate-500 mr-2">Filter By:</span>
                    {['ALL', Role.WRITER, Role.CMO, Role.CEO, Role.CINE, Role.EDITOR, Role.DESIGNER, Role.OPS, 'POSTED'].map((role) => (
                        <button
                            key={role}
                            onClick={() => setActiveRoleFilter(role as any)}
                            className={`px-3 py-1 text-xs font-black uppercase border-2 border-black transition-all ${activeRoleFilter === role
                                ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(100,100,100,1)]'
                                : 'bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {role === 'ALL' ? 'ALL' : role === 'POSTED' ? 'POSTED' : role === Role.SUB_EDITOR ? 'EDITOR' : role}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {projectsToShow.map(project => (
                    <div
                        key={project.id}
                        onClick={() => handleProjectClick(project.id)}
                        className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all group cursor-pointer h-full flex flex-col"
                    >
                        <div className="p-6 flex-grow space-y-4">
                            {/* Badges */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {project.data?.source === 'IDEA_PROJECT' && (
                                    <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                        {project.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                                    </span>
                                )}
                                <span
                                    className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black text-white ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F]' :
                                        project.channel === 'LINKEDIN' ? 'bg-[#0085FF]' :
                                            'bg-[#D946EF]'
                                        }`}
                                >
                                    {project.channel}
                                </span>
                                <span
                                    className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH' ? 'bg-red-500 text-white' :
                                        project.priority === 'NORMAL' ? 'bg-yellow-500 text-black' :
                                            'bg-green-500 text-white'
                                        }`}
                                >
                                    {project.priority}
                                </span>
                                <span
                                    className={`px-2 py-0.5 border-2 border-black text-[10px] font-black uppercase ${project.current_stage ? 'bg-slate-100 text-slate-800' : 'bg-gray-100 text-gray-800'}`}
                                >
                                    {project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'No Stage'}
                                </span>
                                <span
                                    className={`px-2 py-0.5 border-2 border-black text-[10px] font-black uppercase ${project.assigned_to_role ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                                >
                                    {project.assigned_to_role === 'SUB_EDITOR' ? 'EDITOR' : (project.assigned_to_role || 'Unassigned')}
                                </span>
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-black text-slate-900 uppercase leading-tight">{project.title}</h3>

                            {/* Info */}
                            <div className="flex flex-col border-t-2 border-slate-100 pt-3">
                                <div className="flex items-center text-xs font-bold text-slate-500 uppercase">
                                    By: {project.data?.writer_name || project.created_by_name || 'Unknown Writer'}
                                </div>
                                <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                                    Created: {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}
                                </div>
                                <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                                    Stage: {project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'N/A'}
                                </div>

                                {/* Show live URL for completed projects */}
                                {project.status === 'DONE' && project.data?.live_url && (
                                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-green-800 uppercase">Live URL</span>
                                            <a
                                                href={project.data.live_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-xs font-bold text-blue-600 hover:underline truncate max-w-[100px]"
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

                                {/* Show actual editor name */}
                                {(project.assigned_to_role === Role.EDITOR || project.assigned_to_role === Role.SUB_EDITOR) && (project.editor_name || project.sub_editor_name || project.data?.editor_name || project.data?.sub_editor_name) && (
                                    <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                                        Editor: {project.editor_name || project.sub_editor_name || project.data.editor_name || project.data.sub_editor_name}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons - All mapped to handleProjectClick */}
                        <div className="px-6 pb-6 flex space-x-3">
                            <button
                                className="flex-1 bg-[#D946EF] text-white py-2 px-4 font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#c039d0] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleProjectClick(project.id);
                                }}
                            >
                                View Details
                            </button>
                        </div>
                    </div>
                ))}

                {projectsToShow.length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-black p-12 text-center bg-slate-50">
                        <h3 className="text-xl font-black uppercase text-slate-400">
                            No projects found
                        </h3>
                        <p className="text-slate-500 mt-2">
                            {activeRoleFilter !== 'ALL' ? `No projects matching filter: ${activeRoleFilter}` : 'No CEO approved projects available'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OpsCeoApproved;