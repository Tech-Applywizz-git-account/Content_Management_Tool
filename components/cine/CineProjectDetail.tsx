import React, { useState, useEffect } from 'react';
import { Project, WorkflowStage, Role, STAGE_LABELS, TaskStatus } from '../../types';
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import Popup from '../Popup';
import { getWorkflowState, canUserEdit, getLatestReworkRejectComment } from '../../services/workflowUtils';

interface Props {
    project: Project;
    userRole: Role;
    onBack: () => void;
    onUpdate: () => void;
    fromView?: 'MYWORK' | 'SCRIPTS';
}

const CineProjectDetail: React.FC<Props> = ({ project: initialProject, userRole, onBack, onUpdate, fromView }) => {
    // For rework projects, keep existing data but track new inputs
    const processedProject = { ...initialProject };

    const [localProject, setLocalProject] = useState<Project>(processedProject);

    const isReworkProject = (project: Project) =>
        project.history?.some(h =>
            h.action?.startsWith('REWORK_')
        );

    // Use the new workflow state logic
    const workflowState = getWorkflowState(localProject);
    const isRework = workflowState.isRework;
    const isRejected = workflowState.isRejected;

    // Determine if current user can edit based on role and workflow state
    const canEdit = canUserEdit(userRole, workflowState, localProject.assigned_to_role);

    // Check if this project is currently assigned to the Cine role
    const isCurrentlyAssignedToCine = localProject.current_stage === WorkflowStage.CINEMATOGRAPHY && localProject.assigned_to_role === 'CINE';


    const [shootDate, setShootDate] = useState(processedProject.shoot_date || '');

    const [videoLink, setVideoLink] = useState(processedProject.video_link || '');



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
        setLocalProject(processedProject);
    }, [initialProject]);

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
            const workflowState = getWorkflowState(localProject);
            const isRework = workflowState.isRework;
            const isRejected = workflowState.isRejected;

            // Record the action in workflow history before updating the project
            const actionType = isRework ? 'REWORK_VIDEO_SUBMITTED' : 'CINE_VIDEO_UPLOADED';
            const comment = isRework
                ? `Rework video uploaded: ${videoLink}`
                : `Raw video uploaded: ${videoLink}`;

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
            await db.projects.update(localProject.id, {
                video_link: videoLink,
                cine_uploaded_at: new Date().toISOString(),
                status: TaskStatus.WAITING_APPROVAL
            });

            // Advance workflow to next stage based on project settings
            await db.advanceWorkflow(localProject.id, comment);

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
                            <span className="text-sm text-slate-500 font-bold">
                                Due: {format(new Date(localProject.due_date), 'MMM dd, yyyy h:mm a')}
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
            {(isRework || isRejected) && localProject.history && localProject.history.length > 0 && (
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
                                {getLatestReworkRejectComment(localProject)?.comment || 'No specific reason provided. Please review your submission and make necessary changes.'}
                            </p>
                            <p className="text-sm text-red-600 mt-2">
                                {isRejected ? 'Rejected by' : 'Feedback from'} {getLatestReworkRejectComment(localProject)?.actor_name || 'Reviewer'}
                            </p>
                        </div>

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
                {/* Script Content */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5" />
                        <h2 className="text-xl font-black uppercase">Script</h2>
                    </div>
                    <div className="bg-slate-50 border-2 border-slate-200 p-4 font-serif text-slate-900 leading-relaxed">
                        {localProject.data.script_content || 'No script content available'}
                    </div>
                </div>

                {/* Cinematography Instructions */}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-black uppercase">Cinematography Instructions</h2>
                        {!isCurrentlyAssignedToCine && (
                            <span className="px-3 py-1 text-xs font-bold uppercase border-2 border-blue-500 bg-blue-100 text-blue-800">
                                Preview Only
                            </span>
                        )}
                    </div>

                    {/* Thumbnail Reference from Writer */}
                    {localProject.data?.thumbnail_reference_link && (
                        <div className="mb-6 pt-6 border-t-2 border-gray-200">
                            <h3 className="text-lg font-black uppercase mb-3">Writer's Thumbnail Reference</h3>
                            <div className="bg-blue-50 border-2 border-blue-200 p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold uppercase text-blue-800 mb-1">Reference Thumbnail Link</p>
                                        <a
                                            href={localProject.data.thumbnail_reference_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all font-medium"
                                        >
                                            {localProject.data.thumbnail_reference_link}
                                        </a>
                                    </div>
                                </div>
                                <p className="text-xs text-blue-600 mt-2 italic">This is the thumbnail provided by the writer for reference</p>
                            </div>
                        </div>
                    )}

                    {/* Writer Name */}
                    {localProject.data.writer_name && (
                        <div className="mb-4">
                            <span className="text-sm font-bold text-slate-500 uppercase">Writer</span>
                            <p className="font-medium text-slate-900">{localProject.data.writer_name}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-slate-500 uppercase mb-2 block">Actor</label>
                            <input
                                type="text"
                                value={localProject.data.actor || ''}
                                onChange={(e) => setLocalProject(prev => ({
                                    ...prev,
                                    data: {
                                        ...prev.data,
                                        actor: e.target.value
                                    }
                                }))}
                                disabled={!canEdit}
                                className={`w-full p-2 border-2 border-black font-medium ${canEdit ? 'focus:bg-yellow-50 focus:outline-none' : 'bg-gray-100'}`}
                                placeholder="e.g. Female presenter, 30s, business attire"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-500 uppercase mb-2 block">Location</label>
                            <input
                                type="text"
                                value={localProject.data.location || ''}
                                onChange={(e) => setLocalProject(prev => ({
                                    ...prev,
                                    data: {
                                        ...prev.data,
                                        location: e.target.value
                                    }
                                }))}
                                disabled={!canEdit}
                                className={`w-full p-2 border-2 border-black font-medium ${canEdit ? 'focus:bg-yellow-50 focus:outline-none' : 'bg-gray-100'}`}
                                placeholder="e.g. Office, studio, outdoor street"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-500 uppercase mb-2 block">Lighting</label>
                            <input
                                type="text"
                                value={localProject.data.lighting || ''}
                                onChange={(e) => setLocalProject(prev => ({
                                    ...prev,
                                    data: {
                                        ...prev.data,
                                        lighting: e.target.value
                                    }
                                }))}
                                disabled={!canEdit}
                                className={`w-full p-2 border-2 border-black font-medium ${canEdit ? 'focus:bg-yellow-50 focus:outline-none' : 'bg-gray-100'}`}
                                placeholder="e.g. Soft daylight, cinematic, low-key"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-500 uppercase mb-2 block">Angles</label>
                            <input
                                type="text"
                                value={localProject.data.angles || ''}
                                onChange={(e) => setLocalProject(prev => ({
                                    ...prev,
                                    data: {
                                        ...prev.data,
                                        angles: e.target.value
                                    }
                                }))}
                                disabled={!canEdit}
                                className={`w-full p-2 border-2 border-black font-medium ${canEdit ? 'focus:bg-yellow-50 focus:outline-none' : 'bg-gray-100'}`}
                                placeholder="e.g. Medium shot, close-up, over-the-shoulder"
                            />
                        </div>
                    </div>

                    {/* Thumbnail Upload Section - Only show if thumbnail_required is true */}
                    {localProject.data.thumbnail_required && (
                        <div className="mt-6 pt-6 border-t-2 border-gray-200">
                            <h3 className="text-lg font-black uppercase mb-4">Thumbnail Assets</h3>
                            <div>
                                <label className="text-sm font-bold text-slate-500 uppercase mb-2 block">Thumbnail Drive Link</label>
                                <input
                                    type="text"
                                    value={localProject.data.cine_thumbnail_link || ''}
                                    onChange={(e) => setLocalProject(prev => ({
                                        ...prev,
                                        data: {
                                            ...prev.data,
                                            cine_thumbnail_link: e.target.value
                                        }
                                    }))}
                                    disabled={!canEdit}
                                    className={`w-full p-2 border-2 border-black font-medium ${canEdit ? 'focus:bg-yellow-50 focus:outline-none' : 'bg-gray-100'}`}
                                    placeholder="Paste Google Drive link for thumbnail assets"
                                />
                                <p className="text-xs text-slate-500 mt-1">This link will be shared with the Designer for thumbnail creation</p>
                            </div>
                        </div>
                    )}

                    {/* Save Button for Cinematography Fields */}
                    {canEdit && (
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={async () => {
                                    try {
                                        await db.updateProjectData(localProject.id, {
                                            ...localProject.data,
                                            actor: localProject.data.actor,
                                            location: localProject.data.location,
                                            lighting: localProject.data.lighting,
                                            angles: localProject.data.angles,
                                            cine_thumbnail_link: localProject.data.cine_thumbnail_link
                                        });

                                        // Show success message
                                        setPopupMessage('Cinematography instructions updated successfully');
                                        setStageName('Updated');
                                        setShowPopup(true);
                                        setPopupDuration(3000);
                                    } catch (error) {
                                        console.error('Error updating cinematography instructions:', error);
                                        alert('Failed to update cinematography instructions');
                                    }
                                }}
                                className="px-4 py-2 bg-[#0085FF] text-white font-bold uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                            >
                                Save Instructions
                            </button>
                        </div>
                    )}
                </div>



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

export default CineProjectDetail;