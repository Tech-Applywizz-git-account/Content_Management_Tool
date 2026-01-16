import React, { useEffect, useState } from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, TaskStatus, Channel } from '../../types';
import { format } from 'date-fns';
import { ArrowLeft, Video, Image as ImageIcon, Download } from 'lucide-react';
import Timeline from '../../components/Timeline';
import { db } from '../../services/supabaseDb';

interface Props {
    project: Project;
    onBack: () => void;
}

const CmoProjectDetails: React.FC<Props> = ({ project, onBack }) => {
    const [users, setUsers] = useState<any[]>([]);
    const [fullProject, setFullProject] = useState<Project>(project);
    const [assignedUserName, setAssignedUserName] = useState<string | undefined>(undefined);

    useEffect(() => {
        // Fetch full project details including history
        const fetchFullProject = async () => {
            try {
                const fullProjectData = await db.getProjectById(project.id);
                if (fullProjectData) {
                    setFullProject(fullProjectData);
                }
            } catch (error) {
                console.error('Failed to fetch full project details:', error);
                // Fallback to the original project if full fetch fails
                setFullProject(project);
            }
        };
        
        fetchFullProject();
        
        const fetchUsers = async () => {
            try {
                const usersData = await db.getUsers();
                setUsers(usersData);
                
                // Find the assigned user name based on assigned_to_user_id
                if (project.assigned_to_user_id) {
                    const assignedUser = usersData.find(user => user.id === project.assigned_to_user_id);
                    if (assignedUser) {
                        setAssignedUserName(assignedUser.full_name);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch users:', error);
            }
        };
        
        fetchUsers();
    }, [project]);
    
    // Update assigned user name when fullProject changes
    useEffect(() => {
        if (fullProject.assigned_to_user_id && users.length > 0) {
            const assignedUser = users.find(user => user.id === fullProject.assigned_to_user_id);
            if (assignedUser) {
                setAssignedUserName(assignedUser.full_name);
            }
        }
    }, [fullProject, users]);
    const isVideo = fullProject.channel !== Channel.LINKEDIN;

    const getRoleForStage = (stage: WorkflowStage): string => {
        const stageToRoleMap: Record<WorkflowStage, Role> = {
            [WorkflowStage.SCRIPT]: Role.WRITER,
            [WorkflowStage.SCRIPT_REVIEW_L1]: Role.CMO,
            [WorkflowStage.SCRIPT_REVIEW_L2]: Role.CEO,
            [WorkflowStage.CINEMATOGRAPHY]: Role.CINE,
            [WorkflowStage.VIDEO_EDITING]: Role.EDITOR,
            [WorkflowStage.SUB_EDITOR_ASSIGNMENT]: Role.EDITOR,
            [WorkflowStage.SUB_EDITOR_PROCESSING]: Role.SUB_EDITOR,
            [WorkflowStage.THUMBNAIL_DESIGN]: Role.DESIGNER,
            [WorkflowStage.CREATIVE_DESIGN]: Role.DESIGNER,
            [WorkflowStage.FINAL_REVIEW_CMO]: Role.CMO,
            [WorkflowStage.FINAL_REVIEW_CEO]: Role.CEO,
            [WorkflowStage.FINAL_REVIEW_CEO_POST_APPROVAL]: Role.CEO,
            [WorkflowStage.WRITER_VIDEO_APPROVAL]: Role.WRITER,
            [WorkflowStage.MULTI_WRITER_APPROVAL]: Role.WRITER,
            [WorkflowStage.POST_WRITER_REVIEW]: Role.CMO,
            [WorkflowStage.OPS_SCHEDULING]: Role.OPS,
            [WorkflowStage.POSTED]: Role.OPS,
            [WorkflowStage.REWORK]: Role.WRITER
        };
        return stageToRoleMap[stage] || 'UNKNOWN';
    };

    const getMostRecentTimestampForStage = (currentStage: WorkflowStage): string => {
        if (!fullProject.history || fullProject.history.length === 0) {
            return format(new Date(fullProject.created_at), 'MMM dd, yyyy h:mm a');
        }
        
        // Find the most recent history entry that matches the current stage
        const stageHistory = fullProject.history
            .filter(h => h.stage === currentStage)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
        if (stageHistory.length > 0) {
            return format(new Date(stageHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
        }
        
        // If no exact match, return the project creation date
        return format(new Date(fullProject.created_at), 'MMM dd, yyyy h:mm a');
    };

    const getMostRecentTimestampForRole = (currentRole: Role): string => {
        if (!fullProject.history || fullProject.history.length === 0) {
            return format(new Date(fullProject.created_at), 'MMM dd, yyyy h:mm a');
        }
        
        // Find the most recent history entry where the project was assigned to the current role
        // This happens when the project moved to a stage associated with the role
        const allStages = Object.values(WorkflowStage);
        const roleStages = allStages.filter(stage => getRoleForStage(stage) === currentRole);
        
        const roleHistory = fullProject.history
            .filter(h => roleStages.includes(h.stage))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        if (roleHistory.length > 0) {
            return format(new Date(roleHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
        }
        
        // If no specific role assignment found, return the most recent history entry
        const sortedHistory = [...fullProject.history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return format(new Date(sortedHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
    };

    const getMostRecentTimestampForStatus = (currentStatus: TaskStatus): string => {
        if (!fullProject.history || fullProject.history.length === 0) {
            return format(new Date(fullProject.created_at), 'MMM dd, yyyy h:mm a');
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
            const statusHistory = fullProject.history
                .filter(h => statusRelatedActions.includes(h.action))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            if (statusHistory.length > 0) {
                return format(new Date(statusHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
            }
        }
        
        // If no specific status-related action found, return the most recent history entry
        const sortedHistory = [...fullProject.history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
                            {fullProject.data?.source === 'DESIGNER_INITIATED' ? 'Creative Details: ' : 
                             fullProject.data?.source === 'IDEA_PROJECT' && !fullProject.data?.script_content ? 'Idea Details: ' : 'Project Details: '}
                            {fullProject.title}
                        </h1>
                        <div className="flex items-center space-x-2 mt-1">
                            {fullProject.data?.source === 'IDEA_PROJECT' && (
                                <span className="px-2 py-0.5 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                    {fullProject.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                                </span>
                            )}
                            <span className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black text-white ${fullProject.channel === 'YOUTUBE' ? 'bg-[#FF4F4F]' :
                                fullProject.channel === 'LINKEDIN' ? 'bg-[#0085FF]' :
                                    'bg-[#D946EF]'
                                }`}>
                                {fullProject.channel}
                            </span>
                            <span className="text-xs font-bold uppercase text-slate-500">
                                Stage: {STAGE_LABELS[fullProject.current_stage]}
                            </span>
                            <span
                                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${fullProject.priority === 'HIGH'
                                    ? 'bg-red-500 text-white'
                                    : fullProject.priority === 'NORMAL'
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-green-500 text-white'
                                    }`}
                            >
                                {fullProject.priority}
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
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">
                                Writer
                            </label>
                            <div className="font-bold text-slate-900 uppercase">
                                {fullProject.writer_name || '—'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Priority</label>
                            <div className={`font-bold uppercase ${fullProject.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                                {fullProject.priority}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Status</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {fullProject.status}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Type</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {fullProject.data?.source === 'DESIGNER_INITIATED' ? 'Creative' : 
                                 fullProject.data?.source === 'IDEA_PROJECT' && !fullProject.data?.script_content ? 'Idea' : 
                                 fullProject.data?.source === 'IDEA_PROJECT' && fullProject.data?.script_content ? 'Idea-to-Script' : 'Standard'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Assigned To</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {fullProject.assigned_to_role}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Assigned User</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {assignedUserName || fullProject.assigned_to_user_id ? assignedUserName : '—'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Content Type</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {fullProject.content_type}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Thumbnail Required</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {fullProject.data?.thumbnail_required === undefined ? '—' : fullProject.data.thumbnail_required ? 'Yes' : 'No'}
                            </div>
                        </div>
                        {fullProject.data?.thumbnail_notes && (
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Thumbnail Notes</label>
                                <div className="font-bold text-slate-900 max-h-12 overflow-y-auto">
                                    {fullProject.data.thumbnail_notes}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Brief Content */}
                    {fullProject.data?.brief && (
                        <section className="space-y-4">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Brief / Notes</h3>
                            <div className="border-2 border-black bg-white p-8 min-h-[100px] whitespace-pre-wrap text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                {fullProject.data.brief}
                            </div>
                        </section>
                    )}

                    {/* Script/Content Viewer */}
                    <section className="space-y-4">
                        <h3 className="text-2xl font-black text-slate-900 uppercase">
                            {fullProject.data?.source === 'DESIGNER_INITIATED' ? 'Creative Link' : 
                             fullProject.data?.source === 'IDEA_PROJECT' && !fullProject.data?.script_content ? 'Idea Description' : 
                             fullProject.data?.source === 'IDEA_PROJECT' && fullProject.data?.script_content ? 'Script Content' : 'Content'}
                        </h3>
                        
                        <div className="border-2 border-black bg-white p-8 min-h-[300px] whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            {fullProject.data?.source === 'DESIGNER_INITIATED'
                                ? fullProject.data?.creative_link || 'No creative link available.'
                                : fullProject.data?.source === 'IDEA_PROJECT' && !fullProject.data?.script_content
                                    ? fullProject.data.idea_description
                                    : fullProject.data?.script_content || 'No content available.'}
                        </div>
                    </section>

                    {/* Timeline intentionally omitted for main dashboard projects */}
                    {/* Timeline only appears in CMO Overview page as per requirements */}

                    {/* Assets Section */}
                    {(fullProject.current_stage === WorkflowStage.FINAL_REVIEW_CMO || 
                      fullProject.current_stage === WorkflowStage.CINEMATOGRAPHY || 
                      fullProject.current_stage === WorkflowStage.VIDEO_EDITING ||
                      fullProject.current_stage === WorkflowStage.THUMBNAIL_DESIGN ||
                      fullProject.current_stage === WorkflowStage.CREATIVE_DESIGN) && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Production Assets</h3>

                            <div className="grid grid-cols-3 gap-6">
                                {/* Raw Video Asset */}
                                {isVideo && fullProject.video_link && (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-black flex items-center justify-center text-white border-b-2 border-black">
                                            <Video className="w-16 h-16 opacity-50" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">Raw_Video.mp4</p>
                                                <p className="text-xs text-slate-500 font-bold">Original footage</p>
                                            </div>
                                            <a href={fullProject.video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                        </div>
                                    </div>
                                )}

                                {/* Edited Video Asset */}
                                {isVideo && fullProject.edited_video_link && (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-black flex items-center justify-center text-white border-b-2 border-black">
                                            <Video className="w-16 h-16 opacity-50" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">Edited_Video.mp4</p>
                                                <p className="text-xs text-slate-500 font-bold">1080p • 24mb</p>
                                            </div>
                                            <a href={fullProject.edited_video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                        </div>
                                    </div>
                                )}

                                {/* Thumbnail/Creative Asset */}
                                {fullProject.thumbnail_link ? (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 border-b-2 border-black">
                                            <ImageIcon className="w-16 h-16" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">Creative_Thumbnail.png</p>
                                                <p className="text-xs text-slate-500 font-bold">PNG • 2mb</p>
                                            </div>
                                            <a href={fullProject.thumbnail_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                        </div>
                                    </div>
                                ) : fullProject.data?.creative_link && (
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 border-b-2 border-black">
                                            <ImageIcon className="w-16 h-16" />
                                        </div>
                                        <div className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">Creative Link</p>
                                                <p className="text-xs text-slate-500 font-bold">External Link</p>
                                            </div>
                                            <a href={fullProject.data.creative_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View Link</a>
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
                                        {STAGE_LABELS[fullProject.current_stage]}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                                Stage set: {getMostRecentTimestampForStage(fullProject.current_stage)}
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Assigned To</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {fullProject.assigned_to_role}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                                Role assigned: {getMostRecentTimestampForRole(fullProject.assigned_to_role)}
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Status</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {fullProject.status}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                                Status updated: {getMostRecentTimestampForStatus(fullProject.status)}
                            </div>
                        </div>

                        <div className="p-6 border-2 border-black bg-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-black text-lg uppercase text-slate-900">Created</div>
                                    <div className="text-xs font-bold uppercase text-slate-600">
                                        {format(new Date(fullProject.created_at), 'MMM dd, yyyy h:mm a')}
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