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
    const [activeRoleFilter, setActiveRoleFilter] = useState<'ALL' | 'WRITER' | 'CMO' | 'CEO' | 'CINE' | 'EDITOR' | 'DESIGNER' | 'OPS' | 'POSTED'>('ALL');

    // Base filter: only script projects with a CEO approval timestamp
    const scriptProjects = projects.filter(p =>
        !!p.ceo_approved_at && p.data?.source !== 'IDEA_PROJECT'
    );

    const projectsToShow = scriptProjects.filter(p => {
        const isCompleted = p.status === TaskStatus.DONE ||
            p.data?.live_url ||
            p.current_stage === WorkflowStage.POSTED;

        if (activeRoleFilter === 'ALL') {
            // Default "ALL" tab shows only active projects to match dashboard count
            return !isCompleted;
        }
        if (activeRoleFilter === 'POSTED') {
            return isCompleted;
        }
        return p.assigned_to_role === activeRoleFilter && !isCompleted;
    });

    const handleProjectClick = (projectId: string) => {
        // Navigate to the OpsCeoApprovedView page
        navigate(`/ops/ceo-approved-view/${projectId}`);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="border-b-2 border-black pb-4">
                <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">
                    CEO Approved Projects
                </h1>
                <p className="font-bold text-base text-slate-500">
                    {projectsToShow.length} script projects ready for scheduling
                </p>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex flex-wrap gap-2 py-4 border-b border-gray-200">
                <span className="text-sm font-bold text-slate-700 uppercase mr-2 pt-2">Filter by role:</span>
                {[
                    { key: 'ALL', label: 'All', color: 'bg-gray-500' },
                    { key: 'WRITER', label: 'Writer', color: 'bg-blue-500' },
                    { key: 'CMO', label: 'CMO', color: 'bg-orange-500' },
                    { key: 'CEO', label: 'CEO', color: 'bg-red-600' },
                    { key: 'CINE', label: 'Cine', color: 'bg-yellow-500' },
                    { key: 'EDITOR', label: 'Editor', color: 'bg-purple-500' },
                    { key: 'DESIGNER', label: 'Designer', color: 'bg-pink-500' },
                    { key: 'OPS', label: 'Ops', color: 'bg-green-600' },
                    { key: 'POSTED', label: 'Posted', color: 'bg-emerald-600' }
                ].map(filter => (
                    <button
                        key={filter.key}
                        onClick={() => setActiveRoleFilter(filter.key as any)}
                        className={`px-3 py-1 text-xs font-black uppercase border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${activeRoleFilter === filter.key
                                ? `${filter.color} text-white`
                                : 'bg-white text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        {filter.label} ({
                            filter.key === 'ALL' ? scriptProjects.length :
                                filter.key === 'POSTED' ?
                                    scriptProjects.filter(p => p.status === TaskStatus.DONE || p.data?.live_url || p.current_stage === WorkflowStage.POSTED).length :
                                    scriptProjects.filter(p => p.assigned_to_role === filter.key).length
                        })
                    </button>
                ))}
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
                            {activeRoleFilter !== 'ALL' ? `No projects found for ${activeRoleFilter.toLowerCase()} role` : 'No CEO approved script projects available'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OpsCeoApproved;