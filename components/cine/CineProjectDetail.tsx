import React, { useState, useEffect } from 'react';
import { Project, WorkflowStage, Role, STAGE_LABELS, TaskStatus } from '../../types';
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import Popup from '../Popup';
import RichTextEditor from '../RichTextEditor';
import { getWorkflowState, getWorkflowStateForRole, canUserEdit, getLatestReworkRejectComment } from '../../services/workflowUtils';

interface Props {
    project: Project;
    userRole: Role;
    onBack: () => void;
    onUpdate: () => void;
    fromView?: 'MYWORK' | 'SCRIPTS';
    activeFilter?: 'NEEDS_SCHEDULE' | 'SCHEDULED' | 'UPLOADED' | 'SCRIPTS' | 'POSTED' | null;
    uploadedSubTab?: 'EDITOR' | 'POST' | 'POSTED' | null;
}

const CineProjectDetail: React.FC<Props> = ({ project: initialProject, userRole, onBack, onUpdate, fromView, activeFilter, uploadedSubTab }) => {
    // For rework projects, keep existing data but track new inputs
    const processedProject = { ...initialProject };

    const [localProject, setLocalProject] = useState<Project>(processedProject);

    const isReworkProject = (project: Project) =>
        project.history?.some(h =>
            h.action?.startsWith('REWORK_')
        );

    // Use the new workflow state logic with role context
    const workflowState = getWorkflowStateForRole(localProject, userRole);
    const isRework = workflowState.isTargetedRework || workflowState.isRework;
    const isRejected = workflowState.isRejected;

    // Determine if current user can edit based on role and workflow state
    const canEdit = canUserEdit(userRole, workflowState, localProject.assigned_to_role);

    // Check if this project is currently assigned to the Cine role
    const isCurrentlyAssignedToCine = localProject.current_stage === WorkflowStage.CINEMATOGRAPHY && localProject.assigned_to_role === 'CINE';


    const [shootDate, setShootDate] = useState(processedProject.shoot_date || '');

    const [videoLink, setVideoLink] = useState(processedProject.video_link || '');
    const [cineComments, setCineComments] = useState('');
    const [editingActorDetails, setEditingActorDetails] = useState(processedProject.data?.actor ?? '');
    const [editingLocationDetails, setEditingLocationDetails] = useState(processedProject.data?.location ?? '');
    const [editingLightingDetails, setEditingLightingDetails] = useState(processedProject.data?.lighting ?? '');
    const [editingCameraAngles, setEditingCameraAngles] = useState(processedProject.data?.angles ?? '');



    // Helper function to decode HTML entities
    const decodeHtmlEntities = (html) => {
        if (!html) return '';
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    };

    // State for script content (decoded for editing)
    const [scriptContent, setScriptContent] = useState(decodeHtmlEntities(processedProject.data.script_content || ''));
    // State for script edit mode
    const [isScriptEditing, setIsScriptEditing] = useState(false);

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState(5000); // Default 5 seconds

    // Reset form fields when project changes
    useEffect(() => {
        const processedProject = { ...initialProject };
        setShootDate(processedProject.shoot_date || '');
        setVideoLink(processedProject.video_link || '');
        setCineComments(''); // Reset comments when project changes
        setEditingActorDetails(processedProject.data?.actor ?? '');
        setEditingLocationDetails(processedProject.data?.location ?? '');
        setEditingLightingDetails(processedProject.data?.lighting ?? '');
        setEditingCameraAngles(processedProject.data?.angles ?? '');
        setScriptContent(decodeHtmlEntities(processedProject.data.script_content || ''));
        setIsScriptEditing(false); // Reset edit mode when project changes
        setLocalProject(processedProject);
    }, [initialProject]);

    // Ensure state is updated when localProject changes
    useEffect(() => {
        if (localProject.data) {
            setEditingActorDetails(localProject.data.actor ?? '');
            setEditingLocationDetails(localProject.data.location ?? '');
            setEditingLightingDetails(localProject.data.lighting ?? '');
            setEditingCameraAngles(localProject.data.angles ?? '');
        }
    }, [localProject.data]);

    const handleSetShootDate = async () => {
        if (!shootDate) {
            alert('Please select a date');
            return;
        }

        try {
            // Get user session
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            console.log('User session data:', session);

            if (!user) {
                alert('User not authenticated');
                return;
            }

            // Validate project data
            if (!localProject.id) {
                alert('Invalid project data: Missing project ID');
                return;
            }

            if (!localProject.current_stage) {
                alert('Invalid project data: Missing current stage');
                return;
            }

            console.log('Project data:', localProject);

            // Record the action in workflow history before updating the project
            console.log('About to record workflow history with:', {
                projectId: localProject.id,
                fromStage: localProject.current_stage,
                toStage: localProject.current_stage,
                userId: user.id,
                action: 'SUBMITTED',
                comment: `Shoot date set to ${shootDate}`
            });

            // Log the actual values being passed
            console.log('Actual values:');
            console.log('  project.id:', localProject.id);
            console.log('  project.current_stage:', localProject.current_stage);
            console.log('  user.id:', user.id);
            console.log('  shootDate:', shootDate);

            await db.workflow.recordAction(
                localProject.id,
                localProject.current_stage, // stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                'SET_SHOOT_DATE', // specific action
                `Shoot date set to ${shootDate}`
            );

            // Update the project with the shoot date but keep it in CINEMATOGRAPHY stage
            // The stage only changes when the video is uploaded
            await db.projects.update(localProject.id, {
                shoot_date: shootDate
            });

            // Update project data to persist any changes made during this session
            await db.updateProjectData(localProject.id, {
                ...localProject.data,
                cine_thumbnail_link: localProject.data.cine_thumbnail_link
            });

            setLocalProject(prev => ({
                ...prev,
                shoot_date: shootDate
            }));
            console.log(`Shoot date set: ${shootDate}`);

            // Show popup notification (use STAGE_LABELS and include calendar visibility)
            const stageLabel = STAGE_LABELS[WorkflowStage.CINEMATOGRAPHY] || 'Cinematography';
            setPopupMessage(`Shoot scheduled for ${localProject.title} on ${shootDate}.`);
            setStageName(stageLabel);
            // For rework scenarios, use longer duration to ensure visibility
            setPopupDuration(isRework ? 10000 : 5000); // 10 seconds for rework, 5 for regular
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to set shoot date:', error);
            // Show more detailed error information
            if (error instanceof Error) {
                alert(`❌ Failed to set shoot date: ${error.message}\n\nPlease try again.`);
            } else {
                alert('❌ Failed to set shoot date. Please try again.');
            }
        }
    };

    const handleUploadVideo = async () => {
        if (!videoLink) {
            alert('Please enter a video link');
            return;
        }

        // Check if user has permission to edit
        if (!canEdit) {
            alert('You do not have permission to edit this project');
            return;
        }

        try {
            // Get user session
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (!user) {
                alert('User not authenticated');
                return;
            }

            // Determine if this is a rework submission based on the new workflow state logic
            const workflowState = getWorkflowStateForRole(localProject, userRole);
            const isRework = workflowState.isTargetedRework || workflowState.isRework;
            const isRejected = workflowState.isRejected;

            // Record the action in workflow history before updating the project
            const actionType = isRework ? 'REWORK_VIDEO_SUBMITTED' : 'CINE_VIDEO_UPLOADED';
            let comment = isRework
                ? `Rework video uploaded: ${videoLink}`
                : `Raw video uploaded: ${videoLink}`;

            // Add cinematographer comments if provided
            if (cineComments.trim()) {
                comment += `\n\nCinematographer Comments: ${cineComments}`;
            } else if (localProject.data?.cine_comments) {
                // If there are existing comments in the project data, include them
                comment += `\n\nCinematographer Comments: ${localProject.data.cine_comments}`;
            }

            console.log('About to record workflow history with:', {
                projectId: localProject.id,
                fromStage: localProject.current_stage,
                toStage: WorkflowStage.VIDEO_EDITING,
                userId: user.id,
                action: actionType,
                comment: comment
            });

            await db.workflow.recordAction(
                localProject.id,
                localProject.current_stage, // Record action at current stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                actionType, // Use appropriate action value
                comment
            );

            // Update the project with the video link and advance the workflow
            // This will properly route to the correct next stage


            // Update project data to persist any changes made during this session
            // Include video_link in the update so timestamp logic can detect the upload
            // Also clear any rework metadata to ensure proper routing from CINEMATOGRAPHY to VIDEO_EDITING
            const updatedProjectData = {
                ...localProject.data,
                video_link: videoLink,
                cine_uploaded_at: new Date().toISOString(),
                cine_comments: cineComments.trim() || undefined, // Store cinematographer comments
                // Clear rework metadata to ensure normal workflow routing
                rework_initiator_role: undefined,
                rework_initiator_stage: undefined,
                rework_target_role: undefined
            };

            // Clear comments state after storing them in the data object
            setCineComments('');

            await db.projects.update(localProject.id, {
                video_link: videoLink,
                cine_uploaded_at: new Date().toISOString(),
                status: TaskStatus.WAITING_APPROVAL
            });

            // Update the project data separately to clear rework metadata
            await db.updateProjectData(localProject.id, updatedProjectData);

            // Update project stage directly to VIDEO_EDITING since cine uploaded the video
            await db.workflow.recordAction(
                localProject.id,
                WorkflowStage.CINEMATOGRAPHY, // Current stage
                user.id,
                user.email || user.id, // userName
                'CINE_VIDEO_UPLOADED', // specific action
                `Raw video uploaded: ${videoLink}`
            );

            // Update project to move to VIDEO_EDITING stage
            await db.projects.update(localProject.id, {
                current_stage: WorkflowStage.VIDEO_EDITING,
                assigned_to_role: Role.EDITOR,
                status: TaskStatus.WAITING_APPROVAL
            });

            // ✅ Update local state ONLY after success
            setLocalProject(prev => ({
                ...prev,
                video_link: videoLink
            }));

            // Get updated project to determine who to notify
            const updatedProject = await db.getProjectById(localProject.id);

            // Find users to notify based on the next assigned role
            if (updatedProject?.assigned_to_role) {
                const { data: nextUsers } = await supabase
                    .from('users')
                    .select('id')
                    .eq('role', updatedProject.assigned_to_role)
                    .eq('status', 'ACTIVE');

                if (nextUsers && nextUsers.length > 0) {
                    // Send notification to all users of the assigned role
                    for (const nextUser of nextUsers) {
                        try {
                            // Use type assertion to access the notifications service
                            const dbWithNotifications = db as any;
                            await dbWithNotifications.notifications.create(
                                nextUser.id,
                                localProject.id,
                                'ASSET_UPLOADED',
                                'New Raw Video Available',
                                `${user?.user_metadata?.full_name || 'Cinematographer'} has uploaded a raw video for: ${localProject.title}. Please review and proceed with ${STAGE_LABELS[updatedProject.current_stage] || updatedProject.current_stage.replace(/_/g, ' ')}.`
                            );
                        } catch (notificationError) {
                            console.error('Failed to send notification:', notificationError);
                            // Continue with the process even if notification fails
                        }
                    }
                }
            }

            // Show popup notification using STAGE_LABELS for the actual next stage
            const actualNextStageLabel = STAGE_LABELS[updatedProject?.current_stage || WorkflowStage.VIDEO_EDITING] || (updatedProject?.current_stage || 'Next Stage').replace(/_/g, ' ');
            const popupMessageText = isRework
                ? `Rework video uploaded for "${localProject.title}". The project has moved to ${actualNextStageLabel}.`
                : `Raw video uploaded for "${localProject.title}". The project has moved to ${actualNextStageLabel}.`;

            setPopupMessage(popupMessageText);

            setStageName(actualNextStageLabel);
            // For rework scenarios, use longer duration to ensure visibility
            setPopupDuration(isRework ? 10000 : 5000); // 10 seconds for rework, 5 for regular
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to upload video:', error);
            // Show more detailed error information
            if (error instanceof Error) {
                alert(`❌ Failed to upload video: ${error.message}\n\nPlease try again.`);
            } else {
                alert('❌ Failed to upload video. Please try again.');
            }
        }
    };

    const handleSaveCinematographyInstructions = async () => {
        try {
            // Get user session for workflow history
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (!user) {
                alert('User not authenticated');
                return;
            }

            // Record the action in workflow history
            await db.workflow.recordAction(
                localProject.id,
                localProject.current_stage, // Record action at current stage
                user.id,
                user.email || user.id, // UserName (using email or ID as fallback)
                'CINE_INSTRUCTIONS_UPDATED', // Use appropriate action value
                `Cinematographer updated instructions`
            );

            // Update project data with the cinematography instructions
            const updatedData = {
                ...localProject.data,
                actor: editingActorDetails,
                location: editingLocationDetails,
                lighting: editingLightingDetails,
                angles: editingCameraAngles
            };

            await db.updateProjectData(localProject.id, updatedData);

            setLocalProject(prev => ({
                ...prev,
                data: updatedData
            }));

            // Update editing states to match saved values
            setEditingActorDetails(updatedData.actor ?? '');
            setEditingLocationDetails(updatedData.location ?? '');
            setEditingLightingDetails(updatedData.lighting ?? '');
            setEditingCameraAngles(updatedData.angles ?? '');

            setPopupMessage('Cinematographer instructions updated successfully');
            setStageName('Instructions Updated');
            setShowPopup(true);
            setPopupDuration(3000);
        } catch (error) {
            console.error('Error saving cinematography instructions:', error);
            alert('Failed to save cinematography instructions');
        }
    };


    return (
        <div className="min-h-screen bg-slate-50 animate-fade-in">
            {/* Header */}
            <div className="bg-white border-b-2 border-black sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-black uppercase text-slate-900">{localProject.title}</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span
                                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${localProject.channel === 'YOUTUBE'
                                    ? 'bg-[#FF4F4F] text-white'
                                    : localProject.channel === 'LINKEDIN'
                                        ? 'bg-[#0085FF] text-white'
                                        : 'bg-[#D946EF] text-white'
                                    }`}
                            >
                                {localProject.channel}
                            </span>

                            <span
                                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${localProject.priority === 'HIGH'
                                    ? 'bg-red-500 text-white'
                                    : localProject.priority === 'NORMAL'
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-green-500 text-white'
                                    }`}
                            >
                                {localProject.priority}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rework Information Box (Shown for rework projects assigned to Cine) */}
            {(isRework || isRejected) && localProject.assigned_to_role === Role.CINE && localProject.history && localProject.history.length > 0 && (
                <div className="bg-red-50 border-2 border-red-400 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center space-x-2 mb-4">
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">!</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase text-red-800">
                                {isRejected ? 'Project Rejected' : 'Rework Required'}
                            </h2>
                            <p className="text-sm font-bold text-red-600">
                                {isRejected ? '(Limited editing capabilities)' : '(Full editing capabilities)'}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 bg-white border-l-4 border-red-500">
                            <h4 className="font-bold text-red-800 mb-2">Reviewer Comments</h4>
                            <p className="text-red-700">
                                {getLatestReworkRejectComment(localProject, userRole)?.comment || 'No specific reason provided. Please review your submission and make necessary changes.'}
                            </p>
                            <p className="text-sm text-red-600 mt-2">
                                {isRejected ? 'Rejected by' : 'Feedback from'} {getLatestReworkRejectComment(localProject, userRole)?.actor_name || 'Reviewer'}
                            </p>
                        </div>

                        {/* Display forwarded comments from CMO and CEO - Hide when in footage upload tab */}
                        {activeFilter !== 'UPLOADED' && localProject?.forwarded_comments && localProject.forwarded_comments.length > 0 && (
                            <div className="mb-4">
                                <h4 className="font-bold text-blue-800 mb-2">Forwarded Comments from CMO/CEO</h4>
                                <div className="space-y-2 ml-2">
                                    {localProject.forwarded_comments
                                        .filter(comment => ['CMO', 'CEO'].includes(comment.from_role))
                                        .map((comment, index) => {
                                            const timestamp = new Date(comment.created_at).toLocaleString();

                                            return (
                                                <div key={`forwarded-${comment.id || index}`} className="p-2 bg-blue-50 border border-blue-200 rounded">
                                                    <div className="flex items-center">
                                                        <span className="font-bold text-blue-700">{comment.from_role} Comment</span>
                                                        <span className="mx-2 text-slate-400">•</span>
                                                        <span className="text-xs text-slate-500">{timestamp}</span>
                                                    </div>
                                                    <div className="mt-1">
                                                        <span className="px-1.5 py-0.5 text-xs font-black uppercase border border-black bg-blue-500 text-white">
                                                            {comment.action}
                                                        </span>
                                                        <span className="ml-2 text-sm text-slate-800">{comment.comment}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Existing Data Display */}
                        <div className="bg-white border-2 border-gray-300 p-4">
                            <h4 className="font-bold text-gray-800 mb-3">Existing Project Data</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {localProject.shoot_date && (
                                    <div>
                                        <span className="text-sm font-bold text-gray-600 block mb-1">Current Shoot Date</span>
                                        <p className="font-medium">{localProject.shoot_date}</p>
                                    </div>
                                )}
                                {localProject.video_link && (
                                    <div>
                                        <span className="text-sm font-bold text-gray-600 block mb-1">Current Video Link</span>
                                        <a
                                            href={localProject.video_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all"
                                        >
                                            {localProject.video_link}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-red-100 border-2 border-red-200 p-3">
                            <p className="text-sm text-red-800 font-bold">
                                Please update the shoot date and/or video link below. Both old and new data will be visible for comparison.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Project Info */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <h2 className="text-xl font-black uppercase mb-4">Project Details</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Status</span>
                            <p className="font-bold text-slate-900 mt-1">{localProject.status}</p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Priority</span>
                            <p className="font-bold text-slate-900 mt-1">{localProject.priority}</p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Created</span>
                            <p className="font-bold text-slate-900 mt-1">
                                {format(new Date(localProject.created_at), 'MMM dd, yyyy h:mm a')}
                            </p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Content Type</span>
                            <p className="font-bold text-slate-900 mt-1">{localProject.content_type}</p>
                        </div>
                        {localProject.data?.niche && (
                            <div className="col-span-2">
                                <span className="font-bold text-slate-400 uppercase text-xs">Niche</span>
                                <p className="font-bold text-slate-900 mt-1 uppercase">
                                    {localProject.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                        : localProject.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                            : localProject.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                : localProject.data.niche === 'OTHER' && localProject.data.niche_other
                                                    ? localProject.data.niche_other
                                                    : localProject.data.niche}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Script Content */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5" />
                        <h2 className="text-xl font-black uppercase">Script</h2>
                    </div>
                    <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
                        {isScriptEditing ? (
                            <RichTextEditor
                                initialContent={scriptContent}
                                onSave={async (content) => {
                                    try {
                                        // Get user session for workflow history
                                        const { data: { session } } = await supabase.auth.getSession();
                                        const user = session?.user;

                                        if (!user) {
                                            alert('User not authenticated');
                                            return;
                                        }

                                        // Record the CINE edit in workflow history
                                        await db.workflow.recordAction(
                                            localProject.id,
                                            localProject.current_stage,
                                            user.id,
                                            user.email || user.id,
                                            'CINE_SCRIPT_EDIT',
                                            `Cinematographer edited script content`,
                                            content, // Store the new script content
                                            Role.CINE, // fromRole
                                            localProject.assigned_to_role || Role.CMO, // toRole
                                            Role.CINE // actorRole
                                        );

                                        // Update the local project data with the new script content
                                        const updatedData = {
                                            ...localProject.data,
                                            script_content: content
                                        };

                                        await db.updateProjectData(localProject.id, updatedData);

                                        // Update local state to reflect the saved changes
                                        setLocalProject(prev => ({
                                            ...prev,
                                            data: updatedData
                                        }));

                                        // Update the scriptContent state
                                        setScriptContent(content);

                                        // Exit edit mode
                                        setIsScriptEditing(false);

                                        // Show success message
                                        setPopupMessage('Script content updated successfully');
                                        setStageName('Updated');
                                        setShowPopup(true);
                                        setPopupDuration(3000);

                                        // Don't call onUpdate() here to prevent navigation back
                                    } catch (error) {
                                        console.error('Error updating script content:', error);
                                        alert('Failed to update script content');
                                    }
                                }}
                                onCancel={() => {
                                    // Cancel editing - revert to original content
                                    setScriptContent(decodeHtmlEntities(localProject.data.script_content || ''));
                                    setIsScriptEditing(false);
                                }}
                                canEdit={canEdit}
                                projectId={localProject.id}
                                projectName={localProject.title}
                            />
                        ) : (
                            <>
                                {localProject.data.script_content
                                    ? (
                                        <div className="bg-white p-8 border-2 border-slate-100 shadow-inner overflow-hidden"
                                            style={{ fontSize: '1.25rem', lineHeight: '1.8' }}>
                                            <div className="whitespace-pre-wrap script-content-display text-slate-900"
                                                dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(localProject.data.script_content) }} />
                                        </div>
                                    )
                                    : <div className="text-slate-400 italic">No script content available</div>}

                                {canEdit && (
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={() => setIsScriptEditing(true)}
                                            className="px-6 py-3 bg-[#0085FF] text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2"
                                        >
                                            <FileText className="w-5 h-5" />
                                            Edit Script & Format
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Script Reference Link - Show for projects that haven't completed video upload */}
                {(!localProject.video_link || localProject.current_stage === WorkflowStage.CINEMATOGRAPHY) && localProject.data?.script_reference_link && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Script Reference Link</h2>
                        </div>
                        <div className="bg-blue-50 border-2 border-blue-600 p-4">
                            <p className="text-sm font-bold uppercase text-blue-800 mb-2">Reference Video</p>
                            <a
                                href={localProject.data.script_reference_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                            >
                                {localProject.data.script_reference_link}
                            </a>
                        </div>
                    </div>
                )}

                {/* Thumbnail Section - Show when thumbnail_required is true */}
                {(localProject.data?.thumbnail_required || localProject.data?.cine_thumbnail_required) && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Upload className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Thumbnail Assets</h2>
                        </div>
                        <div className="space-y-6">
                            {/* Show writer's thumbnail reference link if it exists */}
                            {localProject.data?.thumbnail_reference_link && (
                                <div className="bg-blue-50 border-2 border-blue-600 p-4">
                                    <p className="text-sm font-bold uppercase text-blue-800 mb-2">Writer's Thumbnail Reference</p>
                                    <a
                                        href={localProject.data.thumbnail_reference_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                                    >
                                        {localProject.data.thumbnail_reference_link}
                                    </a>
                                </div>
                            )}

                            {/* Single Thumbnail Asset Link Input */}
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-slate-700 uppercase italic">Cinematographer's Thumbnail Asset Link</label>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={localProject.data?.cine_thumbnail_link || ''}
                                        onChange={(e) => {
                                            const newValue = e.target.value;
                                            setLocalProject(prev => ({
                                                ...prev,
                                                data: { ...prev.data, cine_thumbnail_link: newValue }
                                            }));
                                        }}
                                        disabled={!canEdit}
                                        placeholder="Paste folder link, Imgur album, or single photo link..."
                                        className="flex-1 p-3 border-2 border-black text-base font-medium focus:bg-yellow-50 focus:outline-none disabled:bg-slate-50"
                                    />
                                </div>
                                <p className="text-sm text-slate-500 italic">Provide the final screenshot or asset for the designer.</p>
                            </div>

                            {canEdit && (
                                <button
                                    onClick={async () => {
                                        try {
                                            const updatedData = {
                                                ...localProject.data,
                                                cine_thumbnail_link: localProject.data?.cine_thumbnail_link || ''
                                            };
                                            await db.updateProjectData(localProject.id, updatedData);
                                            setPopupMessage('Thumbnail assets updated successfully');
                                            setStageName('Assets Saved');
                                            setShowPopup(true);
                                            setPopupDuration(3000);
                                        } catch (error) {
                                            console.error('Error saving thumbnail assets:', error);
                                            alert('Failed to save assets');
                                        }
                                    }}
                                    className="w-full sm:w-auto px-6 py-3 bg-[#0085FF] text-white font-bold uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                >
                                    Save Thumbnail Assets
                                </button>
                            )}
                        </div>
                    </div>
                )}


                {/* Cinematographer Instructions Section - Hidden for UPLOADED filter */}
                {activeFilter !== 'UPLOADED' && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Cinematographer Instructions</h2>
                        </div>
                        <div className="space-y-4">
                            {/* Writer's name */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 uppercase">Writer</label>
                                <p className="p-2 border-2 border-black font-medium bg-slate-50">
                                    {localProject.data?.writer_name || 'Writer name not available'}
                                </p>
                            </div>

                            {/* Fields that can be edited by cinematographer */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 uppercase">Actor Details</label>
                                    {canEdit ? (
                                        <input
                                            type="text"
                                            value={editingActorDetails}
                                            onChange={(e) => setEditingActorDetails(e.target.value)}
                                            placeholder="e.g. Female presenter, 30s, business attire"
                                            className="w-full p-2 border-2 border-black text-base font-medium focus:bg-yellow-50 focus:outline-none"
                                        />
                                    ) : (
                                        <p className="p-2 border-2 border-black font-medium bg-slate-50">
                                            {localProject.data?.actor ?? 'Not specified'}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 uppercase">Location Details</label>
                                    {canEdit ? (
                                        <input
                                            type="text"
                                            value={editingLocationDetails}
                                            onChange={(e) => setEditingLocationDetails(e.target.value)}
                                            placeholder="e.g. Office, studio, outdoor street"
                                            className="w-full p-2 border-2 border-black text-base font-medium focus:bg-yellow-50 focus:outline-none"
                                        />
                                    ) : (
                                        <p className="p-2 border-2 border-black font-medium bg-slate-50">
                                            {localProject.data?.location ?? 'Not specified'}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 uppercase">Lighting Details</label>
                                    {canEdit ? (
                                        <input
                                            type="text"
                                            value={editingLightingDetails}
                                            onChange={(e) => setEditingLightingDetails(e.target.value)}
                                            placeholder="e.g. Soft daylight, cinematic, low-key"
                                            className="w-full p-2 border-2 border-black text-base font-medium focus:bg-yellow-50 focus:outline-none"
                                        />
                                    ) : (
                                        <p className="p-2 border-2 border-black font-medium bg-slate-50">
                                            {localProject.data?.lighting ?? 'Not specified'}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 uppercase">Camera Angles</label>
                                    {canEdit ? (
                                        <input
                                            type="text"
                                            value={editingCameraAngles}
                                            onChange={(e) => setEditingCameraAngles(e.target.value)}
                                            placeholder="e.g. Medium shot, close-up, over-the-shoulder"
                                            className="w-full p-2 border-2 border-black text-base font-medium focus:bg-yellow-50 focus:outline-none"
                                        />
                                    ) : (
                                        <p className="p-2 border-2 border-black font-medium bg-slate-50">
                                            {localProject.data?.angles ?? 'Not specified'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Save button only when editing is allowed */}
                            {canEdit && (
                                <div className="pt-4">
                                    <button
                                        onClick={handleSaveCinematographyInstructions}
                                        className="px-4 py-2 bg-[#0085FF] text-white font-bold uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    >
                                        Save Instructions
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Cinematographer Comments Section - Hidden for UPLOADED filter */}
                {activeFilter !== 'UPLOADED' && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Cinematographer Notes</h2>
                        </div>
                        <div className="space-y-4">
                            {localProject.data?.cine_comments ? (
                                <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
                                    <p>{localProject.data.cine_comments}</p>
                                </div>
                            ) : (
                                <p className="text-slate-500 italic">No cinematographer notes added yet</p>
                            )}

                            {canEdit && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 uppercase">Add Comments</label>
                                    <textarea
                                        value={cineComments}
                                        onChange={(e) => setCineComments(e.target.value)}
                                        placeholder="Add any comments or notes for the writer/next team members..."
                                        className="w-full p-3 border-2 border-black text-base font-medium focus:bg-yellow-50 focus:outline-none min-h-[80px]"
                                    />
                                    <button
                                        onClick={async () => {
                                            // Save comments without uploading video
                                            if (!cineComments.trim()) {
                                                alert('Please enter some comments');
                                                return;
                                            }

                                            try {
                                                // Get user session for workflow history
                                                const { data: { session } } = await supabase.auth.getSession();
                                                const user = session?.user;

                                                if (!user) {
                                                    alert('User not authenticated');
                                                    return;
                                                }

                                                // Record the action in workflow history
                                                await db.workflow.recordAction(
                                                    localProject.id,
                                                    localProject.current_stage, // Record action at current stage
                                                    user.id,
                                                    user.email || user.id, // UserName (using email or ID as fallback)
                                                    'CINE_COMMENTS_ADDED', // Use appropriate action value
                                                    `Cinematographer added comments: ${cineComments.trim()}`
                                                );

                                                // Update project data with comments
                                                const updatedData = {
                                                    ...localProject.data,
                                                    cine_comments: cineComments.trim()
                                                };

                                                await db.updateProjectData(localProject.id, updatedData);

                                                setLocalProject(prev => ({
                                                    ...prev,
                                                    data: updatedData
                                                }));
                                                setCineComments('');
                                                setPopupMessage('Comments saved successfully');
                                                setStageName('Notes Updated');
                                                setShowPopup(true);
                                                setPopupDuration(3000);
                                            } catch (error) {
                                                console.error('Error saving comments:', error);
                                                alert('Failed to save comments');
                                            }
                                        }}
                                        className="px-4 py-2 bg-[#0085FF] text-white font-bold uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    >
                                        Save Comments
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Video Upload Section - Show if project has shoot date and either assigned to Cine or has a video link */}
                {(isCurrentlyAssignedToCine || localProject.video_link) && localProject.shoot_date && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Upload className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Video Upload</h2>
                        </div>

                        {(canEdit) ? (
                            <div className="space-y-4">
                                {/* Show existing video link as reference */}
                                {localProject.video_link && (
                                    <div className="bg-blue-50 border-2 border-blue-600 p-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Video className="w-5 h-5 text-blue-800" />
                                                <p className="text-sm font-bold uppercase text-blue-800">Previous Video Link</p>
                                            </div>
                                            <a
                                                href={localProject.video_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                                            >
                                                {localProject.video_link}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Input for new video link */}
                                <div className="space-y-4">
                                    <p className="text-slate-600 font-medium">{isRejected ? 'Upload the new video link for rejected project' : isRework ? 'Upload the new video link for rework' : 'Upload the video link after shooting'}</p>
                                    <div className="flex gap-3">
                                        <input
                                            type="url"
                                            value={videoLink}
                                            onChange={(e) => setVideoLink(e.target.value)}
                                            placeholder="https://drive.google.com/file/d/... or https://vimeo.com/..."
                                            className="flex-1 p-4 border-2 border-black text-lg font-medium focus:bg-yellow-50 focus:outline-none"
                                        />
                                        <button
                                            onClick={handleUploadVideo}
                                            className="px-8 py-4 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                        >
                                            <Upload className="w-5 h-5 inline mr-2" />
                                            {isRejected ? 'Submit Rejected Video' : isRework ? 'Submit Rework Video' : 'Upload Video'}
                                        </button>
                                    </div>

                                    <p className="text-sm text-slate-500">
                                        🎬 Once uploaded, the Editor will be automatically notified
                                    </p>
                                </div>
                            </div>
                        ) : !localProject.video_link ? (
                            <div className="space-y-4">
                                <p className="text-slate-600 font-medium">Upload the video link after shooting</p>
                                <div className="flex gap-3">
                                    <input
                                        type="url"
                                        value={videoLink}
                                        onChange={(e) => setVideoLink(e.target.value)}
                                        placeholder="https://drive.google.com/file/d/... or https://vimeo.com/..."
                                        className="flex-1 p-4 border-2 border-black text-lg font-medium focus:bg-yellow-50 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleUploadVideo}
                                        className="px-8 py-4 bg-[#0085FF] border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    >
                                        <Upload className="w-5 h-5 inline mr-2" />
                                        Upload Video
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500">
                                    🎬 Once uploaded, the Editor will be automatically notified
                                </p>
                            </div>
                        ) : (
                            <div className="bg-blue-50 border-2 border-blue-600 p-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Video className="w-5 h-5 text-blue-800" />
                                        <p className="text-sm font-bold uppercase text-blue-800">✓ Video Uploaded</p>
                                    </div>
                                    <a
                                        href={localProject.video_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                                    >
                                        {localProject.video_link}
                                    </a>
                                    <p className="text-sm text-blue-800 font-medium">
                                        → Project has been moved to Editor for video editing
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Editor Video - Show when in UPLOADED tab */}
                {activeFilter === 'UPLOADED' && localProject.edited_video_link && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Video className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Editor's Video</h2>
                        </div>
                        <div className="bg-blue-50 border-2 border-blue-600 p-4">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Video className="w-5 h-5 text-blue-800" />
                                    <p className="text-sm font-bold uppercase text-blue-800">Edited Video Link</p>
                                </div>
                                <a
                                    href={localProject.edited_video_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                                >
                                    {localProject.edited_video_link}
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cinematography Instructions - Hidden for both tabs */}
                {/* Removed per user request */}

                {/* Forwarded Comments from CEO - Hide when in POST sub-tab */}
                {!(activeFilter === 'UPLOADED' && uploadedSubTab === 'POST') && localProject?.forwarded_comments && localProject.forwarded_comments.length > 0 && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <h2 className="text-xl font-black uppercase mb-4">Forwarded Comments from CEO</h2>
                        <div className="space-y-3">
                            {(() => {
                                const ceoComments = localProject.forwarded_comments?.filter(comment => comment.from_role === 'CEO') || [];
                                return ceoComments.map((comment, index) => {
                                    const timestamp = new Date(comment.created_at).toLocaleString();

                                    return (
                                        <div key={`ceo-forwarded-${comment.id || index}`} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-center mb-2">
                                                <span className="font-bold text-blue-800">CEO Comment</span>
                                                <span className="mx-2 text-slate-400">•</span>
                                                <span className="text-sm text-slate-500">{timestamp}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-1 text-xs font-bold uppercase border border-black bg-blue-500 text-white">
                                                    {comment.action}
                                                </span>
                                                <span className="font-medium text-slate-800">{comment.comment}</span>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                )}



                {/* Shoot Scheduling Section - Only show if project is assigned to Cine */}
                {isCurrentlyAssignedToCine && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <CalendarIcon className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Shoot Schedule</h2>
                        </div>

                        {!localProject.shoot_date ? (
                            <div className="space-y-4">
                                <p className="text-slate-600 font-medium">Schedule a shoot date for this project</p>
                                <div className="flex gap-3">
                                    <input
                                        type="date"
                                        value={shootDate}
                                        onChange={(e) => setShootDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="flex-1 p-4 border-2 border-black text-lg font-bold focus:bg-yellow-50 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleSetShootDate}
                                        className="px-8 py-4 bg-[#4ADE80] border-2 border-black text-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    >
                                        <CalendarIcon className="w-5 h-5 inline mr-2" />
                                        Set Shoot Date
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500">
                                    📅 This date will be visible on calendars for Writer, CEO, CMO, and Operations
                                </p>
                            </div>
                        ) : (
                            <div className="bg-green-50 border-2 border-green-600 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold uppercase text-green-800 mb-1">✓ Shoot Scheduled</p>
                                        <p className="text-2xl font-black text-green-900">{localProject.shoot_date}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShootDate('');
                                            setLocalProject(prev => ({
                                                ...prev,
                                                shoot_date: null
                                            }));
                                        }}
                                        className="px-4 py-2 border-2 border-green-700 text-green-800 font-bold text-sm uppercase hover:bg-green-100 transition-colors"
                                    >
                                        Reschedule
                                    </button>

                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    duration={popupDuration}
                    onClose={() => {
                        setShowPopup(false);
                        // Only call onUpdate() for major state changes, not for script saves
                        if (!popupMessage.includes('Script content updated successfully')) {
                            onUpdate();
                        }
                    }}
                />
            )}
        </div>
    );
};

export default CineProjectDetail;