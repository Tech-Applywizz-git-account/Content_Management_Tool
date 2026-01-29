import React, { useEffect, useState } from 'react';
import { Project, Role, STAGE_LABELS, UserStatus, WorkflowStage } from '../../types';
import { ArrowLeft, Clock, User, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../src/integrations/supabase/client';
import { getWorkflowState } from '../../services/workflowUtils';
import { stripHtmlTags, decodeHtmlEntities } from '../../utils/htmlDecoder';
import Popup from '../Popup';
import Timeline from '../Timeline';
import ScriptDisplay from '../ScriptDisplay';

interface Props {
    project: Project;
    onBack: () => void;
    showWorkflowStatus?: boolean;
}

const WriterProjectDetail: React.FC<Props> = ({ project, onBack, showWorkflowStatus = true }) => {
    interface WorkflowHistoryEntry {
        action: string;
        comment: string;
        actor_name: string;
        timestamp: string;
        actor_id?: string;
    }

    const [comments, setComments] = useState<WorkflowHistoryEntry[]>([]);
    const [previousScript, setPreviousScript] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string | null>(null);
    const [returnType, setReturnType] = useState<'rework' | 'reject' | null>(null);
    const [writerAlreadyActed, setWriterAlreadyActed] = useState(false);

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState(5000); // 5 seconds

    useEffect(() => {
        const fetchData = async () => {
            // Fetch all workflow history events
            const { data: commentsData, error: commentsError } = await supabase
                .from('workflow_history')
                .select(`
                    action,
                    comment,
                    actor_name,
                    actor_id,
                    timestamp,
                    stage,
                    actor_role
                `)
                .eq('project_id', project.id)
                .order('timestamp', { ascending: false });

            if (commentsError) {
                console.error('Error fetching comments:', commentsError);
                setComments([]);
            } else {
                // Deduplicate all events based on unique combinations of action, actor_id, actor_name, comment and timestamp
                const uniqueComments = Array.from(
                    new Map(
                        commentsData.map(item => [
                            `${item.action}-${item.actor_id || ''}-${item.actor_name}-${item.comment || ''}-${item.timestamp}`,
                            item
                        ])
                    ).values()
                ) as WorkflowHistoryEntry[];

                // Show all unique events regardless of status
                // This addresses the issue where the same workflow events were appearing multiple times
                setComments(uniqueComments);

                // Get current user session to check if this writer has already acted
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;

                // Check if current writer has already approved or rejected this project
                const currentUserAction = uniqueComments?.find(comment =>
                    comment.actor_id === user?.id &&
                    (comment.action === 'APPROVED' || comment.action === 'REJECTED')
                );

                setWriterAlreadyActed(!!currentUserAction);
            }

            // Use the new workflow state logic to determine the latest action
            const workflowState = getWorkflowState(project);

            // Determine return type based on the latest action
            if (workflowState.isRejected) {
                setReturnType('reject');
            } else if (workflowState.isRework) {
                setReturnType('rework');
            }

            // Fetch the most recent workflow history entry to get script content
            const { data: historyData, error: historyError } = await supabase
                .from('workflow_history')
                .select('script_content, action, comment, timestamp, actor_name')
                .eq('project_id', project.id)
                .order('timestamp', { ascending: false })
                .limit(1);

            if (historyError) {
                console.error('Error fetching workflow history:', historyError);
            } else if (historyData && historyData.length > 0) {
                // Fetch previous script version based on the latest action
                let scriptAction = workflowState.isRework ? 'REWORK' : 'REJECTED';
                const { data: scriptData, error: scriptError } = await supabase
                    .from('workflow_history')
                    .select('script_content')
                    .eq('project_id', project.id)
                    .eq('action', scriptAction)
                    .order('timestamp', { ascending: false })
                    .limit(1);

                if (scriptError) {
                    // Handle case where script_content column doesn't exist yet
                    if (scriptError.code === '42703') {
                        console.warn(`script_content column not found in workflow_history table. This is expected if the migration hasn't been applied yet.`);
                    } else {
                        console.error('Error fetching previous script:', scriptError);
                    }
                } else if (scriptData && scriptData.length > 0 && scriptData[0].script_content) {
                    setPreviousScript(scriptData[0].script_content);
                } else {
                    // Fallback to the script content from the latest history entry
                    if (historyData && historyData.length > 0 && historyData[0].script_content) {
                        setPreviousScript(historyData[0].script_content);
                    }
                }

                // Fetch rejection reason from project
                if (project.rejected_reason) {
                    setRejectionReason(project.rejected_reason);
                }
            }
        };

        fetchData();
    }, [project.id, project.status, project.rejected_reason]);

    // Use the new workflow state logic
    const workflowState = getWorkflowState(project);
    const isRework = workflowState.isRework;
    const isRejected = workflowState.isRejected;
    const rejectionComment = comments.find(comment => comment.action === 'REJECTED') as WorkflowHistoryEntry | undefined;

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col animate-fade-in">
            <header className="h-16 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white/95 backdrop-blur z-20 shadow-[0_4px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 border-2 border-transparent hover:border-black"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-black uppercase text-slate-900">{project.title}</h1>
                    <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                        project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                            'bg-[#D946EF] text-white'
                        }`}>
                        {project.channel}
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-8 space-y-8">

                    {showWorkflowStatus && (
                        /* Current Status Card */
                        <div className="bg-gradient-to-br from-blue-50 to-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-black uppercase text-slate-900 mb-2">Current Status</h2>
                                    <p className="text-sm font-bold text-slate-500 uppercase">Submitted {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}</p>
                                </div>
                                <div className={`${isRejected ? 'bg-red-600' : 'bg-blue-600'} text-white px-4 py-2 border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
                                    {isRejected ? (returnType === 'reject' ? 'Project Rejected' : 'Rework Required') : 'In Review'}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 border-2 border-black">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <User className="w-5 h-5 text-blue-600" />
                                        <span className="text-xs font-bold uppercase text-slate-500">Current Reviewer</span>
                                    </div>
                                    <p className="font-black text-lg uppercase">
                                        {project.assigned_to_role === Role.CMO ?
                                            (project.current_stage === WorkflowStage.FINAL_REVIEW_CMO ? 'Final Review (CMO)' : 'Script Review (CMO)') :
                                            project.assigned_to_role === Role.CEO ?
                                                (project.current_stage === WorkflowStage.FINAL_REVIEW_CEO ? 'Final Review (CEO)' : 'Script Review (CEO)') :
                                                STAGE_LABELS[project.current_stage]}
                                    </p>
                                </div>

                                <div className="bg-white p-6 border-2 border-black">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Clock className="w-5 h-5 text-blue-600" />
                                        <span className="text-xs font-bold uppercase text-slate-500">Stage</span>
                                    </div>
                                    <p className="font-black text-lg uppercase">{STAGE_LABELS[project.current_stage]}</p>
                                </div>

                                <div className="bg-white p-6 border-2 border-black">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                        <span className="text-xs font-bold uppercase text-slate-500">Status</span>
                                    </div>
                                    <p className="font-black text-lg uppercase">{isRejected ? (returnType === 'reject' ? 'Project Rejected' : 'Rework Required') : project.status}</p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase text-slate-500">Workflow Progress</span>
                                    <span className="text-xs font-bold uppercase text-slate-900">
                                        {project.assigned_to_role === Role.CMO ? 'Level 1 Review' :
                                            project.assigned_to_role === Role.CEO ? 'Level 2 Review' : 'Processing'}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 h-3 border-2 border-black overflow-hidden">
                                    <div
                                        className="bg-blue-600 h-full transition-all duration-500"
                                        style={{ width: project.assigned_to_role === Role.CEO ? '75%' : '50%' }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cinematographer Comments - Show if cine_comments or cine_to_writer_feedback exist */}
                    {(project.data?.cine_comments || project.data?.cine_to_writer_feedback) && (
                        <div className="bg-blue-50 p-6 border-2 border-blue-400 space-y-4">
                            <div className="flex items-center space-x-2">
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-black uppercase text-blue-900">Cinematographer Notes</h3>
                            </div>
                            <div className="bg-white p-4 border-2 border-blue-300">
                                <p className="text-blue-800 whitespace-pre-line text-lg font-medium italic">
                                    {project.data?.cine_to_writer_feedback || project.data?.cine_comments}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div className="bg-slate-50 p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-xl font-black uppercase mb-6 text-slate-900">
                            {project.data?.source === 'IDEA_PROJECT' ? 'Idea Description' : 'Script Content'}
                        </h3>

                        {isRejected && previousScript ? (
                            // Show both old and new content side by side for rework projects
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Previous Content */}
                                <div className="flex flex-col">
                                    <h4 className="font-black text-slate-900 uppercase mb-4 text-center">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Previous Idea' : 'Previous Script'}
                                    </h4>
                                    <ScriptDisplay content={previousScript} showBox={true} />
                                </div>

                                {/* Current Content */}
                                <div className="flex flex-col">
                                    <h4 className="font-black text-slate-900 uppercase mb-4 text-center">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Updated Idea' : 'Updated Script'}
                                    </h4>
                                    <ScriptDisplay
                                        content={project.data?.source === 'IDEA_PROJECT'
                                            ? project.data.idea_description || ''
                                            : project.data?.script_content || ''}
                                        showBox={true}
                                    />
                                </div>
                            </div>
                        ) : (
                            <ScriptDisplay
                                content={project.data?.source === 'IDEA_PROJECT'
                                    ? project.data.idea_description || ''
                                    : project.data?.script_content || ''}
                            />
                        )}
                    </div>

                    {/* Project Details */}
                    <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-xl font-black uppercase mb-6 text-slate-900">Project Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {project.data.brief && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Brief</span>
                                    <p className="text-slate-700 font-medium">{project.data.brief}</p>
                                </div>
                            )}
                            {project.data.keywords && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Keywords</span>
                                    <p className="text-slate-700 font-medium">{project.data.keywords}</p>
                                </div>
                            )}
                            {project.data.niche && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Niche</span>
                                    <p className="text-slate-700 font-medium uppercase">
                                        {project.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                            : project.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                                : project.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                    : project.data.niche === 'OTHER' && project.data.niche_other
                                                        ? project.data.niche_other
                                                        : project.data.niche}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Review History */}
                    <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <Timeline project={{ ...project, history: comments }} />

                        {/* Current Status Footer */}
                        <div className="flex items-start space-x-4 mt-8 pt-6 border-t-2 border-dashed border-slate-300">
                            <div className={`w-3 h-3 border-2 border-black rounded-full mt-2 ${isRejected ? 'bg-red-600' : 'bg-slate-300 animate-pulse'}`}></div>
                            <div className="flex-1 pl-6">
                                <span className="text-xs font-bold uppercase text-slate-500">Current</span>
                                <p className="font-black text-slate-900 uppercase mt-1">
                                    {isRejected ? (returnType === 'reject' ? 'Project Rejected' : 'Rework Required') :
                                        project.assigned_to_role === Role.CMO ? 'With CMO' :
                                            project.assigned_to_role === Role.CEO ? 'With CEO' : 'In Process'}
                                </p>
                                <p className="text-sm text-slate-600 mt-2">
                                    {isRejected ? 'Awaiting resubmission with changes' : 'Awaiting review decision'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Multi-Writer Approval Section - Show if project is in multi-writer approval stage */}
                    {(project.current_stage === 'MULTI_WRITER_APPROVAL' || project.current_stage === 'WRITER_VIDEO_APPROVAL') && (
                        <div className="bg-orange-50 p-6 border-2 border-orange-400 mb-6">
                            <h3 className="text-lg font-black uppercase text-orange-900 mb-4">
                                {project.current_stage === 'MULTI_WRITER_APPROVAL' ? 'Multi-Writer Approval' : 'Video Approval'}
                            </h3>
                            <div className="space-y-4">
                                {project.edited_video_link && (
                                    <div className="bg-white p-4 border-2 border-orange-300">
                                        <h4 className="font-bold text-orange-800 mb-2">Edited Video</h4>
                                        <a
                                            href={project.edited_video_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 underline break-all"
                                        >
                                            {project.edited_video_link}
                                        </a>
                                    </div>
                                )}
                                {project.thumbnail_link && (
                                    <div className="bg-white p-4 border-2 border-orange-300">
                                        <h4 className="font-bold text-orange-800 mb-2">Thumbnail</h4>
                                        <a
                                            href={project.thumbnail_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 underline break-all"
                                        >
                                            {project.thumbnail_link}
                                        </a>
                                    </div>
                                )}
                                {!writerAlreadyActed ? (
                                    <div className="flex space-x-4 pt-4">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    // Get user session
                                                    const { data: { session } } = await supabase.auth.getSession();
                                                    const user = session?.user;

                                                    if (!user) {
                                                        alert('User not authenticated');
                                                        return;
                                                    }

                                                    // Use the centralized db service to approve the project
                                                    const { db } = await import('../../services/supabaseDb');
                                                    // Set the current user in the db service with proper User interface
                                                    db.setCurrentUser({
                                                        id: user.id,
                                                        email: user.email || '',
                                                        full_name: user.user_metadata?.full_name || user.email || 'Unknown User',
                                                        role: Role.WRITER,
                                                        status: UserStatus.ACTIVE
                                                    });

                                                    // Call the workflow advance function to move to next stage
                                                    await db.advanceWorkflow(project.id, 'Writer approved the final video');

                                                    // Show success popup
                                                    setPopupMessage('Video approved successfully! The project has been sent to the ops team.');
                                                    setStageName('Ops Scheduling');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);

                                                    // Navigate back after popup duration + small buffer
                                                    setTimeout(() => {
                                                        onBack(); // Navigate back to previous page
                                                    }, 5500); // 5 seconds popup + 500ms buffer
                                                } catch (error) {
                                                    console.error('Failed to approve video:', error);
                                                    // Show error popup
                                                    setPopupMessage('Failed to approve video. Please try again.');
                                                    setStageName('Error');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);
                                                }
                                            }}
                                            className="px-6 py-3 bg-green-600 text-white font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] transition-all"
                                        >
                                            Approve Video
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    // Get user session
                                                    const { data: { session } } = await supabase.auth.getSession();
                                                    const user = session?.user;

                                                    if (!user) {
                                                        alert('User not authenticated');
                                                        return;
                                                    }

                                                    // Use the centralized db service to reject the project
                                                    const { db } = await import('../../services/supabaseDb');
                                                    // Set the current user in the db service with proper User interface
                                                    db.setCurrentUser({
                                                        id: user.id,
                                                        email: user.email || '',
                                                        full_name: user.user_metadata?.full_name || user.email || 'Unknown User',
                                                        role: Role.WRITER,
                                                        status: UserStatus.ACTIVE
                                                    });

                                                    // Call the workflow reject function to send project back to editor
                                                    await db.rejectTask(project.id, WorkflowStage.VIDEO_EDITING, 'Writer rejected the video - needs rework');

                                                    // Show rejection popup
                                                    setPopupMessage('Video rejected. Sent back to editor for rework.');
                                                    setStageName('Video Editing');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);

                                                    // Navigate back after popup duration + small buffer
                                                    setTimeout(() => {
                                                        onBack(); // Navigate back to previous page
                                                    }, 5500); // 5 seconds popup + 500ms buffer
                                                } catch (error) {
                                                    console.error('Failed to reject video:', error);
                                                    // Show error popup
                                                    setPopupMessage('Failed to reject video. Please try again.');
                                                    setStageName('Error');
                                                    setPopupDuration(5000);
                                                    setShowPopup(true);
                                                }
                                            }}
                                            className="px-6 py-3 bg-red-600 text-white font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] transition-all"
                                        >
                                            Reject Video
                                        </button>
                                    </div>
                                ) : (
                                    <div className="pt-4">
                                        <div className="bg-green-100 p-6 border-2 border-green-400 mb-4">
                                            <h3 className="font-black text-green-800 mb-2">Action Already Taken</h3>
                                            <p className="text-green-700">
                                                You have already acted on this project.
                                                No further action is required from you.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Info Note */}
                    <div className={`p-6 ${(isRejected || project.status === 'REWORK') ? 'bg-red-50 border-2 border-red-400' : 'bg-yellow-50 border-2 border-yellow-400'}`}>
                        <p className={`text-sm font-bold ${(isRejected || project.status === 'REWORK') ? 'text-red-900' : 'text-yellow-900'}`}>
                            <strong className="uppercase">Note:</strong>
                            {isRejected || project.status === 'REWORK'
                                ? returnType === 'reject'
                                    ? 'This project has been rejected. The rejection reason is displayed above. You can make changes and resubmit for review.'
                                    : project.data?.source === 'IDEA_PROJECT'
                                        ? 'This idea has been sent for rework. The rework comments are displayed above. You can make changes and resubmit for review.'
                                        : 'This project has been sent for rework. The reviewer comments are displayed above. You can make changes and resubmit for review.'
                                : project.current_stage === 'MULTI_WRITER_APPROVAL'
                                    ? 'This content requires approval from multiple writers. Your approval contributes to the multi-writer approval process.'
                                    : project.current_stage === 'WRITER_VIDEO_APPROVAL'
                                        ? 'This video has been completed by the editor/designer. Please review and approve or reject.'
                                        : 'You will be notified once the review is complete. If changes are requested, the project will return to your Drafts/Rework section.'}
                        </p>
                    </div>

                </div>
            </div>

            {/* Popup */}
            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={() => {
                        setShowPopup(false);
                        // Navigate back when popup is manually closed
                        onBack();
                    }}
                    duration={popupDuration}
                />
            )}
        </div>
    );
};

export default WriterProjectDetail;