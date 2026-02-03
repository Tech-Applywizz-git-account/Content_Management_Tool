import React, { useState, useRef, useEffect } from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, TaskStatus, Channel } from '../../types';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { ArrowLeft, Check, RotateCcw, X, Video, Image as ImageIcon, Download } from 'lucide-react';
import Popup from '../Popup';
import ScriptComparison from '../ScriptComparison';
import ScriptDisplay from '../ScriptDisplay';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getWorkflowState } from '../../services/workflowUtils';
import { decodeHtmlEntities, stripHtmlTags } from '../../utils/htmlDecoder';

interface Props {
    project: Project;
    onBack: () => void;
    onComplete: () => void;
}

const CmoReviewScreen: React.FC<Props> = ({ project, onBack, onComplete }) => {
    const [decision, setDecision] = useState<'APPROVE' | 'REWORK' | 'REJECT' | null>(null);
    const [comment, setComment] = useState('');
    const [reworkStage, setReworkStage] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previousScript, setPreviousScript] = useState<string | null>(null);
    const [previousAssets, setPreviousAssets] = useState<{
        video_link: string | null;
        edited_video_link: string | null;
        thumbnail_link: string | null;
        creative_link: string | null;
    } | null>(null);

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState<number>(5000);

    // Confirmation popup state
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationAction, setConfirmationAction] = useState<'APPROVE' | 'REWORK' | 'REJECT' | null>(null);

    const isFinalReview = project.current_stage === WorkflowStage.FINAL_REVIEW_CMO || project.current_stage === WorkflowStage.POST_WRITER_REVIEW;
    const isVideo = project.channel !== Channel.LINKEDIN;

    const scriptContentRef = useRef<HTMLDivElement>(null);


    // Effect to track when CMO opens the project for the first time
    useEffect(() => {
        const trackProjectOpen = async () => {
            try {
                // Check if this is the first time the project is being opened by a reviewer
                if (!project.first_review_opened_at && !project.first_review_opened_by_role) {
                    // Update the project to record that it was opened by CMO
                    await db.projects.update(project.id, {
                        first_review_opened_at: new Date().toISOString(),
                        first_review_opened_by_role: Role.CMO
                    });
                }
            } catch (error) {
                console.error('Error tracking project open:', error);
            }
        };

        trackProjectOpen();
    }, [project.id, project.first_review_opened_at, project.first_review_opened_by_role]);

    const getReworkRoleLabel = (stage: WorkflowStage) => {
        switch (stage) {
            case WorkflowStage.SCRIPT:
                return 'Writer';
            case WorkflowStage.VIDEO_EDITING:
                return 'Editor';
            case WorkflowStage.CINEMATOGRAPHY:
                return 'Cinematographer';
            case WorkflowStage.CREATIVE_DESIGN:
                return 'Designer';
            default:
                return 'Team';
        }
    };


    const [reworkTargetRole, setReworkTargetRole] = useState<Role | null>(null);

    useEffect(() => {
        const fetchPreviousVersion = async () => {
            console.log('CMO Review: Starting fetchPreviousVersion for project:', project.id);

            // Fetch history to find the last rework action
            const { data: historyData, error: historyError } = await supabase
                .from('workflow_history')
                .select('script_content, video_link, edited_video_link, thumbnail_link, creative_link, action, actor_name, timestamp, stage, to_stage, to_role, metadata')
                .eq('project_id', project.id)
                .order('timestamp', { ascending: false })
                .limit(50);

            if (historyError) {
                console.error('Error fetching history:', historyError);
                return;
            }

            if (!historyData || historyData.length === 0) {
                console.log('CMO Review: No history data found for project:', project.id);
                setPreviousScript(null);
                setPreviousAssets(null);
                setReworkTargetRole(null);
                return;
            }

            // Find the most recent REWORK or REJECT action
            // This represents the point where the project was sent back
            const lastReworkIndex = historyData.findIndex(entry =>
                ['REWORK', 'REJECTED'].includes(entry.action)
            );

            console.log('CMO Review: Last rework index:', lastReworkIndex);

            if (lastReworkIndex !== -1) {
                const reworkEntry = historyData[lastReworkIndex];
                console.log('CMO Review: Found rework entry at:', reworkEntry.timestamp);

                const recentHistory = historyData.slice(0, lastReworkIndex);

                // Identify who the rework was targeted AT
                let detectedRole: Role | null = null;
                let metadataBasedAssets: any = null;

                // 1. Check for metadata-rich rework submission actions first (Robust approach)
                const reworkSubmission = recentHistory.find(h => h.action.startsWith('REWORK_') && h.metadata);
                if (reworkSubmission?.metadata?.before_link) {
                    const meta = reworkSubmission.metadata;
                    detectedRole = meta.reworked_by_role;
                    if (detectedRole === Role.CINE) metadataBasedAssets = { video_link: meta.before_link };
                    else if (detectedRole === Role.EDITOR || detectedRole === Role.SUB_EDITOR) metadataBasedAssets = { edited_video_link: meta.before_link };
                    else if (detectedRole === Role.DESIGNER) metadataBasedAssets = { thumbnail_link: meta.before_link, creative_link: meta.before_link };
                }

                if (!detectedRole) {
                    // 2. Try to determine from the rework entry itself (Best source)
                    if (reworkEntry.to_stage) {
                        if (reworkEntry.to_stage === WorkflowStage.VIDEO_EDITING) detectedRole = Role.EDITOR;
                        else if (reworkEntry.to_stage === WorkflowStage.CINEMATOGRAPHY) detectedRole = Role.CINE;
                        else if (reworkEntry.to_stage === WorkflowStage.THUMBNAIL_DESIGN || reworkEntry.to_stage === WorkflowStage.CREATIVE_DESIGN) detectedRole = Role.DESIGNER;
                    }

                    if (!detectedRole && reworkEntry.to_role) {
                        // Normalize string to Role enum if possible
                        if ((Object.values(Role) as string[]).includes(reworkEntry.to_role)) {
                            detectedRole = reworkEntry.to_role as Role;
                        }
                    }

                    // 3. Try checking metadata from rework submission actions first (Most robust)
                    const reworkSubmission = recentHistory.find(h => h.action.startsWith('REWORK_') && h.metadata);
                    if (reworkSubmission?.metadata?.reworked_by_role) {
                        detectedRole = reworkSubmission.metadata.reworked_by_role;
                    }

                    // 4. Try inferring from explicit submission actions in recent history (Legacy/Fallback)
                    if (!detectedRole) {
                        // Check for explicit rework submission actions first
                        if (recentHistory.some(h => h.action === 'REWORK_EDIT_SUBMITTED')) {
                            detectedRole = Role.EDITOR;
                        } else if (recentHistory.some(h => h.action === 'REWORK_VIDEO_SUBMITTED')) {
                            detectedRole = Role.CINE;
                        } else if (recentHistory.some(h => h.action === 'REWORK_DESIGN_SUBMITTED')) {
                            detectedRole = Role.DESIGNER;
                        }
                    }

                    // 4. Fallback: Infer from what changed
                    if (!detectedRole) {
                        // Check logic: if current value != rework value, that field changed.
                        // Prioritize EDITOR if edited_video_link changed, as it's later in workflow than CINE
                        if (project.edited_video_link && project.edited_video_link !== reworkEntry.edited_video_link) {
                            detectedRole = Role.EDITOR;
                        } else if (project.video_link && project.video_link !== reworkEntry.video_link) {
                            detectedRole = Role.CINE;
                        } else if ((project.thumbnail_link && project.thumbnail_link !== reworkEntry.thumbnail_link) ||
                            (project.data?.creative_link && project.data?.creative_link !== reworkEntry.creative_link)) {
                            detectedRole = Role.DESIGNER;
                        }

                        // Legacy/Safe fallback - if seemingly nothing changed or confused, but we are in review
                        if (!detectedRole && recentHistory.some(h => h.action === 'SUBMITTED' || h.action === 'WRITER_SUBMIT')) {
                            // If we have an edited video link, assume Editor unless we have strong reason otherwise
                            if (project.edited_video_link) detectedRole = Role.EDITOR;
                        }
                    }
                }

                setReworkTargetRole(detectedRole);

                // The state "before" or "during" the rework request is what we want to compare against
                // If the rework action entry itself has the snapshot of the "bad" state, we use that.
                // Usually, the history entry records the state of the project *at the time of the action*.

                // So, the rework entry contains the "Old" assets/script that were rejected.

                // Set previous script
                if (reworkEntry.script_content) {
                    setPreviousScript(reworkEntry.script_content);
                }

                // Helper to get last history item
                const getLastHistoryItem = (historyStrOrArray: any) => {
                    if (!historyStrOrArray) return null;
                    if (Array.isArray(historyStrOrArray)) return historyStrOrArray[historyStrOrArray.length - 1];
                    try {
                        const parsed = typeof historyStrOrArray === 'string' ? JSON.parse(historyStrOrArray) : historyStrOrArray;
                        if (Array.isArray(parsed)) return parsed[parsed.length - 1];
                    } catch (e) { return null; }
                    return null;
                };

                // Set previous assets with fallbacks to history columns
                setPreviousAssets({
                    video_link: metadataBasedAssets?.video_link || reworkEntry.video_link || getLastHistoryItem(project.cine_video_links_history),
                    edited_video_link: metadataBasedAssets?.edited_video_link || reworkEntry.edited_video_link || getLastHistoryItem(project.editor_video_links_history) || getLastHistoryItem(project.sub_editor_video_links_history),
                    thumbnail_link: metadataBasedAssets?.thumbnail_link || reworkEntry.thumbnail_link || (project.thumbnail_link ? getLastHistoryItem(project.designer_video_links_history) : null),
                    creative_link: metadataBasedAssets?.creative_link || reworkEntry.creative_link || (!project.thumbnail_link ? getLastHistoryItem(project.designer_video_links_history) : null)
                });

            } else {
                console.log('CMO Review: No recent rework found in history');
                setPreviousScript(null);
                setPreviousAssets(null);
                setReworkTargetRole(null);
            }
        };

        fetchPreviousVersion();
    }, [project.id, project.cmo_rework_at, project.writer_submitted_at]);

    const downloadPDF = async () => {
        if (!scriptContentRef.current) return;

        try {
            // Create a clone of the content to avoid styling issues
            const clone = scriptContentRef.current.cloneNode(true) as HTMLElement;

            // Create a temporary container
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.width = '800px'; // Standard PDF width
            tempContainer.style.padding = '20px';
            tempContainer.appendChild(clone);
            document.body.appendChild(tempContainer);

            // Convert to canvas
            const canvas = await html2canvas(tempContainer, {
                scale: 2, // Higher quality
                useCORS: true,
                logging: false
            });

            // Convert to PDF
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });

            const imgWidth = pdf.internal.pageSize.getWidth();
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`${project.title}_script.pdf`);

            // Clean up
            document.body.removeChild(tempContainer);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);

        try {
            if (decision === 'APPROVE') {
                // CMO Approval -> Moves to next stage based on current stage

                // Use workflow.approve() for MULTI_WRITER_APPROVAL or POST_WRITER_REVIEW stages
                // as these require special handling for multi-writer approval processes
                if (project.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL ||
                    project.current_stage === WorkflowStage.POST_WRITER_REVIEW) {
                    // For these stages, determine the next stage according to the helpers.getNextStage function
                    const nextStageInfo = db.helpers.getNextStage(
                        project.current_stage,
                        project.content_type,
                        'APPROVED',
                        project.data
                    );

                    // Ensure we have a valid user ID
                    const currentUser = db.getCurrentUser();
                    if (!currentUser?.id) {
                        throw new Error('User not authenticated');
                    }

                    await db.workflow.approve(
                        project.id,
                        currentUser.id,
                        currentUser.full_name || 'CMO',
                        Role.CMO,
                        nextStageInfo.stage,
                        nextStageInfo.role,
                        comment || 'Approved by CMO'
                    );
                } else {
                    // For rework projects and final review, ensure proper stage advancement
                    // Check if this is a rework scenario based on the presence of rework timestamps
                    const isReworkScenario = project.cmo_rework_at && project.writer_submitted_at &&
                        new Date(project.writer_submitted_at) > new Date(project.cmo_rework_at);

                    if (isReworkScenario || project.current_stage === WorkflowStage.FINAL_REVIEW_CMO) {
                        // For rework scenarios, use the standardized workflow advancement
                        const nextStageInfo = db.helpers.getNextStage(
                            project.current_stage,
                            project.content_type,
                            'APPROVED',
                            project.data
                        );

                        // Ensure we have a valid user ID
                        const currentUser = db.getCurrentUser();
                        if (!currentUser?.id) {
                            throw new Error('User not authenticated');
                        }

                        await db.workflow.approve(
                            project.id,
                            currentUser.id,
                            currentUser.full_name || 'CMO',
                            Role.CMO,
                            nextStageInfo.stage,
                            nextStageInfo.role,
                            comment || 'Approved by CMO'
                        );
                    } else {
                        // Ensure we have a valid user ID
                        const currentUser = db.getCurrentUser();
                        if (!currentUser?.id) {
                            throw new Error('User not authenticated');
                        }

                        await db.advanceWorkflow(project.id, comment || 'Approved by CMO');
                    }
                }

                // Store comments in forwarded_comments if comment exists
                if (comment && comment.trim() !== '') {
                    const newComment = {
                        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
                        from_role: Role.CMO,
                        to_role: project.current_stage === WorkflowStage.FINAL_REVIEW_CMO || project.current_stage === WorkflowStage.POST_WRITER_REVIEW ? 'CEO' : 'CINEMATOGRAPHER',
                        comment: comment,
                        created_at: new Date().toISOString(),
                        action: 'APPROVED'
                    };

                    const { data: currentProject, error: fetchError } = await supabase
                        .from('projects')
                        .select('forwarded_comments')
                        .eq('id', project.id)
                        .single();

                    if (!fetchError) {
                        const existingComments = currentProject.forwarded_comments || [];
                        const updatedComments = [...existingComments, newComment];

                        const { error: updateError } = await supabase
                            .from('projects')
                            .update({ forwarded_comments: updatedComments })
                            .eq('id', project.id);

                        if (updateError) {
                            console.error('Failed to save forwarded comment:', updateError);
                        }
                    }
                }

                // Show popup for approval
                let stageLabel, message;
                if (project.current_stage === WorkflowStage.FINAL_REVIEW_CMO || project.current_stage === WorkflowStage.POST_WRITER_REVIEW) {
                    const nextStage = WorkflowStage.FINAL_REVIEW_CEO;

                    stageLabel = STAGE_LABELS[nextStage] || 'FINAL_REVIEW_CEO';
                    message = `CMO has approved. Moved to ${stageLabel}.`;

                } else {
                    // For regular review, show next stage
                    const nextStage = project.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 ?
                        WorkflowStage.SCRIPT_REVIEW_L2 : WorkflowStage.CINEMATOGRAPHY;
                    stageLabel = STAGE_LABELS[nextStage] || 'Next Stage';
                    message = `CMO has approved. Current stage: ${stageLabel}.`;
                }
                setPopupMessage(message);
                setStageName(stageLabel);
                setPopupDuration(5000); // auto-close for approval

                // Show the popup immediately after successful approval
                // This ensures immediate feedback to the user
                setShowPopup(true);

                // The popup will handle the navigation back when closed
                // No need to call onComplete here since it's handled in the popup onClose
            } else if (decision === 'REWORK') {
                // Rework -> Send to the role selected by the user in the dropdown
                // Respect the user's selection from the reworkStage dropdown

                // Ensure we have a valid user ID
                const currentUser = db.getCurrentUser();
                if (!currentUser?.id) {
                    throw new Error('User not authenticated');
                }

                // STORE SNAPSHOT FOR COMPARISON
                // We store the 'before' state to show side-by-side comparison when it comes back
                const beforeContext = {
                    video_link: project.video_link,
                    edited_video_link: project.edited_video_link,
                    thumbnail_link: project.thumbnail_link,
                    creative_link: project.data?.creative_link || null,
                    script_content: project.data?.script_content || null
                };

                const updatedData = {
                    ...project.data,
                    cmo_rework_context: {
                        before: beforeContext,
                        after: null, // Clear any previous 'after' so we wait for new submission
                        initiated_at: new Date().toISOString(),
                        target_role: reworkStage // Optional: helpful for debugging
                    }
                };

                // Update project data first
                await supabase
                    .from('projects')
                    .update({ data: updatedData })
                    .eq('id', project.id);


                await db.rejectTask(project.id, reworkStage as WorkflowStage, comment);


                // Show popup for rework
                const roleLabel = getReworkRoleLabel(reworkStage as WorkflowStage);

                setPopupMessage(
                    `CMO has sent the script back for rework to the ${roleLabel}.`
                );

                setStageName(`Rework → ${roleLabel}`);
                setPopupDuration(5000); // auto-close for rework
                setTimeout(() => {
                    setShowPopup(true);
                }, 0);

            } else if (decision === 'REJECT') {
                // Full Reject - don't send back to a specific role, just reject the project

                // Ensure we have a valid user ID
                const currentUser = db.getCurrentUser();
                if (!currentUser?.id) {
                    throw new Error('User not authenticated');
                }

                await db.rejectTask(project.id, WorkflowStage.SCRIPT, 'Project killed by CMO: ' + comment);

                // Show popup for rejection
                setPopupMessage('CMO has rejected the script. The recipient will see comments but have limited editing capabilities.');
                setStageName('Rejected');
                setPopupDuration(5000); // manual close for reject
                setTimeout(() => {
                    setShowPopup(true);
                }, 0);
            }
            // Do NOT call onComplete() immediately — wait until popup is closed so it is visible to the user
        } catch (error) {
            console.error('Failed to process review decision:', error);
            alert(`Failed to process review: ${error.message || 'Unknown error occurred'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getReworkOptions = () => {
        // Check if this is a creative project (either designer-initiated or creative-only content type)
        const isCreativeProject = project.data?.source === 'DESIGNER_INITIATED' || project.content_type === 'CREATIVE_ONLY';

        // For designer-initiated projects, always send back to Designer
        if (project.data?.source === 'DESIGNER_INITIATED') {
            return [{ value: WorkflowStage.CREATIVE_DESIGN, label: 'Designer (Fix Creative)' }];
        }

        // For pure idea projects (without script content), always send back to Writer regardless of stage
        if (project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content) {
            return [{ value: WorkflowStage.SCRIPT, label: 'Writer (Fix Idea)' }];
        }

        // CMO can send back to Writer from Script Review L1
        if (project.current_stage === WorkflowStage.SCRIPT_REVIEW_L1) {
            return [{ value: WorkflowStage.SCRIPT, label: 'Writer (Fix Script)' }];
        }

        // For Final Review CMO and POST_WRITER_REVIEW, can send back to various roles
        if (project.current_stage === WorkflowStage.FINAL_REVIEW_CMO || project.current_stage === WorkflowStage.POST_WRITER_REVIEW) {
            // For creative projects, only show Designer as an option
            if (isCreativeProject) {
                return [{ value: WorkflowStage.CREATIVE_DESIGN, label: 'Designer (Fix Creative)' }];
            }

            const options = [];

            // Always include all relevant roles for these final review stages
            // Add Designer option if thumbnail is required
            const thumbnailRequired = project.data?.thumbnail_required;
            if (thumbnailRequired !== false) { // Include designer if thumbnail_required is true or undefined
                options.push({ value: WorkflowStage.CREATIVE_DESIGN, label: 'Designer (Fix Visuals)' });
            }

            // Add Editor option
            options.push({ value: WorkflowStage.VIDEO_EDITING, label: 'Editor (Fix Video)' });

            // Add Cinematographer option
            options.push({ value: WorkflowStage.CINEMATOGRAPHY, label: 'Cinematographer (Reshoot)' });

            // Add Writer option (in case script changes are needed)
            options.push({ value: WorkflowStage.SCRIPT, label: 'Writer (Fix Script)' });

            return options;
        }

        // Default fallback
        return [{ value: WorkflowStage.SCRIPT, label: 'Writer' }];
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
                            {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative Review: ' : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Idea Review: ' : 'Script Review: '}
                            {project.title}
                        </h1>
                        <div className="flex items-center space-x-2 mt-1">
                            {project.data?.source === 'IDEA_PROJECT' && (
                                <span className="px-2 py-0.5 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                    {'SCRIPT'}
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
                            {(previousScript || previousAssets) && (
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-[#FFD952] text-black">
                                    REWORK
                                </span>
                            )}
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
                                {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative' : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Idea' : (previousScript || previousAssets) ? 'Rework' : 'New'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Due Date</label>
                            <div className="font-bold text-slate-900 uppercase">Today</div>
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
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Niche</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.data?.niche
                                    ? project.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                        : project.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                            : project.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                                : project.data.niche === 'OTHER' && project.data.niche_other
                                                    ? project.data.niche_other
                                                    : project.data.niche
                                    : '—'}
                            </div>
                        </div>
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

                    {/* Thumbnail Reference from Writer */}
                    {project.data?.thumbnail_reference_link && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Writer's Thumbnail Reference</h3>
                            <div className="border-2 border-black bg-white p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold uppercase text-slate-500 mb-2">Reference Thumbnail Link</p>
                                        <a
                                            href={project.data.thumbnail_reference_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all font-medium"
                                        >
                                            {project.data.thumbnail_reference_link}
                                        </a>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 italic">This is the thumbnail provided by the writer for reference</p>
                            </div>
                        </section>
                    )}

                    {/* Script Reference from Writer */}
                    {project.data?.script_reference_link && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Writer's Script Reference</h3>
                            <div className="border-2 border-black bg-white p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold uppercase text-slate-500 mb-2">Reference Script Link</p>
                                        <a
                                            href={project.data.script_reference_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all font-medium"
                                        >
                                            {project.data.script_reference_link}
                                        </a>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 italic">This is the script provided by the writer for reference</p>
                            </div>
                        </section>
                    )}

                    {/* Script Viewer */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">
                                {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative Link & Message' : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Idea Description' : 'Script & Message'}
                            </h3>
                            <button
                                onClick={downloadPDF}
                                className="text-sm font-bold uppercase flex items-center bg-white border-2 border-black px-4 py-2 hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all"
                            >
                                <Download className="w-4 h-4 mr-2" /> Download PDF
                            </button>
                        </div>

                        {/* Wrapper for PDF generation - both cases */}
                        <div
                            ref={scriptContentRef}
                            className="overflow-auto"
                        >
                            {(() => {
                                console.log('CMO Review: Render - previousScript:', previousScript);
                                console.log('CMO Review: Render - project.data.script_content:', project.data?.script_content);
                                console.log('CMO Review: Render - isFinalReview:', isFinalReview);
                                console.log('CMO Review: Render - cmo_rework_at:', project.cmo_rework_at);
                                console.log('CMO Review: Render - writer_submitted_at:', project.writer_submitted_at);

                                // For final review stages, always show only the current script
                                if (isFinalReview) {
                                    console.log('CMO Review: Showing current script only for final review');
                                    const displayContent = project.data?.source === 'DESIGNER_INITIATED'
                                        ? project.data?.creative_link || 'No creative link available.'
                                        : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content
                                            ? project.data.idea_description
                                            : project.data?.script_content;

                                    return <ScriptDisplay content={displayContent || ''} />;
                                } else {
                                    // For non-final review stages, show comparison if we have a previous script content
                                    if (previousScript && previousScript.trim() !== '') {
                                        console.log('CMO Review: Showing script comparison - has previous script');

                                        // Recursive HTML entity decoding helper
                                        // (ScriptComparison component handles decoding internally)

                                        // Use project's script content as current if available, otherwise use a placeholder
                                        const currentScriptContent = project.data?.script_content || '<p>No new script content submitted</p>';

                                        // Show comparison for rework scenarios
                                        return (
                                            <ScriptComparison
                                                previousScript={stripHtmlTags(previousScript)}
                                                currentScript={stripHtmlTags(currentScriptContent)}
                                                previousAuthor="Previous Version"
                                                currentAuthor="Writer Rework Submission"
                                                previousTimestamp=""
                                                currentTimestamp=""
                                            />
                                        );
                                    } else {
                                        console.log('CMO Review: Showing single script - previousScript exists:', !!previousScript, 'current exists:', !!project.data?.script_content, 'isFinalReview:', isFinalReview);
                                        console.log('CMO Review: Conditions for comparison - hasPrevious:', !!previousScript, 'prev not empty:', previousScript && previousScript.trim() !== '', 'not final review:', !isFinalReview);
                                        // Show single script for non-rework projects
                                        const displayContent = project.data?.source === 'DESIGNER_INITIATED'
                                            ? project.data?.creative_link || 'No creative link available.'
                                            : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content
                                                ? project.data.idea_description
                                                : project.data?.script_content;

                                        return <ScriptDisplay content={displayContent || ''} />;
                                    }
                                }
                            })()}
                        </div>
                    </section>



                    {/* Assets Section (Only for final review) */}
                    {(project.current_stage === WorkflowStage.FINAL_REVIEW_CMO || project.current_stage === WorkflowStage.POST_WRITER_REVIEW) && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Production Assets</h3>

                            {previousScript || previousAssets || project.data?.cmo_rework_context?.before ? (
                                (() => {
                                    // REWORK CONTEXT LOGIC
                                    // Prioritize the explicit cmo_rework_context if available
                                    const reworkContext = project.data?.cmo_rework_context;
                                    const useReworkContext = !!(reworkContext && reworkContext.before);

                                    // Resolve "Before" Assets
                                    const prevVideo = useReworkContext ? reworkContext.before.video_link : previousAssets?.video_link;
                                    const prevEdited = useReworkContext ? reworkContext.before.edited_video_link : previousAssets?.edited_video_link;
                                    const prevThumbnail = useReworkContext ? reworkContext.before.thumbnail_link : previousAssets?.thumbnail_link;
                                    const prevCreative = useReworkContext ? reworkContext.before.creative_link : (previousAssets?.creative_link || previousAssets?.data?.creative_link);

                                    // Resolve "Current" (After) Assets
                                    // If rework context has explicit 'after' (submitted by role), use it. Otherwise use current project state.
                                    const currVideo = (useReworkContext && reworkContext.after?.video_link) ? reworkContext.after.video_link : project.video_link;
                                    const currEdited = (useReworkContext && reworkContext.after?.edited_video_link) ? reworkContext.after.edited_video_link : project.edited_video_link;
                                    const currThumbnail = (useReworkContext && reworkContext.after?.thumbnail_link) ? reworkContext.after.thumbnail_link : project.thumbnail_link;
                                    const currCreative = (useReworkContext && reworkContext.after?.creative_link) ? reworkContext.after.creative_link : (project.data?.creative_link || project.creative_link);

                                    // Determine visibility of comparison blocks
                                    // We show "Previous" if checks pass.
                                    // For rework context, we generally want to show the comparison for the role that was targeted.
                                    // If reworkTargetRole is not set (e.g. reload), we might infer it from data changes or context.target_role

                                    let targetRoleFromContext = null;
                                    if (reworkContext?.target_role) {
                                        if (reworkContext.target_role === WorkflowStage.CINEMATOGRAPHY) targetRoleFromContext = Role.CINE;
                                        else if (reworkContext.target_role === WorkflowStage.VIDEO_EDITING) targetRoleFromContext = Role.EDITOR;
                                        else if (reworkContext.target_role === WorkflowStage.THUMBNAIL_DESIGN || reworkContext.target_role === WorkflowStage.CREATIVE_DESIGN) targetRoleFromContext = Role.DESIGNER;
                                    }

                                    const targetRole = targetRoleFromContext || reworkTargetRole;

                                    const showPreviousRaw = (targetRole === Role.CINE && prevVideo) || (useReworkContext && prevVideo && !prevEdited && !prevThumbnail && !prevCreative); // Fallback if explicit role matches or it's the only asset
                                    const showPreviousEdited = (targetRole === Role.EDITOR && prevEdited) || (useReworkContext && prevEdited && !prevThumbnail && !prevCreative);
                                    const showPreviousCreative = (targetRole === Role.DESIGNER && (prevThumbnail || prevCreative));

                                    // Force show if we have rework context and the asset exists, and it corresponds to the likely active task
                                    // To be safe, if we have a BEFORE asset, we allow showing it if it matches the content type
                                    const showRaw = showPreviousRaw || (useReworkContext && prevVideo && !showPreviousEdited && !showPreviousCreative);
                                    const showEdit = showPreviousEdited || (useReworkContext && prevEdited);
                                    const showCreative = showPreviousCreative || (useReworkContext && (prevThumbnail || prevCreative));

                                    return (
                                        // Show both previous and current assets side by side for rework projects
                                        <div className="space-y-8 max-w-4xl mx-auto">
                                            {/* Raw Video Assets */}
                                            {isVideo && (currVideo || prevVideo) && (
                                                <div className="space-y-2">
                                                    {(showRaw || currVideo) && <h4 className="text-lg font-black text-slate-800 uppercase text-center border-b-2 border-slate-200 pb-1">Raw Footage</h4>}
                                                    <div className="grid grid-cols-2 gap-4 items-start">
                                                        {/* Previous Raw Video */}
                                                        {showRaw && (
                                                            <div className={`border-2 border-slate-300 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${currVideo ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-100 border-b-2 border-slate-300">
                                                                    <h4 className="font-black text-slate-900 text-xs uppercase text-center">Previous Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-black flex items-center justify-center text-white relative group">
                                                                    <Video className="w-10 h-10 opacity-50" />
                                                                    <a href={prevVideo} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">Play Video</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Original</span>
                                                                    <a href={prevVideo} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Current Raw Video */}
                                                        {currVideo && (
                                                            <div className={`border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${showRaw ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                                    <h4 className="font-black text-white text-xs uppercase text-center">Current Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-black flex items-center justify-center text-white relative group">
                                                                    <Video className="w-10 h-10 opacity-50" />
                                                                    <a href={currVideo} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">Play Video</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">New Submission</span>
                                                                    <a href={currVideo} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Edited Video Assets */}
                                            {isVideo && (currEdited || prevEdited) && (
                                                <div className="space-y-2">
                                                    {(showEdit || currEdited) && <h4 className="text-lg font-black text-slate-800 uppercase text-center border-b-2 border-slate-200 pb-1">Edited Video</h4>}
                                                    <div className="grid grid-cols-2 gap-4 items-start">
                                                        {/* Previous Edited Video */}
                                                        {showEdit && (
                                                            <div className={`border-2 border-slate-300 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${currEdited ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-100 border-b-2 border-slate-300">
                                                                    <h4 className="font-black text-slate-900 text-xs uppercase text-center">Previous Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-black flex items-center justify-center text-white relative group">
                                                                    <Video className="w-10 h-10 opacity-50" />
                                                                    <a href={prevEdited} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">Play Video</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Old Edit</span>
                                                                    <a href={prevEdited} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Current Edited Video */}
                                                        {currEdited && (
                                                            <div className={`border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${showEdit ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                                    <h4 className="font-black text-white text-xs uppercase text-center">Current Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-black flex items-center justify-center text-white relative group">
                                                                    <Video className="w-10 h-10 opacity-50" />
                                                                    <a href={currEdited} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">Play Video</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">New Submission</span>
                                                                    <a href={currEdited} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Thumbnail/Creative Assets */}
                                            {(currThumbnail || prevThumbnail || currCreative || prevCreative) && (
                                                <div className="space-y-2">
                                                    {(showCreative || currThumbnail || currCreative) && <h4 className="text-lg font-black text-slate-800 uppercase text-center border-b-2 border-slate-200 pb-1">Creative Assets</h4>}
                                                    <div className="grid grid-cols-2 gap-4 items-start">
                                                        {/* Previous Thumbnail/Creative */}
                                                        {showCreative && (
                                                            <div className={`border-2 border-slate-300 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${currThumbnail || currCreative ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-100 border-b-2 border-slate-300">
                                                                    <h4 className="font-black text-slate-900 text-xs uppercase text-center">Previous Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 relative group overflow-hidden">
                                                                    {prevThumbnail ? (
                                                                        <img src={prevThumbnail} alt="Previous" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <ImageIcon className="w-10 h-10" />
                                                                    )}
                                                                    <a href={prevThumbnail || prevCreative} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">View</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Old Design</span>
                                                                    <a href={prevThumbnail || prevCreative} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Current Thumbnail/Creative */}
                                                        {(currThumbnail || currCreative) && (
                                                            <div className={`border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${showCreative ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                                    <h4 className="font-black text-white text-xs uppercase text-center">Current Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 relative group overflow-hidden">
                                                                    {currThumbnail ? (
                                                                        <img src={currThumbnail} alt="Current" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <ImageIcon className="w-10 h-10" />
                                                                    )}
                                                                    <a href={currThumbnail || currCreative} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">View</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">New Submission</span>
                                                                    <a href={currThumbnail || currCreative} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            ) : (
                                // Show single assets for non-rework projects
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
                            )}
                        </section>
                    )}
                </div>

                {/* RIGHT COLUMN: Approval Panel (30%) - Sticky */}
                <div className="w-full md:w-[450px] bg-white border-l-2 border-black p-8 shadow-[-10px_0px_20px_rgba(0,0,0,0.05)] sticky bottom-0 md:top-20 md:h-[calc(100vh-80px)] overflow-y-auto z-10 flex flex-col">
                    <h2 className="text-2xl font-black text-slate-900 uppercase mb-8 border-b-4 border-black pb-2 inline-block">CMO Decision</h2>

                    <div className="space-y-4 flex-1">
                        {/* Approve Option */}
                        <label className={`block p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${decision === 'APPROVE' ? 'border-black bg-[#4ADE80]' : 'border-black bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center">
                                <input
                                    type="radio"
                                    name="decision"
                                    className="w-5 h-5 accent-black"
                                    checked={decision === 'APPROVE'}
                                    onChange={() => setDecision('APPROVE')}
                                />
                                <div className="ml-4 flex-1">
                                    <span className="block font-black text-lg uppercase text-slate-900">Approve Content</span>
                                    <span className="text-xs font-bold uppercase text-slate-600">
                                        {project.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 ? 'Move to CEO Review' : 'Ready for Publishing'}
                                    </span>
                                </div>
                                <Check className="w-8 h-8 ml-auto text-black" />
                            </div>
                        </label>

                        {/* Rework Option */}
                        <label className={`block p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${decision === 'REWORK' ? 'border-black bg-[#FFD952]' : 'border-black bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center">
                                <input
                                    type="radio"
                                    name="decision"
                                    className="w-5 h-5 accent-black"
                                    checked={decision === 'REWORK'}
                                    onChange={() => { setDecision('REWORK'); setReworkStage(''); }}
                                />
                                <div className="ml-4 flex-1">
                                    <span className="block font-black text-lg uppercase text-slate-900">Request Rework</span>
                                    <span className="text-xs font-bold uppercase text-slate-600">Send back for edits</span>
                                </div>
                                <RotateCcw className="w-8 h-8 ml-auto text-black" />
                            </div>
                        </label>

                        {/* Reject Option */}
                        <label className={`block p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${decision === 'REJECT' ? 'border-black bg-[#FF4F4F] text-white' : 'border-black bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center">
                                <input
                                    type="radio"
                                    name="decision"
                                    className="w-5 h-5 accent-black"
                                    checked={decision === 'REJECT'}
                                    onChange={() => setDecision('REJECT')}
                                />
                                <div className="ml-4 flex-1">
                                    <span className={`block font-black text-lg uppercase ${decision === 'REJECT' ? 'text-white' : 'text-slate-900'}`}>Reject</span>
                                    <span className={`text-xs font-bold uppercase ${decision === 'REJECT' ? 'text-white/80' : 'text-slate-600'}`}>Terminate workflow</span>
                                </div>
                                <X className={`w-8 h-8 ml-auto ${decision === 'REJECT' ? 'text-white' : 'text-black'}`} />
                            </div>
                        </label>
                    </div>

                    <div className="my-8 border-t-2 border-dashed border-slate-300"></div>

                    {/* Conditional Inputs */}
                    <div className="space-y-6">
                        {decision === 'REWORK' && (
                            <div className="animate-fade-in space-y-2">
                                <label className="block text-xs font-black text-slate-500 uppercase">Send back to</label>
                                <select
                                    className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold text-sm uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                                    value={reworkStage}
                                    onChange={(e) => setReworkStage(e.target.value)}
                                >
                                    <option value="">-- Select Role --</option>
                                    {getReworkOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        )}

                        {(decision === 'REWORK' || decision === 'REJECT' || decision === 'APPROVE') && (
                            <div className="animate-fade-in space-y-2">
                                <label className="block text-xs font-black text-slate-500 uppercase">
                                    {decision === 'APPROVE' ? 'Notes (Optional)' : 'Reason (Required)'}
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder={decision === 'APPROVE' ? "Good job..." : "Please fix..."}
                                    className="w-full p-4 border-2 border-black rounded-none text-sm min-h-[120px] focus:bg-yellow-50 focus:outline-none font-medium resize-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                                />
                            </div>
                        )}
                    </div>

                    <div className="mt-8">
                        <button
                            disabled={!decision || isSubmitting || (decision === 'REWORK' && (!reworkStage || reworkStage === '')) || (decision === 'REJECT' && (!comment || comment.trim() === ''))}
                            onClick={() => {
                                console.log('Button clicked', { decision, reworkStage, comment });
                                setConfirmationAction(decision);
                                setShowConfirmation(true);
                            }}
                            className={`w-full py-5 border-2 border-black font-black uppercase text-lg shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[6px] active:translate-x-[6px] transition-all flex justify-center items-center ${decision === 'REWORK' ? 'bg-[#FFD952] text-black' :
                                decision === 'REJECT' ? 'bg-[#FF4F4F] text-white' :
                                    decision === 'APPROVE' ? 'bg-[#0085FF] text-white' :
                                        'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300 shadow-none'
                                }`}
                        >
                            {isSubmitting ? (
                                <div className="w-6 h-6 border-4 border-current border-t-transparent rounded-full animate-spin" />
                            ) : decision === 'REWORK' ? 'Send For Rework' :
                                decision === 'REJECT' ? 'Confirm Rejection' :
                                    decision === 'APPROVE' ? 'Approve & Continue' :
                                        'Select Action'
                            }
                        </button>
                    </div>
                </div>
            </div>
            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={() => {
                        setShowPopup(false);
                        // Call onComplete to close the review screen and refresh dashboard
                        // Ensure we only call onComplete once to avoid duplicate refreshes
                        onComplete();
                    }}
                    duration={popupDuration}
                />
            )}

            {/* Confirmation Popup */}
            {showConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    {console.log('Rendering confirmation popup', { confirmationAction })}
                    <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-black uppercase">Confirm Action</h3>
                            <button
                                onClick={() => setShowConfirmation(false)}
                                className="text-slate-500 hover:text-slate-700"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <p className="mb-6">
                            {confirmationAction === 'APPROVE' && 'Are you sure you want to approve this content?'}
                            {confirmationAction === 'REWORK' && 'Are you sure you want to send this content back for rework?'}
                            {confirmationAction === 'REJECT' && 'Are you sure you want to reject this content?'}
                        </p>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setShowConfirmation(false)}
                                className="flex-1 px-4 py-3 border-2 border-black text-black font-black uppercase hover:bg-slate-100 transition-colors"
                            >
                                No
                            </button>
                            <button
                                onClick={() => {
                                    setShowConfirmation(false);
                                    handleSubmit();
                                }}
                                className={`flex-1 px-4 py-3 border-2 border-black font-black uppercase transition-colors ${confirmationAction === 'REWORK' ? 'bg-[#FFD952] text-black' :
                                    confirmationAction === 'REJECT' ? 'bg-[#FF4F4F] text-white' :
                                        confirmationAction === 'APPROVE' ? 'bg-[#0085FF] text-white' :
                                            'bg-slate-200 text-slate-400'
                                    }`}
                            >
                                Yes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CmoReviewScreen;