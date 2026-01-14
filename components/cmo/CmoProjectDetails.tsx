import React from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, TaskStatus, Channel } from '../../types';
import { format } from 'date-fns';
import { ArrowLeft, Video, Image as ImageIcon, Download } from 'lucide-react';

interface Props {
    project: Project;
    onBack: () => void;
}

const CmoProjectDetails: React.FC<Props> = ({ project, onBack }) => {
    const isVideo = project.channel !== Channel.LINKEDIN;

    const getRoleForStage = (stage: WorkflowStage): string => {
        const stageToRoleMap: Record<WorkflowStage, Role> = {
            [WorkflowStage.SCRIPT]: Role.WRITER,
            [WorkflowStage.SCRIPT_REVIEW_L1]: Role.CMO,
            [WorkflowStage.SCRIPT_REVIEW_L2]: Role.CEO,
            [WorkflowStage.CINEMATOGRAPHY]: Role.CINE,
            [WorkflowStage.VIDEO_EDITING]: Role.EDITOR,
            [WorkflowStage.THUMBNAIL_DESIGN]: Role.DESIGNER,
            [WorkflowStage.CREATIVE_DESIGN]: Role.DESIGNER,
            [WorkflowStage.FINAL_REVIEW_CMO]: Role.CMO,
            [WorkflowStage.FINAL_REVIEW_CEO]: Role.CEO,
            [WorkflowStage.OPS_SCHEDULING]: Role.OPS,
            [WorkflowStage.POSTED]: Role.OPS,
            [WorkflowStage.REWORK]: Role.WRITER
        };
        return stageToRoleMap[stage] || 'UNKNOWN';
    };

    const getMostRecentTimestampForStage = (currentStage: WorkflowStage): string => {
        if (!project.history || project.history.length === 0) {
            return format(new Date(project.created_at), 'MMM dd, yyyy h:mm a');
        }
        
        // Find the most recent history entry that matches the current stage
        const stageHistory = project.history
            .filter(h => h.stage === currentStage)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
        if (stageHistory.length > 0) {
            return format(new Date(stageHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
        }
        
        // If no exact match, return the project creation date
        return format(new Date(project.created_at), 'MMM dd, yyyy h:mm a');
    };

    const getMostRecentTimestampForRole = (currentRole: Role): string => {
        if (!project.history || project.history.length === 0) {
            return format(new Date(project.created_at), 'MMM dd, yyyy h:mm a');
        }
        
        // Find the most recent history entry where the project was assigned to the current role
        // This happens when the project moved to a stage associated with the role
        const allStages = Object.values(WorkflowStage);
        const roleStages = allStages.filter(stage => getRoleForStage(stage) === currentRole);
        
        const roleHistory = project.history
            .filter(h => roleStages.includes(h.stage))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        if (roleHistory.length > 0) {
            return format(new Date(roleHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
        }
        
        // If no specific role assignment found, return the most recent history entry
        const sortedHistory = [...project.history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return format(new Date(sortedHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
    };

    const getMostRecentTimestampForStatus = (currentStatus: TaskStatus): string => {
        if (!project.history || project.history.length === 0) {
            return format(new Date(project.created_at), 'MMM dd, yyyy h:mm a');
        }
        
        // Status changes typically happen with specific actions
        // We'll look for history entries that likely caused status changes
        let statusRelatedActions = [];
        
        if (currentStatus === 'WAITING_APPROVAL') {
            statusRelatedActions = ['SUBMITTED', 'APPROVED'];
        } else if (currentStatus === 'REJECTED') {
            statusRelatedActions = ['REJECTED'];
        } else if (currentStatus === 'REWORK') {
            statusRelatedActions = ['REWORK'];
        } else if (currentStatus === 'DONE') {
            statusRelatedActions = ['PUBLISHED'];
        }
        
        if (statusRelatedActions.length > 0) {
            const statusHistory = project.history
                .filter(h => statusRelatedActions.includes(h.action))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            if (statusHistory.length > 0) {
                return format(new Date(statusHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
            }
        }
        
        // If no specific status-related action found, return the most recent history entry
        const sortedHistory = [...project.history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return format(new Date(sortedHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
    };

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col">
            {/* Header */}
            <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
                <div className="flex items-center space-x-6">
                    <button onClick={onBack} className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all">
                        <ArrowLeft className="w-6 h-6 text-black" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                            {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative Details: ' : 
                             project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Idea Details: ' : 'Project Details: '}
                            {project.title}
                        </h1>
                        <div className="flex items-center space-x-2 mt-1">
                            {project.data?.source === 'IDEA_PROJECT' && (
                                <span className="px-2 py-0.5 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                    {'IDEA'}
                                </span>
                            )}
                            <span className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black text-white ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F]' :
                                project.channel === 'LINKEDIN' ? 'bg-[#0085FF]' :
                                    'bg-[#D946EF]'
                                }`}>
                                {project.channel}
                            </span>
                            <span className="text-xs font-bold uppercase text-slate-500">
                                Stage: {STAGE_LABELS[project.current_stage]}
                            </span>
                            <span
                                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                                    ? 'bg-red-500 text-white'
                                    : project.priority === 'NORMAL'
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-green-500 text-white'
                                    }`}
                            >
                                {project.priority}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row max-w-[1920px] mx-auto w-full">
                {/* LEFT COLUMN: Content (70%) */}
                <div className="flex-1 p-6 md:p-12 space-y-10 overflow-y-auto bg-slate-50">
                    {/* Info Block */}
                    <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Creator</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.writer_name || project.data?.writer_name || '—'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Priority</label>
                            <div className={`font-bold uppercase ${project.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                                {project.priority}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Status</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.status}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Type</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative' : 
                                 project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Idea' : 
                                 project.data?.source === 'IDEA_PROJECT' && project.data?.script_content ? 'Idea-to-Script' : 'Standard'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Assigned To</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.assigned_to_role}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Content Type</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.content_type}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Thumbnail Required</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.data?.thumbnail_required === undefined ? '—' : project.data.thumbnail_required ? 'Yes' : 'No'}
                            </div>
                        </div>
                        {project.data?.thumbnail_notes && (
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Thumbnail Notes</label>
                                <div className="font-bold text-slate-900 max-h-12 overflow-y-auto">
                                    {project.data.thumbnail_notes}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Brief Content */}
                    {project.data?.brief && (
                        <section className="space-y-4">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Brief / Notes</h3>
                            <div className="border-2 border-black bg-white p-8 min-h-[100px] whitespace-pre-wrap text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                {project.data.brief}
                            </div>
                        </section>
                    )}

                    {/* Script/Content Viewer */}
                    <section className="space-y-4">
                        <h3 className="text-2xl font-black text-slate-900 uppercase">
                            {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative Link' : 
                             project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Idea Description' : 
                             project.data?.source === 'IDEA_PROJECT' && project.data?.script_content ? 'Script Content' : 'Content'}
                        </h3>
                        
                        <div className="border-2 border-black bg-white p-8 min-h-[300px] whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            {project.data?.source === 'DESIGNER_INITIATED'
                                ? project.data?.creative_link || 'No creative link available.'
                                : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content
                                    ? project.data.idea_description
                                    : project.data?.script_content || 'No content available.'}
                        </div>
                    </section>

                    {/* History Section */}
                    {project.history && project.history.length > 0 && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Complete History</h3>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="border-2 border-black px-4 py-2 text-left font-black uppercase text-xs">Date & Time</th>
                                            <th className="border-2 border-black px-4 py-2 text-left font-black uppercase text-xs">Action</th>
                                            <th className="border-2 border-black px-4 py-2 text-left font-black uppercase text-xs">Actor</th>
                                            <th className="border-2 border-black px-4 py-2 text-left font-black uppercase text-xs">Stage</th>
                                            <th className="border-2 border-black px-4 py-2 text-left font-black uppercase text-xs">Responsible Role</th>
                                            <th className="border-2 border-black px-4 py-2 text-left font-black uppercase text-xs">Comment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...project.history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((history, index) => (
                                            <tr key={index} className="hover:bg-slate-50">
                                                <td className="border-2 border-black px-4 py-2 text-sm">
                                                    {format(new Date(history.timestamp), 'MMM dd, yyyy h:mm a')}
                                                </td>
                                                <td className="border-2 border-black px-4 py-2">
                                                    <span className={`px-2 py-1 text-xs font-black uppercase border-2 border-black ${
                                                        history.action === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                                        history.action === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                        history.action === 'REWORK' ? 'bg-yellow-100 text-yellow-800' :
                                                        history.action === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-slate-100 text-slate-800'
                                                    }`}>
                                                        {history.action}
                                                    </span>
                                                </td>
                                                <td className="border-2 border-black px-4 py-2 text-sm font-bold uppercase">
                                                    {history.actor_name}
                                                </td>
                                                <td className="border-2 border-black px-4 py-2 text-sm font-bold uppercase">
                                                    {history.stage ? STAGE_LABELS[history.stage as WorkflowStage] : 'N/A'}
                                                </td>
                                                <td className="border-2 border-black px-4 py-2 text-sm font-bold uppercase">
                                                    {history.stage ? getRoleForStage(history.stage as WorkflowStage) : 'N/A'}
                                                </td>
                                                <td className="border-2 border-black px-4 py-2 text-sm">
                                                    {history.comment || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* Assets Section */}
                    {(project.current_stage === WorkflowStage.FINAL_REVIEW_CMO || 
                      project.current_stage === WorkflowStage.CINEMATOGRAPHY || 
                      project.current_stage === WorkflowStage.VIDEO_EDITING ||
                      project.current_stage === WorkflowStage.THUMBNAIL_DESIGN ||
                      project.current_stage === WorkflowStage.CREATIVE_DESIGN) && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Production Assets</h3>

                            <div className="grid grid-cols-3 gap-6">
                                {/* Raw Video Asset */}
                                {isVideo && project.video_link && (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-black flex items-center justify-center text-white border-b-2 border-black">
                                            <Video className="w-16 h-16 opacity-50" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">Raw_Video.mp4</p>
                                                <p className="text-xs text-slate-500 font-bold">Original footage</p>
                                            </div>
                                            <a href={project.video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                        </div>
                                    </div>
                                )}

                                {/* Edited Video Asset */}
                                {isVideo && project.edited_video_link && (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-black flex items-center justify-center text-white border-b-2 border-black">
                                            <Video className="w-16 h-16 opacity-50" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">Edited_Video.mp4</p>
                                                <p className="text-xs text-slate-500 font-bold">1080p • 24mb</p>
                                            </div>
                                            <a href={project.edited_video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                        </div>
                                    </div>
                                )}

                                {/* Thumbnail/Creative Asset */}
                                {project.thumbnail_link ? (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 border-b-2 border-black">
                                            <ImageIcon className="w-16 h-16" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">Creative_Thumbnail.png</p>
                                                <p className="text-xs text-slate-500 font-bold">PNG • 2mb</p>
                                            </div>
                                            <a href={project.thumbnail_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                        </div>
                                    </div>
                                ) : project.data?.creative_link && (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 border-b-2 border-black">
                                            <ImageIcon className="w-16 h-16" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">Creative Link</p>
                                                <p className="text-xs text-slate-500 font-bold">External Link</p>
                                            </div>
                                            <a href={project.data.creative_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View Link</a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                {/* RIGHT COLUMN: Project Status Panel (30%) - Information only */}
                <div className="w-full md:w-[450px] bg-white border-l-2 border-black p-8 shadow-[-10px_0px_20px_rgba(0,0,0,0.05)] sticky bottom-0 md:top-20 md:h-[calc(100vh-80px)] overflow-y-auto z-10">
                    <h2 className="text-2xl font-black text-slate-900 uppercase mb-8 border-b-4 border-black pb-2 inline-block">Project Status</h2>

                    <div className="space-y-6">
                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Current Stage</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {STAGE_LABELS[project.current_stage]}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                                Stage set: {getMostRecentTimestampForStage(project.current_stage)}
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Assigned To</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {project.assigned_to_role}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                                Role assigned: {getMostRecentTimestampForRole(project.assigned_to_role)}
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Status</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {project.status}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                                Status updated: {getMostRecentTimestampForStatus(project.status)}
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Created</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CmoProjectDetails;