import React, { useState, useEffect } from 'react';
import { Project, WorkflowStage, Role, STAGE_LABELS, TaskStatus } from '../../types';
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, FileText, FileImage, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import Popup from '../Popup';
import { getWorkflowState, getWorkflowStateForRole, canUserEdit, getLatestReworkRejectComment } from '../../services/workflowUtils';

interface Props {
    project: Project;
    userRole: Role;
    onBack: () => void;
    onUpdate: () => void;
}
const isReworkProject = (project: Project) =>
    project.history?.some(h =>
        h.action?.startsWith('REWORK_')
    );

const DesignerProjectDetail: React.FC<Props> = ({ project, userRole, onBack, onUpdate }) => {
    // For rework projects, keep existing data but track new inputs
    const processedProject = { ...project };

    const [deliveryDate, setDeliveryDate] = useState(processedProject.delivery_date || '');

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState(5000); // Default 5 seconds
    const [thumbnailLink, setThumbnailLink] = useState(processedProject.thumbnail_link || '');
    const [creativeLink, setCreativeLink] = useState(processedProject.creative_link || processedProject.data?.creative_link || '');

    const isVideo = project.content_type === 'VIDEO';
    // Use the new workflow state logic with role context
    const workflowState = getWorkflowStateForRole(project, userRole);
    const isRework = workflowState.isTargetedRework || workflowState.isRework;
    const isRejected = workflowState.isRejected;

    // Determine if current user can edit based on role and workflow state
    const canEdit = canUserEdit(userRole, workflowState, project.assigned_to_role);

    const hasAsset = isVideo
        ? !!project.thumbnail_link
        : !!project.creative_link || !!project.data?.creative_link;


    // Reset form fields when project changes
    useEffect(() => {
        // For rework projects, keep existing data
        const processedProject = { ...project };
        setDeliveryDate(processedProject.delivery_date || '');
        setThumbnailLink(processedProject.thumbnail_link || '');
        setCreativeLink(processedProject.creative_link || '');
    }, [project]);

    const handleSetDeliveryDate = async () => {
        if (!deliveryDate) {
            alert('Please select a delivery date');
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

            // Record the action in workflow history
            await db.workflow.recordAction(
                project.id,
                project.current_stage, // stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                'SET_DELIVERY_DATE', // specific action
                `Delivery date set to ${deliveryDate}`
            );

            // Update the project with the delivery date but keep it in current stage
            // The stage only changes when the file is uploaded
            await db.projects.update(project.id, { delivery_date: deliveryDate });
            console.log(`Delivery date set: ${deliveryDate}`);

            // Show popup notification (include calendar visibility and derive stage label)
            const stageLabel = isVideo ? STAGE_LABELS[WorkflowStage.THUMBNAIL_DESIGN] : STAGE_LABELS[WorkflowStage.CREATIVE_DESIGN];
            setPopupMessage(`Delivery date set for ${project.title} on ${deliveryDate}. This date will be visible on calendars for all team members.`);
            setStageName(stageLabel || (isVideo ? 'Thumbnail Design' : 'Creative Design'));
            // For rework scenarios, use longer duration to ensure visibility
            setPopupDuration(isRework ? 10000 : 5000); // 10 seconds for rework, 5 for regular
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to set delivery date:', error);
            alert('❌ Failed to set delivery date. Please try again.');
        }
    };

    const handleUploadFile = async () => {
        const link = isVideo ? thumbnailLink : creativeLink;
        if (!link) {
            alert(`Please enter the ${isVideo ? 'thumbnail' : 'creative'} link`);
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

            // Record the action in workflow history with appropriate action type
            const actionType = isRework ? 'REWORK_DESIGN_SUBMITTED' : 'DESIGNER_ASSET_UPLOADED';
            const comment = isRework
                ? `Rework ${isVideo ? 'thumbnail' : 'creative'} uploaded: ${link}`
                : `${isVideo ? 'Thumbnail' : 'Creative'} uploaded: ${link}`;

            await db.workflow.recordAction(
                project.id,
                project.current_stage, // Record action at current stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                actionType, // Use appropriate action value
                comment
            );

            // Update the project with the file link and advance the workflow
            // This will properly route to the correct next stage
            const updates: Partial<Project> = {};

            if (isVideo) {
                updates.thumbnail_link = link;
            } else {
                updates.creative_link = link;
            }

            await db.projects.update(project.id, {
                ...updates,
                designer_uploaded_at: new Date().toISOString(), // Store timestamp
                designer_name: user?.user_metadata?.full_name || user?.email || 'Unknown Designer', // Store designer name in direct column
                data: {
                    ...project.data
                }
            });

            // Update project data to persist any changes made during this session
            // Include the asset links in the update so timestamp logic can detect the upload
            const projectDataUpdates: any = { ...project.data };
            if (isVideo) {
                projectDataUpdates.thumbnail_link = link;
            } else {
                projectDataUpdates.creative_link = link;
            }

            await db.updateProjectData(project.id, projectDataUpdates);

            // Advance workflow to next stage based on project settings
            await db.advanceWorkflow(project.id, comment);

            console.log(`${isRework ? 'Rework ' : ''}${isVideo ? 'Thumbnail' : 'Creative'} uploaded: ${link}`);

            // Get updated project to determine who to notify
            const updatedProject = await db.getProjectById(project.id);

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
                                project.id,
                                'ASSET_UPLOADED',
                                'New Thumbnail/Creative Available',
                                `${user?.user_metadata?.full_name || 'Designer'} has uploaded ${isVideo ? 'a thumbnail' : 'a creative'} for: ${project.title}. Please review and proceed with ${STAGE_LABELS[updatedProject.current_stage] || updatedProject.current_stage.replace(/_/g, ' ')}.`
                            );
                        } catch (notificationError) {
                            console.error('Failed to send notification:', notificationError);
                            // Continue with the process even if notification fails
                        }
                    }
                }
            }

            // Show popup notification using STAGE_LABELS for the actual next stage
            const actualNextStageLabel = STAGE_LABELS[updatedProject?.current_stage || WorkflowStage.FINAL_REVIEW_CMO] || (updatedProject?.current_stage || 'Next Stage').replace(/_/g, ' ');
            const popupMessageText = isRework
                ? `Rework ${isVideo ? 'thumbnail' : 'creative'} uploaded successfully for ${project.title}. Waiting for ${actualNextStageLabel}.`
                : `${isVideo ? 'Thumbnail' : 'Creative'} uploaded successfully for ${project.title}. Waiting for ${actualNextStageLabel}.`;

            setPopupMessage(popupMessageText);
            setStageName(actualNextStageLabel);
            // For rework scenarios, use longer duration to ensure visibility
            setPopupDuration(isRework ? 10000 : 5000); // 10 seconds for rework, 5 for regular
            setShowPopup(true);
        } catch (error) {
            console.error(`Failed to upload ${isVideo ? 'thumbnail' : 'creative'}:`, error);
            alert(`❌ Failed to upload ${isVideo ? 'thumbnail' : 'creative'}. Please try again.`);
        }
    };

    const handleDirectUpload = async () => {
        const link = isVideo ? thumbnailLink : creativeLink;
        if (!link) {
            alert(`Please enter the ${isVideo ? 'thumbnail' : 'creative'} link`);
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

            // Record the action in workflow history
            await db.workflow.recordAction(
                project.id,
                project.current_stage, // Record action at current stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                'DIRECT_UPLOAD', // Use direct upload action
                `Direct ${isVideo ? 'thumbnail' : 'creative'} upload: ${link}`
            );

            // Update the project with the file link
            const updates: Partial<Project> = {};

            if (isVideo) {
                updates.thumbnail_link = link;
            } else {
                updates.creative_link = link;
            }

            await db.projects.update(project.id, {
                ...updates,
                designer_uploaded_at: new Date().toISOString(), // Store timestamp
                designer_name: user?.user_metadata?.full_name || user?.email || 'Unknown Designer', // Store designer name in direct column
                data: {
                    ...project.data
                }
            });

            // Skip to CMO review stage directly
            await db.workflow.approve(
                project.id,
                user.id,
                user.email || user.id,
                userRole,
                WorkflowStage.FINAL_REVIEW_CMO, // Skip to CMO review
                Role.CMO,
                `Direct upload to CMO review: ${link}`
            );

            console.log(`Direct ${isVideo ? 'thumbnail' : 'creative'} uploaded: ${link}`);

            // Get updated project to determine who to notify
            const updatedProject = await db.getProjectById(project.id);

            // Notify CMO users
            const { data: cmoUsers } = await supabase
                .from('users')
                .select('id')
                .eq('role', Role.CMO)
                .eq('status', 'ACTIVE');

            if (cmoUsers && cmoUsers.length > 0) {
                // Send notification to all CMO users
                for (const cmoUser of cmoUsers) {
                    try {
                        // Use type assertion to access the notifications service
                        const dbWithNotifications = db as any;
                        await dbWithNotifications.notifications.create(
                            cmoUser.id,
                            project.id,
                            'ASSET_UPLOADED',
                            'New Direct Upload Available',
                            `${user?.user_metadata?.full_name || 'Designer'} has uploaded ${isVideo ? 'a thumbnail' : 'a creative'} directly for: ${project.title}. Please review and proceed with ${STAGE_LABELS[WorkflowStage.FINAL_REVIEW_CMO] || 'Final Review CMO'}.`
                        );
                    } catch (notificationError) {
                        console.error('Failed to send notification:', notificationError);
                        // Continue with the process even if notification fails
                    }
                }
            }

            // Show popup notification
            const nextStageLabel = STAGE_LABELS[WorkflowStage.FINAL_REVIEW_CMO] || 'Final Review CMO';
            setPopupMessage(`${isVideo ? 'Thumbnail' : 'Creative'} uploaded directly for ${project.title}. Sent to ${nextStageLabel}.`);
            setStageName(nextStageLabel);
            setPopupDuration(5000);
            setShowPopup(true);
        } catch (error) {
            console.error(`Failed to upload ${isVideo ? 'thumbnail' : 'creative'} directly:`, error);
            alert(`❌ Failed to upload ${isVideo ? 'thumbnail' : 'creative'} directly. Please try again.`);
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
                        <h1 className="text-2xl font-black uppercase text-slate-900">{project.title}</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span
                                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE'
                                    ? 'bg-[#FF4F4F] text-white'
                                    : project.channel === 'LINKEDIN'
                                        ? 'bg-[#0085FF] text-white'
                                        : 'bg-[#D946EF] text-white'
                                    }`}
                            >
                                {project.channel}
                            </span>
                            <span
                                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${isVideo ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                    }`}
                            >
                                {isVideo ? '🎬 Thumbnail Task' : '🎨 Creative Task'}
                            </span>
                            <span className="text-sm text-slate-500 font-bold">
                                Due: {format(new Date(project.due_date), 'MMM dd, yyyy h:mm a')}
                            </span>
                            <span
                                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH'
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
            </div>

            {/* Rework Information Box (Only shown for rejected projects assigned to Designer) */}
            {(isRework || isRejected) && project.assigned_to_role === Role.DESIGNER && project.history && project.history.length > 0 && (
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
                                {getLatestReworkRejectComment(project, userRole)?.comment || 'No specific reason provided. Please review your submission and make necessary changes.'}
                            </p>
                            <p className="text-sm text-red-600 mt-2">
                                {isRejected ? 'Rejected by' : 'Feedback from'} {getLatestReworkRejectComment(project, userRole)?.actor_name || 'Reviewer'}
                            </p>
                        </div>

                        {/* Existing Data Display */}
                        <div className="bg-white border-2 border-gray-300 p-4">
                            <h4 className="font-bold text-gray-800 mb-3">Existing Project Data</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {project.delivery_date && (
                                    <div>
                                        <span className="text-sm font-bold text-gray-600 block mb-1">Current Delivery Date</span>
                                        <p className="font-medium">{project.delivery_date}</p>
                                    </div>
                                )}
                                {isVideo && project.thumbnail_link && (
                                    <div>
                                        <span className="text-sm font-bold text-gray-600 block mb-1">Current Thumbnail Link</span>
                                        <a
                                            href={project.thumbnail_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all"
                                        >
                                            {project.thumbnail_link}
                                        </a>
                                    </div>
                                )}
                                {!isVideo && (project.creative_link || project.data?.creative_link) && (
                                    <div>
                                        <span className="text-sm font-bold text-gray-600 block mb-1">Current Creative Link</span>
                                        <a
                                            href={project.creative_link || project.data?.creative_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all"
                                        >
                                            {project.creative_link || project.data?.creative_link}
                                        </a>
                                    </div>
                                )}
                                {isVideo && project.edited_video_link && (
                                    <div>
                                        <span className="text-sm font-bold text-gray-600 block mb-1">Edited Video Link</span>
                                        <a
                                            href={project.edited_video_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all"
                                        >
                                            {project.edited_video_link}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-red-100 border-2 border-red-200 p-3">
                            <p className="text-sm text-red-800 font-bold">
                                Please update the delivery date and/or creative/thumbnail link below. Both old and new data will be visible for comparison.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Edited Video (for thumbnail tasks) */}
                {isVideo && project.edited_video_link && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Video className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Edited Video (from Editor)</h2>
                        </div>
                        <div className="bg-blue-50 border-2 border-blue-400 p-4">
                            <p className="text-sm font-bold text-blue-800 mb-2">
                                🎬 Create a thumbnail for this video
                            </p>
                            <a
                                href={project.edited_video_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                            >
                                {project.edited_video_link}
                            </a>
                        </div>
                    </div>
                )}

                {/* Script Reference */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5" />
                        <h2 className="text-xl font-black uppercase">
                            {isVideo ? 'Script Reference' : 'Content Brief'}
                        </h2>
                    </div>
                    <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
                        {project.data.script_content ? <div dangerouslySetInnerHTML={{ __html: project.data.script_content }} /> : 'No content available'}
                    </div>
                </div>

                {/* Thumbnail Requirements - Show if video and thumbnail required */}
                {isVideo && project.data.thumbnail_required && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Palette className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Thumbnail Requirements</h2>
                        </div>
                        <div className="space-y-4">
                            {project.data.thumbnail_reference_link && (
                                <div>
                                    <p className="font-bold text-slate-500 uppercase text-xs mb-1">Reference Thumbnail</p>
                                    <a
                                        href={project.data.thumbnail_reference_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                                    >
                                        {project.data.thumbnail_reference_link}
                                    </a>
                                </div>
                            )}

                            {project.data.thumbnail_notes && (
                                <div>
                                    <p className="font-bold text-slate-500 uppercase text-xs mb-1">Thumbnail Notes</p>
                                    <div className="bg-slate-50 border-2 border-slate-200 p-4 font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                                        {project.data.thumbnail_notes}
                                    </div>
                                </div>
                            )}

                            {/* Thumbnail Link from Cinematographer */}
                            {project.data.cine_thumbnail_link && (
                                <div>
                                    <p className="font-bold text-slate-500 uppercase text-xs mb-1">Cinematographer's Thumbnail Assets</p>
                                    <a
                                        href={project.data.cine_thumbnail_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-3 bg-white border-2 border-purple-400 text-purple-600 font-medium hover:bg-purple-50 transition-colors break-all"
                                    >
                                        {project.data.cine_thumbnail_link}
                                    </a>
                                    <p className="text-xs text-slate-500 mt-1">Assets provided by Cinematographer for thumbnail creation</p>
                                </div>
                            )}

                            {!project.data.thumbnail_reference_link && !project.data.thumbnail_notes && !project.data.cine_thumbnail_link && (
                                <p className="text-slate-500 italic">No specific thumbnail requirements provided.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Delivery Date Section */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <CalendarIcon className="w-5 h-5" />
                        <h2 className="text-xl font-black uppercase">Delivery Date</h2>
                    </div>

                    {!project.delivery_date ? (
                        <div className="space-y-4">
                            <p className="text-slate-600 font-medium">
                                Set when you'll deliver the {isVideo ? 'thumbnail' : 'creative'}
                            </p>
                            <div className="flex gap-3">
                                <input
                                    type="date"
                                    value={deliveryDate}
                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="flex-1 p-4 border-2 border-black text-lg font-bold focus:bg-yellow-50 focus:outline-none"
                                />
                                <button
                                    onClick={handleSetDeliveryDate}
                                    className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                >
                                    <CalendarIcon className="w-5 h-5 inline mr-2" />
                                    Set Delivery Date
                                </button>
                            </div>
                            <p className="text-sm text-slate-500">
                                📅 This date will be visible on calendars for all team members
                            </p>
                        </div>
                    ) : (
                        <div className="bg-purple-50 border-2 border-purple-600 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold uppercase text-purple-800 mb-1">✓ Delivery Scheduled</p>
                                    <p className="text-2xl font-black text-purple-900">{project.delivery_date}</p>
                                </div>
                                <button
                                    onClick={() => setDeliveryDate('')}
                                    className="px-4 py-2 border-2 border-purple-700 text-purple-800 font-bold text-sm uppercase hover:bg-purple-100 transition-colors"
                                >
                                    Reschedule
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Upload Section */}
                {project.delivery_date && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            {isVideo ? <FileImage className="w-5 h-5" /> : <Palette className="w-5 h-5" />}
                            <h2 className="text-xl font-black uppercase">
                                {isRejected
                                    ? `Rejected ${isVideo ? 'Thumbnail' : 'Creative'} Upload`
                                    : isRework
                                        ? `Rework ${isVideo ? 'Thumbnail' : 'Creative'} Upload`
                                        : `${isVideo ? 'Thumbnail' : 'Creative'} Upload`}
                            </h2>
                        </div>

                        {/* SHOW OLD ASSET IF EXISTS */}
                        {hasAsset && (
                            <div className="bg-gray-50 border-2 border-gray-400 p-4 mb-4">
                                <p className="text-sm font-bold uppercase text-gray-700 mb-2">
                                    Previous {isVideo ? 'Thumbnail' : 'Creative'}
                                </p>
                                <a
                                    href={isVideo ? project.thumbnail_link : (project.creative_link || project.data?.creative_link)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block break-all text-blue-600 underline"
                                >
                                    {isVideo ? project.thumbnail_link : (project.creative_link || project.data?.creative_link)}
                                </a>
                            </div>
                        )}

                        {/* Show input if user has edit permissions */}
                        {(canEdit || !hasAsset) && (
                            <div className="space-y-4">
                                <p className="text-slate-600 font-medium">
                                    {isRejected
                                        ? `Upload new ${isVideo ? 'thumbnail' : 'creative'} link for rejected project`
                                        : isRework
                                            ? `Upload new ${isVideo ? 'thumbnail' : 'creative'} link for rework`
                                            : `Upload ${isVideo ? 'thumbnail' : 'creative'} link`}
                                </p>

                                <div className="flex gap-3">
                                    <input
                                        type="url"
                                        value={isVideo ? thumbnailLink : creativeLink}
                                        onChange={(e) =>
                                            isVideo
                                                ? setThumbnailLink(e.target.value)
                                                : setCreativeLink(e.target.value)
                                        }
                                        placeholder="https://drive.google.com/file/d/..."
                                        className="flex-1 p-4 border-2 border-black text-lg focus:bg-yellow-50 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleUploadFile}
                                        className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                    >
                                        <Upload className="w-5 h-5 inline mr-2" />
                                        {isRejected ? 'Submit Rejected Design' : isRework ? 'Submit Rework Design' : 'Upload'}
                                    </button>
                                </div>

                                <p className="text-sm text-slate-500">
                                    ✨ Once uploaded, CMO will be notified for final review
                                </p>
                            </div>
                        )}

                        {/* FINAL STATE — ONLY IF NOT REWORK */}
                        {hasAsset && !isRework && (
                            <div className="bg-green-50 border-2 border-green-600 p-4 mt-4">
                                <p className="text-sm font-bold uppercase text-green-800">
                                    ✓ {isVideo ? 'Thumbnail' : 'Creative'} Delivered
                                </p>
                                <p className="text-sm text-green-800 mt-1">
                                    → Project has been moved to CMO for final review
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* New Direct Upload Section - For Designer to upload assets directly */}



                {/* Project Info */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <h2 className="text-xl font-black uppercase mb-4">Project Details</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Status</span>
                            <p className="font-bold text-slate-900 mt-1">{project.status}</p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Priority</span>
                            <p className="font-bold text-slate-900 mt-1">{project.priority}</p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Created</span>
                            <p className="font-bold text-slate-900 mt-1">
                                {format(new Date(project.created_at), 'MMM dd, yyyy h:mm a')}
                            </p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-400 uppercase text-xs">Content Type</span>
                            <p className="font-bold text-slate-900 mt-1">{project.content_type}</p>
                        </div>
                        {project.data?.niche && (
                            <div className="col-span-2">
                                <span className="font-bold text-slate-400 uppercase text-xs">Niche</span>
                                <p className="font-bold text-slate-900 mt-1 uppercase">
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
            </div>
            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    duration={popupDuration}
                    onClose={() => {
                        setShowPopup(false);
                        onUpdate();
                    }}
                />
            )}
        </div>
    );
};

export default DesignerProjectDetail;