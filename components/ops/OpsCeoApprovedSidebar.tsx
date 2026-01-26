import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, WorkflowStage, TaskStatus, Role } from '../../types';
import { format } from 'date-fns';

interface Props {
    projects: Project[];
    currentProjectId?: string;
    onSelectProject: (projectId: string) => void;
    onBack: () => void;
}

const OpsCeoApprovedSidebar: React.FC<Props> = ({ 
    projects, 
    currentProjectId, 
    onSelectProject, 
    onBack 
}) => {
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

    return (
        <div className="flex h-full max-h-screen">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r-2 border-black flex flex-col">
                {/* Header */}
                <div className="p-4 border-b-2 border-black">
                    <button 
                        onClick={onBack}
                        className="flex items-center text-sm font-black text-slate-700 hover:text-slate-900 py-2 px-4 bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all mb-4"
                    >
                        ← Back to CEO Approved
                    </button>
                    
                    <h2 className="text-xl font-black uppercase text-slate-900 mb-4">
                        CEO Approved Projects
                    </h2>
                    
                    <div className="text-sm font-bold text-slate-500 mb-4">
                        {projectsToShow.length} projects ready for scheduling
                    </div>
                </div>

                {/* Role Filter Tabs */}
                <div className="border-b border-gray-200 p-4">
                    <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-1 overflow-x-auto pb-1">
                            <span className="text-xs font-bold uppercase text-slate-500 mr-2">Filter By:</span>
                            {['ALL', Role.WRITER, Role.CMO, Role.CEO, Role.CINE, Role.EDITOR, Role.DESIGNER, Role.OPS, 'POSTED'].map((role) => (
                                <button
                                    key={role}
                                    onClick={() => setActiveRoleFilter(role as any)}
                                    className={`px-2 py-1 text-xs font-black uppercase border border-black transition-all ${activeRoleFilter === role
                                        ? 'bg-black text-white shadow-[1px_1px_0px_0px_rgba(100,100,100,1)]'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {role === 'ALL' ? 'ALL' : role === 'POSTED' ? 'POSTED' : role === Role.SUB_EDITOR ? 'EDITOR' : role}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Project List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {projectsToShow.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-sm">
                            No projects found
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {projectsToShow.map(project => (
                                <div
                                    key={project.id}
                                    onClick={() => onSelectProject(project.id)}
                                    className={`p-3 border-2 border-black cursor-pointer transition-all ${
                                        currentProjectId === project.id 
                                            ? 'bg-blue-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                                            : 'bg-white hover:bg-slate-50 hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-sm text-slate-900 uppercase truncate">
                                                {project.title}
                                            </h4>
                                            
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                <span 
                                                    className={`px-1.5 py-0.5 text-[9px] font-black uppercase border border-black ${
                                                        project.priority === 'HIGH' ? 'bg-red-500 text-white' :
                                                        project.priority === 'NORMAL' ? 'bg-yellow-500 text-black' :
                                                        'bg-green-500 text-white'
                                                    }`}
                                                >
                                                    {project.priority}
                                                </span>
                                                
                                                <span 
                                                    className={`px-1.5 py-0.5 text-[9px] font-black uppercase border border-black ${
                                                        project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                                        project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                                        'bg-[#D946EF] text-white'
                                                    }`}
                                                >
                                                    {project.channel}
                                                </span>
                                                
                                                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase border border-black bg-slate-100 text-slate-800">
                                                    {project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'No Stage'}
                                                </span>
                                            </div>
                                            
                                            <div className="mt-1">
                                                <div className="text-xs text-slate-600 truncate">
                                                    By: {project.data?.writer_name || project.created_by_name || 'Unknown Writer'}
                                                </div>
                                                <div className="text-xs text-slate-600">
                                                    {format(new Date(project.created_at), 'MMM dd, yyyy')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area - Will be filled by parent component */}
            <div className="flex-1 overflow-auto">
                {/* This area will be populated by the parent component with project details */}
            </div>
        </div>
    );
};

export default OpsCeoApprovedSidebar;