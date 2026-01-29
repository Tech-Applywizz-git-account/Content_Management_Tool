import React, { useState, useEffect } from 'react';
import { Project, WorkflowStage, Role, STAGE_LABELS, TaskStatus } from '../../types';
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, FileText, FileImage, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { stripHtmlTags, decodeHtmlEntities } from '../../utils/htmlDecoder';
import Popup from '../Popup';
import { isActiveRework, getCanonicalReworkComment, canUserEdit } from '../../services/workflowUtils';
import ReworkSection from '../ReworkSection';
import ScriptDisplay from '../ScriptDisplay';

interface Props {
    project: Project;
    userRole: Role;
    onBack: () => void;
    onUpdate: () => void;
}

const DesignerProjectDetail: React.FC<Props> = ({ project, userRole, onBack, onUpdate }) => {
    // For rework projects, keep existing data but track new inputs
    const processedProject = { ...project };

    const [localProject, setLocalProject] = useState<Project>(project);
    const [deliveryDate, setDeliveryDate] = useState(processedProject.delivery_date || '');

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState(5000); // Default 5 seconds
    const [thumbnailLink, setThumbnailLink] = useState(processedProject.thumbnail_link || '');
    const [creativeLink, setCreativeLink] = useState(processedProject.creative_link || processedProject.data?.creative_link || '');

    const isVideo = project.content_type === 'VIDEO';
    // Use canonical rework condition
    const isRework = isActiveRework(localProject, userRole);

    // Maintain isRejected if needed for specific UI states, but isActiveRework is the primary driver
    const isRejected = localProject.status === TaskStatus.REJECTED && localProject.assigned_to_role === userRole;

    // Determine if current user can edit based on role and workflow state
    // Additional check for role-based access: if the current stage is THUMBNAIL_DESIGN/CREATIVE_DESIGN and user role is DESIGNER,
    // and the project is assigned to DESIGNER role, then allow access regardless of other factors
    const roleBasedAccess = ((localProject.current_stage === 'THUMBNAIL_DESIGN' || localProject.current_stage === 'CREATIVE_DESIGN') &&
        userRole === 'DESIGNER' &&
        localProject.assigned_to_role === 'DESIGNER');

    const canEdit = roleBasedAccess || canUserEdit(userRole, { isRework, isRejected, isTargetedRework: isRework, isInReview: false, isApproved: false, latestAction: null }, localProject.assigned_to_role, localProject.current_stage) || isRework;

    const hasAsset = isVideo
        ? !!localProject.thumbnail_link
        : !!localProject.creative_link || !!localProject.data?.creative_link;


    // Reset form fields when project changes
    useEffect(() => {
        // For rework projects, keep existing data
        const processedProject = { ...project };
        setDeliveryDate(processedProject.delivery_date || '');
        setThumbnailLink(processedProject.thumbnail_link || '');
        setCreativeLink(processedProject.creative_link || '');
        setLocalProject(project); // Update localProject when the prop changes
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
                localProject.id,
                localProject.current_stage, // stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                'SET_DELIVERY_DATE', // specific action
                `Delivery date set to ${deliveryDate}`
            );

            // Update the project with the delivery date but keep it in current stage
            // The stage only changes when the file is uploaded
            await db.projects.update(localProject.id, { delivery_date: deliveryDate });
            console.log(`Delivery date set: ${deliveryDate}`);

            // Show popup notification (include calendar visibility and derive stage label)
            const stageLabel = isVideo ? STAGE_LABELS[WorkflowStage.THUMBNAIL_DESIGN] : STAGE_LABELS[WorkflowStage.CREATIVE_DESIGN];
            setPopupMessage(`Delivery date set for ${localProject.title} on ${deliveryDate}. This date will be visible on calendars for all team members.`);
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
                localProject.id,
                localProject.current_stage, // Record action at current stage
                user.id,
                user.email || user.id, // userName (using email or ID as fallback)
                actionType, // Use appropriate action value
                comment
            );

            // Prepare the designer video links history array
            const currentAssetLink = isVideo ? localProject.thumbnail_link : (localProject.creative_link || localProject.data?.creative_link);
            const updatedDesignerVideoLinksHistory = [
                ...(project.designer_video_links_history || []),
                // Add the previous asset link if it exists and is different from the new one
                ...(currentAssetLink && currentAssetLink !== link
                    ? [currentAssetLink]
                    : [])
            ];

            // Update the project with the file link and advance the workflow
            // This will properly route to the correct next stage
            const updates: Partial<Project> = {};

            if (isVideo) {
                updates.thumbnail_link = link;
            } else {
                updates.creative_link = link;
            }

            // Prepare update for cmo_rework_context
            let updatedCmoReworkContext = localProject.data?.cmo_rework_context;

            if (isRework && updatedCmoReworkContext?.before) {
                updatedCmoReworkContext = {
                    ...updatedCmoReworkContext,
                    after: {
                        video_link: localProject.video_link || null,
                        edited_video_link: localProject.edited_video_link || null,
                        thumbnail_link: isVideo ? link : (localProject.thumbnail_link || null),
                        creative_link: !isVideo ? link : (localProject.data?.creative_link || localProject.creative_link || null),
                        script_content: localProject.data?.script_content || null
                    }
                };
            }

            await db.projects.update(localProject.id, {
                ...updates,
                designer_video_links_history: updatedDesignerVideoLinksHistory, // Store the history of video links
                designer_uploaded_at: new Date().toISOString(), // Store timestamp
                designer_name: user?.user_metadata?.full_name || user?.email || 'Unknown Designer', // Store designer name in direct column
                data: {
                    ...localProject.data,
                    cmo_rework_context: updatedCmoReworkContext
                }
            });

            // Update project data to persist any changes made during this session
            // Include the asset links in the update so timestamp logic can detect the upload
            const projectDataUpdates: any = { ...localProject.data };
            if (isVideo) {
                projectDataUpdates.thumbnail_link = link;
            } else {
                projectDataUpdates.creative_link = link;
            }

            await db.updateProjectData(localProject.id, projectDataUpdates);

            // Advance workflow to next stage based on project settings
            await db.advanceWorkflow(localProject.id, comment);

            console.log(`${isRework ? 'Rework ' : ''}${isVideo ? 'Thumbnail' : 'Creative'} uploaded: ${link}`);

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
                                'New Thumbnail/Creative Available',
                                `${user?.user_metadata?.full_name || 'Designer'} has uploaded ${isVideo ? 'a thumbnail' : 'a creative'} for: ${localProject.title}. Please review and proceed with ${STAGE_LABELS[updatedProject.current_stage] || updatedProject.current_stage.replace(/_/g, ' ')}.`
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
                ? `Rework ${isVideo ? 'thumbnail' : 'creative'} uploaded successfully for ${localProject.title}. Waiting for ${actualNextStageLabel}.`
                : `${isVideo ? 'Thumbnail' : 'Creative'} uploaded successfully for ${localProject.title}. Waiting for ${actualNextStageLabel}.`;

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
                localProject.id,
                localProject.current_stage, // Record action at current stage
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

            await db.projects.update(localProject.id, {
                ...updates,
                designer_uploaded_at: new Date().toISOString(), // Store timestamp
                designer_name: user?.user_metadata?.full_name || user?.email || 'Unknown Designer', // Store designer name in direct column
                data: {
                    ...localProject.data
                }
            });

            // Skip to CMO review stage directly
            await db.workflow.approve(
                localProject.id,
                user.id,
                user.email || user.id,
                userRole,
                WorkflowStage.FINAL_REVIEW_CMO, // Skip to CMO review
                Role.CMO,
                `Direct upload to CMO review: ${link}`
            );

            console.log(`Direct ${isVideo ? 'thumbnail' : 'creative'} uploaded: ${link}`);

            // Get updated project to determine who to notify
            const updatedProject = await db.getProjectById(localProject.id);

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
                            localProject.id,
                            'ASSET_UPLOADED',
                            'New Direct Upload Available',
                            `${user?.user_metadata?.full_name || 'Designer'} has uploaded ${isVideo ? 'a thumbnail' : 'a creative'} directly for: ${localProject.title}. Please review and proceed with ${STAGE_LABELS[WorkflowStage.FINAL_REVIEW_CMO] || 'Final Review CMO'}.`
                        );
                    } catch (notificationError) {
                        console.error('Failed to send notification:', notificationError);
                        // Continue with the process even if notification fails
                    }
                }
            }

            // Show popup notification
            const nextStageLabel = STAGE_LABELS[WorkflowStage.FINAL_REVIEW_CMO] || 'Final Review CMO';
            setPopupMessage(`${isVideo ? 'Thumbnail' : 'Creative'} uploaded directly for ${localProject.title}. Sent to ${nextStageLabel}.`);
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
                                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${isVideo ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                    }`}
                            >
                                {isVideo ? '🎬 Thumbnail Task' : '🎨 Creative Task'}
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

            {/* Rework Information Section */}
            {(isRework || isRejected) && (
                <div className="max-w-6xl mx-auto px-6 pt-8">
                    <ReworkSection project={localProject} userRole={userRole} />
                </div>
            )}

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Edited Video (for thumbnail tasks) */}
                {isVideo && localProject.edited_video_link && (
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
                                href={localProject.edited_video_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-white border-2 border-blue-400 text-blue-600 font-medium hover:bg-blue-50 transition-colors break-all"
                            >
                                {localProject.edited_video_link}
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
                    <ScriptDisplay content={localProject.data.script_content || ''} />
                </div>

                {/* Thumbnail Requirements - Show if video and thumbnail required */}
                {isVideo && localProject.data.thumbnail_required && (
                    <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Palette className="w-5 h-5" />
                            <h2 className="text-xl font-black uppercase">Thumbnail Requirements</h2>
                        </div>
                        <div className="space-y-4">
                            {localProject.data.thumbnail_reference_link && (
                                <div>
                                    <p className="font-bold text-slate-500 uppercase text-xs mb-1">Reference Thumbnail</p>
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

                            {localProject.data.thumbnail_notes && (
                                <div>
                                    <p className="font-bold text-slate-500 uppercase text-xs mb-1">Thumbnail Notes</p>
                                    <div className="bg-slate-50 border-2 border-slate-200 p-4 font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                                        {localProject.data.thumbnail_notes}
                                    </div>
                                </div>
                            )}

                            {/* Thumbnail Photos from Cinematographer */}
                            {localProject.data.cine_thumbnail_photos && localProject.data.cine_thumbnail_photos.length > 0 && (
                                <div>
                                    <p className="font-bold text-slate-500 uppercase text-xs mb-2">Cinematographer's Photos</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {localProject.data.cine_thumbnail_photos.map((photo: string, index: number) => (
                                            <a
                                                key={index}
                                                href={photo}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block p-3 bg-white border-2 border-purple-400 text-purple-600 font-medium hover:bg-purple-50 transition-colors truncate"
                                            >
                                                Photo {index + 1}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!localProject.data.thumbnail_reference_link && !localProject.data.thumbnail_notes && !localProject.data.cine_thumbnail_link && (!localProject.data.cine_thumbnail_photos || localProject.data.cine_thumbnail_photos.length === 0) && (
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

                {/* Upload Section - Show if delivery_date exists OR during rework */}
                {(project.delivery_date || isRework) && (
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

                        {/* SHOW OLD ASSET IF EXISTS and it's a rework */}
                        {isRework && hasAsset && (
                            <div className="bg-blue-50 border-2 border-blue-600 p-4 mb-4">
                                <p className="text-sm font-bold uppercase text-blue-800 mb-2">
                                    Previous Submission
                                </p>
                                <a
                                    href={isVideo ? localProject.thumbnail_link : (localProject.creative_link || localProject.data?.creative_link)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block break-all text-blue-600 underline"
                                >
                                    {isVideo ? localProject.thumbnail_link : (localProject.creative_link || localProject.data?.creative_link)}
                                </a>
                            </div>
                        )}

                        {/* Show input if user has edit permissions OR is in rework */}
                        {(isRework || canEdit || !hasAsset) && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-slate-600 font-medium">
                                        {isRework
                                            ? `Upload New Version (Rework)`
                                            : `Upload ${isVideo ? 'Thumbnail' : 'Creative'} Link`}
                                    </p>
                                    {isRework && (
                                        <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold uppercase border border-red-200">
                                            Comparison Mode Active
                                        </span>
                                    )}
                                </div>

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

                        {/* FINAL STATE — ONLY IF NOT REWORK - Check status explicitly to override historical data */}
                        {hasAsset && !isRework && localProject.status !== 'REWORK' && (
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
                            <p className="font-bold text-slate-900 mt-1">{localProject.priority}</p>
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
            {
                showPopup && (
                    <Popup
                        message={popupMessage}
                        stageName={stageName}
                        duration={popupDuration}
                        onClose={() => {
                            setShowPopup(false);
                            onUpdate();
                        }}
                    />
                )
            }
        </div >
    );
};

export default DesignerProjectDetail;
