import React, { useEffect, useState } from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, Channel, TaskStatus } from '../../types';
import { format } from 'date-fns';
import { ArrowLeft, Video, Image as ImageIcon, MessageSquare, Clock, CheckCircle, AlertTriangle, FileText, Palette, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { decodeHtmlEntities } from '../../utils/htmlDecoder';
import Timeline from '../../components/Timeline';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';

// Helper function to format date to DD-MM-YYYY
const formatDateDDMMYYYY = (dateString: string | undefined): string => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is zero-indexed
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString; // Return original if parsing fails
    }
};

interface Props {
    project: Project;
    onBack: () => void;
}

const CmoProjectDetails: React.FC<Props> = ({ project, onBack }) => {
    const [users, setUsers] = useState<any[]>([]);
    const [fullProject, setFullProject] = useState<Project>(project);
    const [assignedUserName, setAssignedUserName] = useState<string | undefined>(undefined);
    const [editorName, setEditorName] = useState<string | undefined>(undefined);
    const [comments, setComments] = useState<any[]>([]);

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

    // Update assigned user name, writer name, and editor name when fullProject changes
    useEffect(() => {
        if (fullProject.assigned_to_user_id && users.length > 0) {
            const assignedUser = users.find(user => user.id === fullProject.assigned_to_user_id);
            if (assignedUser) {
                setAssignedUserName(assignedUser.full_name);
            }
        }

        // Fetch writer name if writer_id is available but writer_name is not
        if (fullProject.writer_id && !fullProject.writer_name && users.length > 0) {
            const writerUser = users.find(user => user.id === fullProject.writer_id);
            if (writerUser) {
                // Update the fullProject state to include the writer name
                setFullProject(prev => ({
                    ...prev,
                    writer_name: writerUser.full_name
                }));
            }
        }

        // Fetch editor name based on editor_user_id from project data if available
        if (fullProject.data?.editor_user_id && users.length > 0) {
            const editorUser = users.find(user => user.id === fullProject.data.editor_user_id);
            if (editorUser) {
                setEditorName(editorUser.full_name);
            }
        } else if (fullProject.editor_user_id && users.length > 0) {
            // Check if editor_user_id exists directly on the project object
            const editorUser = users.find(user => user.id === fullProject.editor_user_id);
            if (editorUser) {
                setEditorName(editorUser.full_name);
            }
        } else {
            // If no user ID is available, try to set the editor name directly from the project if it's already available
            if (fullProject.editor_name) {
                setEditorName(fullProject.editor_name);
            }
        }
    }, [fullProject, users]);

    // Fetch comments
    useEffect(() => {
        const fetchComments = async () => {
            const { data: allHistoryData, error: historyError } = await supabase
                .from('workflow_history')
                .select(`
action,
    comment,
    actor_name,
    actor_id,
    timestamp,
    stage
        `)
                .eq('project_id', fullProject.id)
                .order('timestamp', { ascending: false });

            if (historyError) {
                console.error('Error fetching workflow history:', historyError);
                setComments([]);
                return;
            }

            // Filter to only show approved actions for most stages, but include writer submissions, multi-writer approvals, and date-setting actions
            const commentsData = allHistoryData.filter(item => {
                // Always include APPROVED, REWORK, and REJECTED actions
                if (['APPROVED', 'REWORK', 'REJECTED'].includes(item.action)) {
                    return true;
                }

                // Include SUBMITTED actions specifically for SCRIPT stage (writer submissions)
                if (item.stage === 'SCRIPT' && item.action === 'SUBMITTED') {
                    return true;
                }

                // Include APPROVED and SUBMITTED actions for MULTI_WRITER_APPROVAL stage (writer approvals)
                if (item.stage === 'MULTI_WRITER_APPROVAL' && ['APPROVED', 'SUBMITTED'].includes(item.action)) {
                    return true;
                }

                // Include SET_SHOOT_DATE and SET_DELIVERY_DATE actions
                if (item.action === 'SET_SHOOT_DATE' || item.action === 'SET_DELIVERY_DATE') {
                    return true;
                }

                // Only include APPROVED actions for CINEMATOGRAPHY, VIDEO_EDITING, SUB_EDITOR_PROCESSING, THUMBNAIL_DESIGN, and SUB_EDITOR_ASSIGNMENT stages
                // This ensures we only see the approved versions, not all submitted uploads or assignments
                if (['CINEMATOGRAPHY', 'VIDEO_EDITING', 'SUB_EDITOR_PROCESSING', 'THUMBNAIL_DESIGN', 'SUB_EDITOR_ASSIGNMENT'].includes(item.stage) && item.action === 'APPROVED') {
                    return true;
                }

                // For other stages, only include specific approved-type actions
                return false;
            });

            // Filter out 'CREATED' actions and remove duplicates
            const filteredComments = commentsData?.filter(comment => comment.action !== 'CREATED') || [];

            // Track if we've already added certain repeated events
            let multiWriterSubmittedAdded = false;
            let deliveryDateSetAdded = false;
            let shootDateSetAdded = false;

            // Create a map to track unique events by their meaningful content
            const uniqueEventsMap = new Map();

            filteredComments.forEach(comment => {
                let uniqueKey;

                // Create a key based on the type of action and its content
                if (comment.action === 'SET_SHOOT_DATE') {
                    if (shootDateSetAdded) {
                        return; // Skip duplicate shoot date events
                    }
                    shootDateSetAdded = true;
                    uniqueKey = 'SHOOT_DATE_SET';
                } else if (comment.action === 'SET_DELIVERY_DATE') {
                    if (deliveryDateSetAdded) {
                        return; // Skip duplicate delivery date events
                    }
                    deliveryDateSetAdded = true;
                    uniqueKey = 'DELIVERY_DATE_SET';
                } else if (comment.action === 'SUBMITTED' && comment.comment) {
                    if (comment.stage === 'MULTI_WRITER_APPROVAL') {
                        // For MULTI_WRITER_APPROVAL SUBMITTED, check if it's the "All writers have approved" message
                        if (comment.comment.includes('All writers have approved')) {
                            if (multiWriterSubmittedAdded) {
                                return; // Skip duplicate "All writers have approved" events
                            }
                            multiWriterSubmittedAdded = true;
                            uniqueKey = 'MULTI_WRITER_APPROVAL_SUBMITTED_ALL_WRITERS'; // Fixed key for this specific event
                        } else {
                            // For other MULTI_WRITER_APPROVAL submissions, use actor-specific key
                            uniqueKey = `${comment.action} -${comment.stage} -${comment.actor_id || comment.actor_name} -${comment.timestamp} -${comment.comment || ''} `;
                        }
                    } else if (comment.comment.includes('Project assigned to sub-editor')) {
                        uniqueKey = 'PROJECT_ASSIGNED_TO_SUBEDITOR';
                    } else if (comment.comment.includes('Raw video uploaded')) {
                        uniqueKey = 'RAW_VIDEO_UPLOADED';
                    } else if (comment.comment.includes('Edited video uploaded')) {
                        uniqueKey = 'EDITED_VIDEO_UPLOADED';
                    } else {
                        // For other submitted actions, use action + stage + partial comment
                        uniqueKey = `${comment.action} -${comment.stage} -${comment.comment.substring(0, 30)} `;
                    }
                } else if (comment.action === 'APPROVED' && comment.comment) {
                    if (comment.stage === 'MULTI_WRITER_APPROVAL') {
                        // For MULTI_WRITER_APPROVAL, each approval should be unique (each writer approval)
                        // Include the comment content to differentiate between similar events
                        uniqueKey = `${comment.action} -${comment.stage} -${comment.actor_id || comment.actor_name} -${comment.timestamp} -${comment.comment || ''} `;
                    } else if (comment.comment.includes('Project assigned to sub-editor')) {
                        uniqueKey = 'PROJECT_ASSIGNED_TO_SUBEDITOR_APPROVED';
                    } else {
                        uniqueKey = `${comment.action} -${comment.stage} -${comment.comment.substring(0, 30)} `;
                    }
                } else {
                    // For other actions, combine action, stage, and a portion of comment if available
                    uniqueKey = `${comment.action} -${comment.stage} -${comment.comment ? comment.comment.substring(0, 30) : ''} `;
                }

                // Only add the first occurrence of each unique event (latest due to reverse chronological order)
                if (!uniqueEventsMap.has(uniqueKey)) {
                    uniqueEventsMap.set(uniqueKey, comment);
                }
            });

            // Convert map values back to array and sort by timestamp (most recent first)
            const uniqueComments = Array.from(uniqueEventsMap.values())
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setComments(uniqueComments);
        };

        fetchComments();
    }, [fullProject.id]);
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

        // Special handling for CMO role - if current stage is FINAL_REVIEW_CMO, show that timestamp
        if (currentRole === Role.CMO && fullProject.current_stage === WorkflowStage.FINAL_REVIEW_CMO) {
            const finalReviewHistory = fullProject.history
                .filter(h => h.stage === WorkflowStage.FINAL_REVIEW_CMO)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            if (finalReviewHistory.length > 0) {
                return format(new Date(finalReviewHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
            }
        }

        // Find the FIRST history entry where the project was assigned to the current role
        // This happens when the project moved to a stage associated with the role
        const allStages = Object.values(WorkflowStage);
        const roleStages = allStages.filter(stage => getRoleForStage(stage) === currentRole);

        const roleHistory = fullProject.history
            .filter(h => roleStages.includes(h.stage))
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); // Ascending order to get the first occurrence

        if (roleHistory.length > 0) {
            return format(new Date(roleHistory[0].timestamp), 'MMM dd, yyyy h:mm a');
        }

        // If no specific role assignment found, return the project creation date
        return format(new Date(fullProject.created_at), 'MMM dd, yyyy h:mm a');
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



                        <div className="flex items-center space-x-2 mt-2">
                            {fullProject.data?.source === 'IDEA_PROJECT' && (
                                <span className="px-2 py-0.5 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                    {fullProject.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                                </span>
                            )}
                            <span className={`px - 2 py - 0.5 text - xs font - black uppercase border - 2 border - black text - white ${fullProject.channel === 'YOUTUBE' ? 'bg-[#FF4F4F]' :
                                fullProject.channel === 'LINKEDIN' ? 'bg-[#0085FF]' :
                                    'bg-[#D946EF]'
                                } `}>
                                {fullProject.channel}
                            </span>
                            <span className="text-xs font-bold uppercase text-slate-500">
                                Stage: {STAGE_LABELS[fullProject.current_stage]}
                            </span>
                            <span
                                className={`px - 2 py - 0.5 text - [10px] font - black uppercase border - 2 border - black ${fullProject.priority === 'HIGH'
                                    ? 'bg-red-500 text-white'
                                    : fullProject.priority === 'NORMAL'
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-green-500 text-white'
                                    } `}
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
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Priority</label>
                            <div className={`font - bold uppercase ${fullProject.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'} `}>
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

                        <div className="border-2 border-black bg-white p-8 min-h-[300px] font-serif text-lg leading-relaxed text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-x-auto">
                            {fullProject.data?.source === 'DESIGNER_INITIATED'
                                ? fullProject.data?.creative_link || 'No creative link available.'
                                : fullProject.data?.source === 'IDEA_PROJECT' && !fullProject.data?.script_content
                                    ? <div dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(fullProject.data.idea_description) }} />
                                    : fullProject.data?.script_content
                                        ? <div dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(fullProject.data.script_content) }} />
                                        : 'No content available.'}
                        </div>
                    </section>

                    {/* Comments & Feedback Section */}
                    {(comments.length > 0) && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <div className="flex items-center space-x-2 mb-4">
                                <MessageSquare className="w-6 h-6" />
                                <h3 className="text-2xl font-black uppercase text-slate-900">Comments & Feedback</h3>
                            </div>

                            {/* Display current project dates if they exist */}
                            {(fullProject?.shoot_date || fullProject?.delivery_date || fullProject?.post_scheduled_date) && (
                                <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {fullProject?.shoot_date && (
                                            <div className="flex items-center">
                                                <span className="mr-2 font-bold text-slate-700">📅 Shoot Date:</span>
                                                <span className="font-bold text-green-600">{formatDateDDMMYYYY(fullProject.shoot_date)}</span>
                                            </div>
                                        )}
                                        {fullProject?.delivery_date && (
                                            <div className="flex items-center">
                                                <span className="mr-2 font-bold text-slate-700">📦 Delivery Date:</span>
                                                <span className="font-bold text-blue-600">{formatDateDDMMYYYY(fullProject.delivery_date)}</span>
                                            </div>
                                        )}
                                        {fullProject?.post_scheduled_date && (
                                            <div className="flex items-center">
                                                <span className="mr-2 font-bold text-slate-700">🗓️ Post Date:</span>
                                                <span className="font-bold text-purple-600">{formatDateDDMMYYYY(fullProject.post_scheduled_date)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Display forwarded comments from CEO */}
                            {fullProject?.forwarded_comments && fullProject.forwarded_comments.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="text-lg font-black uppercase mb-3 text-slate-700 border-l-4 border-blue-500 pl-3">
                                        Forwarded Comments from CEO
                                    </h4>
                                    <div className="space-y-3 ml-2">
                                        {fullProject.forwarded_comments
                                            .filter(comment => comment.from_role === 'CEO')
                                            .map((comment, index) => {
                                                const timestamp = new Date(comment.created_at).toLocaleString();

                                                return (
                                                    <div key={`forwarded - ${comment.id || index} `} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                        <div className="flex items-center mb-1">
                                                            <span className="font-bold text-blue-800">CEO Comment</span>
                                                            <span className="mx-2 text-slate-400">•</span>
                                                            <span className="text-sm text-slate-500">{timestamp}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-1 text-xs font-black uppercase border-2 border-black bg-blue-500 text-white">
                                                                {comment.action}
                                                            </span>
                                                            <span className="font-medium text-slate-800">{comment.comment}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {comments.length > 0 ? (
                                <div className="space-y-6 bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    {comments.map((comment, index) => {
                                        // Determine the description based on stage and action
                                        let description = `${comment.action} in ${comment.stage} `;

                                        switch (comment.stage) {
                                            case 'SCRIPT':
                                                if (comment.action === 'SUBMITTED') {
                                                    description = 'Project submitted by writer';
                                                }
                                                break;
                                            case 'SCRIPT_REVIEW_L1':
                                                if (comment.action === 'APPROVED') {
                                                    description = 'Project approved by CMO';
                                                } else if (comment.action === 'REWORK') {
                                                    description = 'CMO requested rework';
                                                }
                                                break;
                                            case 'FINAL_REVIEW_CMO':
                                                if (comment.action === 'APPROVED') {
                                                    description = 'Project approved by CMO';
                                                } else if (comment.action === 'REWORK') {
                                                    description = 'CMO requested rework';
                                                }
                                                break;
                                            case 'FINAL_REVIEW_CEO':
                                                if (comment.action === 'APPROVED') {
                                                    description = 'Project approved by CEO';
                                                } else if (comment.action === 'REWORK') {
                                                    description = 'CEO requested rework';
                                                }
                                                break;
                                            case 'MULTI_WRITER_APPROVAL':
                                                if (comment.action === 'APPROVED') {
                                                    description = 'Writer approved the final video';
                                                } else if (comment.action === 'SUBMITTED') {
                                                    description = 'All writers have approved - Project advanced to CMO for final review';
                                                }
                                                break;
                                            case 'CINEMATOGRAPHY':
                                                if (comment.action === 'SUBMITTED') {
                                                    description = 'Raw video uploaded by cinematographer';
                                                }
                                                break;
                                            case 'VIDEO_EDITING':
                                                if (comment.action === 'SUBMITTED') {
                                                    description = 'Edited video uploaded by editor';
                                                }
                                                break;
                                            case 'SUB_EDITOR_PROCESSING':
                                                if (comment.action === 'SUBMITTED') {
                                                    description = 'Edited video uploaded by sub-editor';
                                                } else if (comment.action === 'APPROVED') {
                                                    description = 'Sub-editor completed processing';
                                                }
                                                break;
                                            case 'THUMBNAIL_DESIGN':
                                                if (comment.action === 'SUBMITTED') {
                                                    description = 'Assets uploaded by designer';
                                                }
                                                break;
                                            default:
                                                // Handle special actions that might not have a specific stage mapping
                                                if (comment.action === 'SET_SHOOT_DATE') {
                                                    description = 'Shoot date set';
                                                } else if (comment.action === 'SET_DELIVERY_DATE') {
                                                    description = 'Delivery date set';
                                                } else if (comment.action === 'REWORK_VIDEO_SUBMITTED') {
                                                    description = 'Rework video uploaded';
                                                } else if (comment.action === 'SUB_EDITOR_ASSIGNED') {
                                                    description = 'Project assigned to sub-editor';
                                                } else {
                                                    description = `${comment.action} in ${comment.stage} `;
                                                }
                                        }

                                        return (
                                            <div key={`${comment.stage} -${comment.action} -${comment.timestamp} -${comment.actor_id || comment.actor_name} `} className={`border - l - 4 pl - 4 py - 2 ${comment.action === 'APPROVED' ? 'border-green-500' : comment.action === 'REWORK' ? 'border-yellow-500' : 'border-red-500'} `}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-bold text-slate-900">{comment.actor_name}</p>
                                                        <p className="text-sm text-slate-600">{format(new Date(comment.timestamp), 'MMM dd, yyyy h:mm a')}</p>
                                                    </div>
                                                    <span className={`px - 2 py - 1 text - xs font - bold uppercase ${comment.action === 'APPROVED' ? 'bg-green-100 text-green-800' : comment.action === 'REWORK' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'} `}>
                                                        {comment.action}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-slate-700">{comment.comment || description}</p>
                                                {/* Display shoot date and delivery date based on action type */}
                                                {comment.action === 'SET_SHOOT_DATE' && (
                                                    <div className="mt-2 text-sm text-slate-600 font-bold">
                                                        📅 Shoot Date: <span className="text-green-600">{comment.comment}</span>
                                                    </div>
                                                )}
                                                {comment.action === 'SET_DELIVERY_DATE' && (
                                                    <div className="mt-2 text-sm text-slate-600 font-bold">
                                                        📦 Delivery Date: <span className="text-blue-600">{comment.comment}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-slate-500 italic">No comments yet</p>
                            )}
                        </section>
                    )}

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