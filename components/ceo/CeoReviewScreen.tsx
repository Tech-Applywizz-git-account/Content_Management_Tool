
import React, { useState, useRef, useEffect } from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, Channel, User } from '../../types';
import { db } from '../../services/supabaseDb';
import { getWorkflowState } from '../../services/workflowUtils';
import { supabase } from '../../src/integrations/supabase/client';
import { ArrowLeft, Check, X, RotateCcw, Download, Video, Image as ImageIcon } from 'lucide-react';
import Popup from '../Popup';
import ScriptComparison from '../ScriptComparison';
import ScriptDisplay from '../ScriptDisplay';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { decodeHtmlEntities, stripHtmlTags } from '../../utils/htmlDecoder';

interface Props {
    project: Project;
    user: User;
    onBack: () => void;
    onComplete: () => void;
}

const CeoReviewScreen: React.FC<Props> = ({ project, user, onBack, onComplete }) => {
    const [publicUser, setPublicUser] = useState<User | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [decision, setDecision] = useState<'APPROVE' | 'REWORK' | 'REJECT' | null>(null);
    const [approveComment, setApproveComment] = useState('');
    const [reworkComment, setReworkComment] = useState('');
    const [reworkReason, setReworkReason] = useState('');
    const [rejectComment, setRejectComment] = useState('');
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
    const [popupDuration, setPopupDuration] = useState<number>(0);

    // Confirmation popup state
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationAction, setConfirmationAction] = useState<'APPROVE' | 'REWORK' | 'REJECT' | null>(null);

    const scriptContentRef = useRef<HTMLDivElement>(null);

    // Load public user profile on mount
    // Requirement: Fetch public.users record ONCE using the logged-in user's email
    useEffect(() => {
        const loadUser = async () => {
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser?.email) {
                    const { data: pUser, error: pError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('email', authUser.email)
                        .single();

                    if (!pError && pUser) {
                        setPublicUser(pUser as User);
                    } else {
                        console.error('Error fetching public user:', pError);
                        setError('User profile not found in database. Please contact support.');
                    }
                }
            } catch (err) {
                console.error('Failed to load user:', err);
            }
        };
        loadUser();
    }, []);


    // Reset comment inputs when action changes
    useEffect(() => {
        setApproveComment('');
        setReworkComment('');
        setReworkReason('');
        setRejectComment('');
        setReworkStage('');
    }, [decision]);

    // Effect to track when CEO opens the project for the first time
    useEffect(() => {
        const trackProjectOpen = async () => {
            try {
                // Check if this is the first time the project is being opened by a reviewer
                if (!project.first_review_opened_at && !project.first_review_opened_by_role) {
                    // Update the project to record that it was opened by CEO
                    await db.projects.update(project.id, {
                        first_review_opened_at: new Date().toISOString(),
                        first_review_opened_by_role: Role.CEO
                    });
                }
            } catch (error) {
                console.error('Error tracking project open:', error);
            }
        };

        trackProjectOpen();
    }, [project.id, project.first_review_opened_at, project.first_review_opened_by_role]);

    const getReworkRoleLabel = (stage: WorkflowStage) => {
        // Check if this is a creative project (either designer-initiated or creative-only content type)
        const isCreativeProject = project.data?.source === 'DESIGNER_INITIATED' || project.content_type === 'CREATIVE_ONLY';

        switch (stage) {
            case WorkflowStage.SCRIPT:
                return 'Writer';
            case WorkflowStage.FINAL_REVIEW_CMO:
                return 'CMO';
            case WorkflowStage.VIDEO_EDITING:
                return 'Editor';
            case WorkflowStage.CINEMATOGRAPHY:
                // For creative projects, show Designer instead of Cinematographer
                return isCreativeProject ? 'Designer' : 'Cinematographer';
            case WorkflowStage.CREATIVE_DESIGN:
                return 'Designer';
            default:
                return 'Team';
        }
    };


    const [reworkTargetRole, setReworkTargetRole] = useState<Role | null>(null);

    useEffect(() => {
        const fetchPreviousVersion = async () => {
            console.log('CEO Review: Starting fetchPreviousVersion for project:', project.id);

            // Fetch history to find the last rework action
            const { data: historyData, error: historyError } = await supabase
                .from('workflow_history')
                .select('script_content, video_link, edited_video_link, thumbnail_link, creative_link, action, actor_name, timestamp, stage, metadata')
                .eq('project_id', project.id)
                .order('timestamp', { ascending: false })
                .limit(50);

            if (historyError) {
                console.error('Error fetching history:', historyError);
                return;
            }

            if (!historyData || historyData.length === 0) {
                console.log('CEO Review: No history data found for project:', project.id);
                setPreviousScript(null);
                setPreviousAssets(null);
                setReworkTargetRole(null);
                return;
            }

            // Find the most recent REWORK or REJECT action
            const lastReworkIndex = historyData.findIndex(entry =>
                ['REWORK', 'REJECTED'].includes(entry.action)
            );

            console.log('CEO Review: Last rework index:', lastReworkIndex);

            if (lastReworkIndex !== -1) {
                const reworkEntry = historyData[lastReworkIndex];
                console.log('CEO Review: Found rework entry at:', reworkEntry.timestamp);

                // STRICT CEO FILTER: Only show rework comparison if the rework was initiated by the CEO
                if (reworkEntry.stage !== WorkflowStage.FINAL_REVIEW_CEO) {
                    console.log('CEO Review: Ignoring rework from non-CEO stage:', reworkEntry.stage);
                    setPreviousScript(null);
                    setPreviousAssets(null);
                    setReworkTargetRole(null);
                    return;
                }

                // Identify who performed the rework (aka who submitted the changes AFTER the rework request)
                // We look at actions occurring *more recently* than lastReworkIndex
                const recentHistory = historyData.slice(0, lastReworkIndex);
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
                    // 2. Check for explicit rework submission actions (Legacy/Fallback)
                    if (recentHistory.some(h => h.action === 'REWORK_EDIT_SUBMITTED')) {
                        detectedRole = Role.EDITOR;
                    } else if (recentHistory.some(h => h.action === 'REWORK_VIDEO_SUBMITTED')) {
                        detectedRole = Role.CINE;
                    } else if (recentHistory.some(h => h.action === 'REWORK_DESIGN_SUBMITTED')) {
                        detectedRole = Role.DESIGNER;
                    } else {
                        // 3. Fallback: Infer from what changed
                        if (project.video_link !== reworkEntry.video_link) detectedRole = Role.CINE;
                        else if (project.edited_video_link !== reworkEntry.edited_video_link) detectedRole = Role.EDITOR;
                        else if (project.thumbnail_link !== reworkEntry.thumbnail_link || project.data?.creative_link !== reworkEntry.creative_link) detectedRole = Role.DESIGNER;

                        if (!detectedRole && recentHistory.some(h => h.action === 'SUBMITTED' || h.action === 'WRITER_SUBMIT')) {
                            if (reworkEntry.edited_video_link !== project.edited_video_link) detectedRole = Role.EDITOR;
                        }

                        if (!detectedRole && reworkEntry.stage === 'VIDEO_EDITING') {
                            detectedRole = Role.EDITOR;
                        }
                    }
                }

                setReworkTargetRole(detectedRole);

                // Set previous script
                if (reworkEntry.script_content) {
                    setPreviousScript(reworkEntry.script_content);
                }

                // Helper to get last history item from project history arrays
                const getLastHistoryItem = (historyStrOrArray: any) => {
                    if (!historyStrOrArray) return null;
                    if (Array.isArray(historyStrOrArray)) return historyStrOrArray[historyStrOrArray.length - 1];
                    try {
                        const parsed = typeof historyStrOrArray === 'string' ? JSON.parse(historyStrOrArray) : historyStrOrArray;
                        if (Array.isArray(parsed)) return parsed[parsed.length - 1];
                    } catch (e) { return null; }
                    return null;
                };

                // Set previous assets with fallbacks
                setPreviousAssets({
                    video_link: metadataBasedAssets?.video_link || reworkEntry.video_link || getLastHistoryItem(project.cine_video_links_history),
                    edited_video_link: metadataBasedAssets?.edited_video_link || reworkEntry.edited_video_link || getLastHistoryItem(project.editor_video_links_history) || getLastHistoryItem(project.sub_editor_video_links_history),
                    thumbnail_link: metadataBasedAssets?.thumbnail_link || reworkEntry.thumbnail_link || (project.thumbnail_link ? getLastHistoryItem(project.designer_video_links_history) : null),
                    creative_link: metadataBasedAssets?.creative_link || reworkEntry.creative_link || (!project.thumbnail_link ? getLastHistoryItem(project.designer_video_links_history) : null)
                });

            } else {
                console.log('CEO Review: No recent rework found in history');
                setPreviousScript(null);
                setPreviousAssets(null);
                setReworkTargetRole(null);
            }
        };

        fetchPreviousVersion();
    }, [project.id, project.ceo_rework_at, project.writer_submitted_at]);

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
        if (!decision) return;

        // HARD GUARD: Prevent submission if publicUser.id is missing
        if (!publicUser?.id) {
            alert('User profile not loaded. Please refresh and try again.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Get the appropriate comment based on decision type
            let finalComment = '';
            if (decision === 'APPROVE') {
                finalComment = approveComment || 'Approved by CEO';
            } else if (decision === 'REWORK') {
                // Avoid duplicating the same text if dropdown value matches text input
                finalComment = reworkReason === reworkComment
                    ? reworkReason
                    : `${reworkReason}${reworkComment ? ' - ' + reworkComment : ''}`;
            } else if (decision === 'REJECT') {
                finalComment = rejectComment || 'Rejected by CEO';
            }

            if (decision === 'APPROVE') {
                // Check if this is a rework scenario where the CEO is approving after sending back for rework
                const isReworkScenario = project.ceo_rework_at && project.writer_submitted_at &&
                    new Date(project.writer_submitted_at) > new Date(project.ceo_rework_at);

                if (isReworkScenario || project.current_stage === WorkflowStage.FINAL_REVIEW_CEO) {
                    // For rework scenarios and final review, use the standardized workflow advancement
                    const nextStageInfo = db.helpers.getNextStage(
                        project.current_stage,
                        project.content_type,
                        'APPROVED',
                        project.data
                    );

                    await db.workflow.approve(
                        project.id,
                        publicUser.id,
                        publicUser.full_name || 'CEO',
                        Role.CEO,
                        nextStageInfo.stage,
                        nextStageInfo.role,
                        finalComment || 'Approved by CEO'
                    );
                } else {
                    await db.advanceWorkflow(project.id, finalComment);
                }

                let stageLabel;
                const nextStageDetails = db.helpers.getNextStage(
                    project.current_stage,
                    project.content_type,
                    'APPROVED',
                    project.data
                );
                const nextStage = nextStageDetails.stage;
                const nextRole = nextStageDetails.role;

                // Store comments in forwarded_comments if comment exists
                if (finalComment && finalComment.trim() !== '' && finalComment !== 'Approved by CEO') {
                    const newComment = {
                        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
                        from_role: Role.CEO,
                        to_role: project.data?.source === 'IDEA_PROJECT' && project.current_stage === WorkflowStage.FINAL_REVIEW_CEO ? Role.WRITER : nextRole,
                        comment: finalComment,
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

                        await supabase
                            .from('projects')
                            .update({ forwarded_comments: updatedComments })
                            .eq('id', project.id);
                    }
                }

                // Show popup for approval
                // SPECIAL CASE: If this is an idea project, it goes back to writer
                if (project.data?.source === 'IDEA_PROJECT' && project.current_stage === WorkflowStage.FINAL_REVIEW_CEO) {
                    stageLabel = STAGE_LABELS[WorkflowStage.SCRIPT] || 'SCRIPT';
                    setPopupMessage(`CEO has approved the idea. Sent back to writer to convert into script.`);
                } else {
                    stageLabel = STAGE_LABELS[nextStage] || nextStage;
                    setPopupMessage(`CEO has approved. Current stage: ${stageLabel}.`);
                }

                setStageName(stageLabel);
                setPopupDuration(5000); // auto-close for approval
                setTimeout(() => {
                    setShowPopup(true);
                }, 0);
            } else if (decision === 'REWORK') {
                // Send the project for rework
                await db.rejectTask(project.id, reworkStage as WorkflowStage, finalComment);

                // Show popup for rework
                const roleLabel = getReworkRoleLabel(reworkStage as WorkflowStage);

                setPopupMessage(
                    `CEO has sent the script back for rework to the ${roleLabel}.`
                );

                setStageName(`Rework → ${roleLabel}`);
                setPopupDuration(5000); // auto-close for rework
                setTimeout(() => {
                    setShowPopup(true);
                }, 0);

            } else if (decision === 'REJECT') {
                // Full reject goes back to SCRIPT/Draft usually, or a specific REJECTED state
                // For reject, we don't send back to a specific role, just reject the project
                // Use comment that indicates this is a full rejection to distinguish from rework
                // Adding 'Project terminated' to trigger reject behavior in backend logic

                const rejectCommentWithTermination = (finalComment ? finalComment + ' - Project terminated' : 'Rejected completely by CEO - Project terminated');
                await db.rejectTask(project.id, WorkflowStage.SCRIPT, rejectCommentWithTermination);

                // Show popup for rejection
                setPopupMessage('CEO has rejected the script. The recipient will see comments but have limited editing capabilities.');
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

        // STRICT CEO LOGIC
        // 1. Script Review Stage: Can ONLY go back to Writer.
        if (project.current_stage === WorkflowStage.SCRIPT_REVIEW_L2) {
            return [{ value: WorkflowStage.SCRIPT, label: 'Writer (Fix Script)' }];
        }

        // 2. Final Review Stage: Can go to CMO, Cine, Editor, or Designer. CANNOT go to Writer.
        if (project.current_stage === WorkflowStage.FINAL_REVIEW_CEO) {
            // For creative projects, show Designer and CMO as options
            if (isCreativeProject) {
                return [
                    { value: WorkflowStage.CREATIVE_DESIGN, label: 'Designer (Fix Creative)' },
                    { value: WorkflowStage.FINAL_REVIEW_CMO, label: 'CMO (Review Feedback)' }
                ];
            }

            const options = [
                { value: WorkflowStage.FINAL_REVIEW_CMO, label: 'CMO (Review Feedback)' },
            ];

            // Add Designer option only if thumbnail is required
            const thumbnailRequired = project.data?.thumbnail_required;
            if (thumbnailRequired !== false) { // Include designer if thumbnail_required is true or undefined
                options.push({ value: WorkflowStage.CREATIVE_DESIGN, label: 'Designer (Fix Visuals)' });
            }

            // If video channel, add Editor/Cine
            if (project.channel === Channel.YOUTUBE || project.channel === Channel.INSTAGRAM) {
                options.push({ value: WorkflowStage.VIDEO_EDITING, label: 'Editor (Fix Video)' });
                options.push({ value: WorkflowStage.CINEMATOGRAPHY, label: 'Cinematographer (Reshoot)' });
            }
            return options;
        }

        // Default fallback (shouldn't happen in CEO flow but good for safety)
        return [{ value: WorkflowStage.SCRIPT, label: 'Writer' }];
    };

    const isVideo = project.channel === Channel.YOUTUBE || project.channel === Channel.INSTAGRAM;

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col">
            {/* Header */}
            <header className="min-h-[4.5rem] md:h-20 border-b-2 border-black flex items-center justify-between px-3 md:px-6 sticky top-0 bg-white z-20 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)] gap-2">
                <div className="flex items-center space-x-2 md:space-x-4 overflow-hidden">
                    <button onClick={onBack} className="p-2 md:p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all flex-shrink-0">
                        <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-black" />
                    </button>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1">
                            <span className={`px-1.5 py-0.5 text-[8px] md:text-xs font-black uppercase border border-black text-white ${project.channel === Channel.YOUTUBE ? 'bg-[#FF4F4F]' :
                                project.channel === Channel.LINKEDIN ? 'bg-[#0085FF]' :
                                    project.channel === Channel.INSTAGRAM ? 'bg-[#D946EF]' :
                                        'bg-black'
                                }`}>
                                {project.channel}
                            </span>
                            <span
                                className={`px-1.5 py-0.5 text-[8px] md:text-xs font-black uppercase border border-black ${project.priority === 'HIGH'
                                    ? 'bg-red-500 text-white'
                                    : project.priority === 'NORMAL'
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-green-500 text-white'
                                    }`}
                            >
                                {project.priority}
                            </span>
                            {(previousScript || previousAssets) && (
                                <span className="px-1.5 py-0.5 text-[8px] md:text-xs font-black uppercase border border-black bg-[#FFD952] text-black">
                                    REWORK
                                </span>
                            )}
                            <span className="hidden sm:inline text-[8px] md:text-xs font-bold uppercase text-slate-500">
                                Stage: {STAGE_LABELS[project.current_stage]}
                            </span>
                        </div>
                        <h1 className="text-base md:text-2xl font-black text-slate-900 uppercase tracking-tight truncate">
                            {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative: ' : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Idea: ' : 'Script: '}
                            {project.title}
                        </h1>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row w-full overflow-hidden">

                {/* LEFT COLUMN: Content (70% on desktop) */}
                <div className="flex-1 p-4 md:p-8 lg:p-12 space-y-6 md:space-y-10 overflow-y-auto bg-slate-50">

                    {/* Info Block - Responsive Grid */}
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 md:p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Creator</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.data?.writer_name || project.writer_name || project.data?.cmo_name || project.cmo_name || 'Unknown Creator'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Priority</label>
                            <div className={`font-bold uppercase ${project.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                                {project.priority}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Type</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {(() => {
                                    if (project.data?.source === 'DESIGNER_INITIATED') return 'Creative';
                                    if (project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content) return 'Idea';
                                    
                                    // Check if this is a CINE-initiated rework
                                    const isCineRework = project.history?.some(h => 
                                        h.action === 'REWORK' && 
                                        h.actor_role === 'CINE' &&
                                        h.from_role === 'CINE' &&
                                        h.to_role === 'WRITER'
                                    );
                                    
                                    if (isCineRework) return 'Cine Rework';
                                    if (previousScript || previousAssets) return 'Rework';
                                    return 'New';
                                })()}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">CMO Status</label>
                            <div className="font-bold text-green-600 uppercase flex items-center">
                                <Check className="w-4 h-4 mr-1" /> Approved
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
                        {project.data?.influencer_name && (
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Influencer</label>
                                <div className="font-bold text-slate-900 uppercase truncate" title={project.data.influencer_name}>
                                    {project.data.influencer_name}
                                </div>
                            </div>
                        )}
                        {project.data?.referral_link && (
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Referral Link</label>
                                <a href={project.data.referral_link} target="_blank" rel="noreferrer" className="font-bold text-blue-600 hover:underline uppercase block truncate">
                                    View Link
                                </a>
                            </div>
                        )}
                        {project.data?.thumbnail_notes && (
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1">Thumbnail Notes</label>
                                <div className="font-bold text-slate-900 max-h-12 overflow-y-auto">
                                    {project.data.thumbnail_notes}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CMO Notes Section */}
                    {(project as any).forwarded_comments && (project as any).forwarded_comments.length > 0 && (project as any).forwarded_comments.some((c: any) => c.from_role === 'CMO') && (
                        <section className="space-y-4 pt-4 md:pt-6 mt-6 border-t-2 md:border-t-4 border-black">
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase">CMO Notes</h3>
                            <div className="space-y-4">
                                {(project as any).forwarded_comments
                                    .filter((c: any) => c.from_role === 'CMO')
                                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                    .map((comment: any, index: number) => (
                                        <div key={index} className="border-2 border-black bg-[#FFFBEB] p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-black text-slate-900 uppercase text-sm bg-yellow-400 px-2 py-1 border border-black">
                                                    CMO Feedback
                                                </span>
                                                <span className="text-xs font-bold text-slate-500 uppercase">
                                                    {new Date(comment.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="font-bold text-slate-900 whitespace-pre-wrap">
                                                {comment.comment}
                                            </p>
                                        </div>
                                    ))}
                            </div>
                        </section>
                    )}

                    {/* Script Reference Link - Additional Section for clarity */}
                    {project.data?.script_reference_link && (
                        <section className="space-y-4 pt-4 md:pt-6 border-t-2 md:border-t-4 border-black">
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase">Writer's Script Reference</h3>
                            <div className="border-2 border-black bg-white p-4 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
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
                                <p className="text-xs text-slate-500 mt-2 italic">This is the reference script provided by the writer</p>
                            </div>
                        </section>
                    )}

                    {/* Thumbnail Reference from Writer */}
                    {project.data?.thumbnail_reference_link && (
                        <section className="space-y-4 pt-4 md:pt-6 border-t-2 md:border-t-4 border-black">
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase">Writer's Thumbnail Reference</h3>
                            <div className="border-2 border-black bg-white p-4 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
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

                    {/* Script Viewer */}
                    <section className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase">
                                {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative Link' : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Idea Description' : 'Script Content'}
                            </h3>
                            <button
                                onClick={downloadPDF}
                                className="text-sm font-bold uppercase flex items-center bg-white border-2 border-black px-4 py-2 hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all"
                            >
                                <Download className="w-4 h-4 mr-2" /> Download PDF
                            </button>
                        </div>

                        {/* Script Reference Link */}


                        {/* Wrapper for PDF generation - both cases */}
                        <div
                            ref={scriptContentRef}
                            className="overflow-auto"
                        >
                            {previousScript && previousScript.trim() !== '' ? (
                                // Show script comparison for rework scenarios
                                // ScriptComparison component handles HTML entity decoding internally
                                <ScriptComparison
                                    previousScript={previousScript}
                                    currentScript={project.data?.script_content || '<p>No new script content submitted</p>'}
                                    previousCaption={previousAssets?.data?.captions || previousAssets?.captions}
                                    currentCaption={project.data?.captions}
                                    previousAuthor="Previous Version"
                                    currentAuthor="Writer Rework Submission"
                                    previousTimestamp=""
                                    currentTimestamp=""
                                />
                            ) : (
                                <ScriptDisplay
                                    content={(project.data?.source === 'DESIGNER_INITIATED'
                                        ? project.data?.creative_link || 'No creative link available.'
                                        : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content
                                            ? project.data.idea_description
                                            : project.data?.script_content) || ''}
                                    caption={project.data?.captions}
                                />
                            )}
                        </div>
                    </section>



                    {/* Assets Section (Only for final review) */}
                    {project.current_stage === WorkflowStage.FINAL_REVIEW_CEO && (
                        <section className="space-y-4 pt-4 md:pt-6 border-t-2 md:border-t-4 border-black">
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase">Production Assets</h3>

                            {previousScript || previousAssets ? (
                                (() => {
                                    // Helper logic to determine if we should show previous assets
                                    // We show previous if:
                                    // 1. We identified the target role for that asset type
                                    // 2. The previous asset exists
                                    // Note: We deliberately DO NOT check if previous !== current. 
                                    // If they are the same, we still want to show them side-by-side to highlight that NO CHANGE was made.
                                    const showPreviousRaw = reworkTargetRole === Role.CINE && previousAssets?.video_link;
                                    const showPreviousEdited = reworkTargetRole === Role.EDITOR && previousAssets?.edited_video_link;
                                    const showPreviousCreative = reworkTargetRole === Role.DESIGNER && (previousAssets?.thumbnail_link || previousAssets?.creative_link);

                                    return (
                                        // Show both previous and current assets side by side for rework projects
                                        <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto">
                                            {/* Raw Video Assets */}
                                            {isVideo && (project.video_link || previousAssets?.video_link) && (
                                                <div className="space-y-2">
                                                    {(showPreviousRaw || project.video_link) && <h4 className="text-base md:text-lg font-black text-slate-800 uppercase text-center border-b-2 border-slate-200 pb-1">{['JOBBOARD', 'LEAD_MAGNET'].includes(project.content_type) ? 'Influencer Video' : 'Raw Footage'}</h4>}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                                        {/* Previous Raw Video */}
                                                        {showPreviousRaw && (
                                                            <div className={`border-2 border-slate-300 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${project.video_link ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-100 border-b-2 border-slate-300">
                                                                    <h4 className="font-black text-slate-900 text-xs uppercase text-center">Previous Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-black flex items-center justify-center text-white relative group">
                                                                    <Video className="w-10 h-10 opacity-50" />
                                                                    <a href={previousAssets!.video_link!} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">Play Video</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Original</span>
                                                                    <a href={previousAssets!.video_link!} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Current Raw Video */}
                                                        {project.video_link && (
                                                            <div className={`border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${showPreviousRaw ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                                    <h4 className="font-black text-white text-xs uppercase text-center">Current Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-black flex items-center justify-center text-white relative group">
                                                                    <Video className="w-10 h-10 opacity-50" />
                                                                    <a href={project.video_link} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">Play Video</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">New Submission</span>
                                                                    <a href={project.video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Edited Video Assets */}
                                            {isVideo && (project.edited_video_link || previousAssets?.edited_video_link) && (
                                                <div className="space-y-2 mt-6 md:mt-8">
                                                    {(showPreviousEdited || project.edited_video_link) && <h4 className="text-base md:text-lg font-black text-slate-800 uppercase text-center border-b-2 border-slate-200 pb-1">Edited Video</h4>}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                                        {/* Previous Edited Video */}
                                                        {showPreviousEdited && (
                                                            <div className={`border-2 border-slate-300 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${project.edited_video_link ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-100 border-b-2 border-slate-300">
                                                                    <h4 className="font-black text-slate-900 text-xs uppercase text-center">Previous Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-black flex items-center justify-center text-white relative group">
                                                                    <Video className="w-10 h-10 opacity-50" />
                                                                    <a href={previousAssets!.edited_video_link!} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">Play Video</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Old Edit</span>
                                                                    <a href={previousAssets!.edited_video_link!} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Current Edited Video */}
                                                        {project.edited_video_link && (
                                                            <div className={`border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${showPreviousEdited ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                                    <h4 className="font-black text-white text-xs uppercase text-center">Current Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-black flex items-center justify-center text-white relative group">
                                                                    <Video className="w-10 h-10 opacity-50" />
                                                                    <a href={project.edited_video_link} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">Play Video</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">New Submission</span>
                                                                    <a href={project.edited_video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Thumbnail/Creative Assets */}
                                            {(project.thumbnail_link || previousAssets?.thumbnail_link || project.data?.creative_link || previousAssets?.creative_link) && (
                                                <div className="space-y-2 mt-6 md:mt-8">
                                                    {(showPreviousCreative || project.thumbnail_link || project.data?.creative_link) && <h4 className="text-base md:text-lg font-black text-slate-800 uppercase text-center border-b-2 border-slate-200 pb-1">Creative Assets</h4>}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                                        {/* Previous Thumbnail/Creative */}
                                                        {showPreviousCreative && (
                                                            <div className={`border-2 border-slate-300 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${project.thumbnail_link || project.data?.creative_link ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-100 border-b-2 border-slate-300">
                                                                    <h4 className="font-black text-slate-900 text-xs uppercase text-center">Previous Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 relative group overflow-hidden">
                                                                    {previousAssets?.thumbnail_link ? (
                                                                        <img src={previousAssets.thumbnail_link} alt="Previous" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <ImageIcon className="w-10 h-10" />
                                                                    )}
                                                                    <a href={previousAssets!.thumbnail_link || previousAssets!.creative_link!} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">View</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Old Design</span>
                                                                    <a href={previousAssets!.thumbnail_link || previousAssets!.creative_link!} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Current Thumbnail/Creative */}
                                                        {(project.thumbnail_link || project.data?.creative_link) && (
                                                            <div className={`border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${showPreviousCreative ? '' : 'col-span-2 max-w-lg mx-auto w-full'}`}>
                                                                <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                                    <h4 className="font-black text-white text-xs uppercase text-center">Current Version</h4>
                                                                </div>
                                                                <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 relative group overflow-hidden">
                                                                    {project.thumbnail_link ? (
                                                                        <img src={project.thumbnail_link} alt="Current" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <ImageIcon className="w-10 h-10" />
                                                                    )}
                                                                    <a href={project.thumbnail_link || project.data?.creative_link} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                                        <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">View</span>
                                                                    </a>
                                                                </div>
                                                                <div className="p-2 flex justify-between items-center bg-white">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">New Submission</span>
                                                                    <a href={project.thumbnail_link || project.data?.creative_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                                    {/* Raw Video Asset */}
                                    {isVideo && project.video_link && (
                                        <div className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                            <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                <h4 className="font-black text-white text-xs uppercase text-center">{['JOBBOARD', 'LEAD_MAGNET'].includes(project.content_type) ? 'Influencer Video' : 'Raw Video'}</h4>
                                            </div>
                                            <div className="aspect-video bg-black flex items-center justify-center text-white relative group">
                                                <Video className="w-10 h-10 opacity-50" />
                                                <a href={project.video_link} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                    <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">Play Video</span>
                                                </a>
                                            </div>
                                            <div className="p-2 flex justify-between items-center bg-white">
                                                <div>
                                                    <p className="font-black text-slate-900 text-[10px] uppercase">{['JOBBOARD', 'LEAD_MAGNET'].includes(project.content_type) ? 'Influencer_Video.mp4' : 'Raw_Video.mp4'}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold">{['JOBBOARD', 'LEAD_MAGNET'].includes(project.content_type) ? 'Influencer Video' : 'Original'}</p>
                                                </div>
                                                <a href={project.video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Edited Video Asset */}
                                    {isVideo && project.edited_video_link && (
                                        <div className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                            <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                <h4 className="font-black text-white text-xs uppercase text-center">Edited Video</h4>
                                            </div>
                                            <div className="aspect-video bg-black flex items-center justify-center text-white relative group">
                                                <Video className="w-10 h-10 opacity-50" />
                                                <a href={project.edited_video_link} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                    <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">Play Video</span>
                                                </a>
                                            </div>
                                            <div className="p-2 flex justify-between items-center bg-white">
                                                <div>
                                                    <p className="font-black text-slate-900 text-[10px] uppercase">Edited_Video.mp4</p>
                                                    <p className="text-[10px] text-slate-500 font-bold">Final Edit</p>
                                                </div>
                                                <a href={project.edited_video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Thumbnail/Creative Asset */}
                                    {project.thumbnail_link ? (
                                        <div className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                            <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                <h4 className="font-black text-white text-xs uppercase text-center">Creative</h4>
                                            </div>
                                            <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 relative group overflow-hidden">
                                                <img src={project.thumbnail_link} alt="Creative" className="w-full h-full object-cover" />
                                                <a href={project.thumbnail_link} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                    <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">View</span>
                                                </a>
                                            </div>
                                            <div className="p-2 flex justify-between items-center bg-white">
                                                <div>
                                                    <p className="font-black text-slate-900 text-[10px] uppercase">Creative_Thumbnail.png</p>
                                                    <p className="text-[10px] text-slate-500 font-bold">PNG</p>
                                                </div>
                                                <a href={project.thumbnail_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Download</a>
                                            </div>
                                        </div>
                                    ) : project.data?.creative_link && (
                                        <div className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                            <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                <h4 className="font-black text-white text-xs uppercase text-center">Creative Link</h4>
                                            </div>
                                            <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 relative group">
                                                <ImageIcon className="w-10 h-10" />
                                                <a href={project.data.creative_link} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all opacity-0 group-hover:opacity-100">
                                                    <span className="px-3 py-1 bg-white text-black font-black uppercase text-xs border-2 border-black">View</span>
                                                </a>
                                            </div>
                                            <div className="p-2 flex justify-between items-center bg-white">
                                                <div>
                                                    <p className="font-black text-slate-900 text-[10px] uppercase">Creative Link</p>
                                                    <p className="text-[10px] text-slate-500 font-bold">External</p>
                                                </div>
                                                <a href={project.data.creative_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-black uppercase">Open</a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* RIGHT COLUMN: Approval Panel - Vertical on mobile/tablet, Sidebar on desktop */}
                <div className="w-full lg:w-[400px] xl:w-[450px] bg-white border-t-2 lg:border-t-0 lg:border-l-2 border-black p-5 md:p-8 shadow-[-10px_0px_20px_rgba(0,0,0,0.05)] sticky bottom-0 lg:top-20 lg:h-[calc(100vh-80px)] overflow-y-auto z-30 flex flex-col">
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase mb-4 md:mb-8 border-b-4 border-black pb-2 inline-block">Final Decision</h2>

                    <div className="space-y-4 flex-1">
                        {/* Approve Option */}
                        <label className={`block p-4 md:p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${decision === 'APPROVE' ? 'border-black bg-[#4ADE80]' : 'border-black bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center">
                                <input
                                    type="radio"
                                    name="decision"
                                    className="w-4 h-4 md:w-5 md:h-5 accent-black"
                                    checked={decision === 'APPROVE'}
                                    onChange={() => setDecision('APPROVE')}
                                />
                                <div className="ml-3 md:ml-4 flex-1">
                                    <span className="block font-black text-base md:text-lg uppercase text-slate-900">Approve Content</span>
                                    <span className="text-[10px] md:text-xs font-bold uppercase text-slate-600">
                                        {project.current_stage.includes('SCRIPT') ? 'Move to Production' : 'Ready for Publishing'}
                                    </span>
                                </div>
                                <Check className="w-6 h-6 md:w-8 md:h-8 ml-auto text-black" />
                            </div>
                        </label>

                        {/* Rework Option */}
                        <label className={`block p-4 md:p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${decision === 'REWORK' ? 'border-black bg-[#FFD952]' : 'border-black bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center">
                                <input
                                    type="radio"
                                    name="decision"
                                    className="w-4 h-4 md:w-5 md:h-5 accent-black"
                                    checked={decision === 'REWORK'}
                                    onChange={() => { setDecision('REWORK'); setReworkStage(''); }}
                                />
                                <div className="ml-3 md:ml-4 flex-1">
                                    <span className="block font-black text-base md:text-lg uppercase text-slate-900">Request Rework</span>
                                    <span className="text-[10px] md:text-xs font-bold uppercase text-slate-600">Send back for edits</span>
                                </div>
                                <RotateCcw className="w-6 h-6 md:w-8 md:h-8 ml-auto text-black" />
                            </div>
                        </label>

                        {/* Reject Option */}
                        <label className={`block p-4 md:p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${decision === 'REJECT' ? 'border-black bg-[#FF4F4F] text-white' : 'border-black bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center">
                                <input
                                    type="radio"
                                    name="decision"
                                    className="w-4 h-4 md:w-5 md:h-5 accent-black"
                                    checked={decision === 'REJECT'}
                                    onChange={() => setDecision('REJECT')}
                                />
                                <div className="ml-3 md:ml-4 flex-1">
                                    <span className={`block font-black text-base md:text-lg uppercase ${decision === 'REJECT' ? 'text-white' : 'text-slate-900'}`}>Reject</span>
                                    <span className={`text-[10px] md:text-xs font-bold uppercase ${decision === 'REJECT' ? 'text-white/80' : 'text-slate-600'}`}>Terminate workflow</span>
                                </div>
                                <X className={`w-6 h-6 md:w-8 md:h-8 ml-auto ${decision === 'REJECT' ? 'text-white' : 'text-black'}`} />
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

                        {/* Approve Comments - Dropdown only */}
                        {decision === 'APPROVE' && (
                            <div className="animate-fade-in space-y-2">
                                <label className="block text-xs font-black text-slate-500 uppercase">Comment (Optional)</label>
                                <select
                                    value={approveComment}
                                    onChange={(e) => setApproveComment(e.target.value)}
                                    className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold text-sm uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                                >
                                    <option value="">-- Select Comment --</option>
                                    <option value="Good work">Good work</option>
                                    <option value="Looks good">Looks good</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Approved without changes">Approved without changes</option>
                                </select>
                            </div>
                        )}

                        {/* Rework Comments - Mandatory dropdown + input */}
                        {decision === 'REWORK' && (
                            <div className="animate-fade-in space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-slate-500 uppercase">Reason *</label>
                                    <select
                                        value={reworkReason}
                                        onChange={(e) => {
                                            setReworkReason(e.target.value);
                                            // Auto-populate the text input with the selected dropdown value
                                            if (e.target.value !== 'Other') {
                                                setReworkComment(e.target.value);
                                            } else {
                                                setReworkComment(''); // Clear the input when 'Other' is selected
                                            }
                                        }}
                                        className={`w-full p-4 border-2 ${reworkReason ? 'border-black' : 'border-red-500'} bg-white focus:bg-yellow-50 focus:outline-none font-bold text-sm uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]`}
                                    >
                                        <option value="">-- Select Reason --</option>
                                        <option value="Needs rework">Needs rework</option>
                                        <option value="Minor changes required">Minor changes required</option>
                                        <option value="Major changes required">Major changes required</option>
                                        <option value="Script improvement needed">Script improvement needed</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    {!reworkReason && (
                                        <p className="text-xs text-red-500 font-bold">Reason is required</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-slate-500 uppercase">Additional Instructions *</label>
                                    <textarea
                                        value={reworkComment}
                                        onChange={(e) => setReworkComment(e.target.value)}
                                        placeholder="Provide specific instructions..."
                                        className={`w-full p-4 border-2 ${reworkComment ? 'border-black' : 'border-red-500'} rounded-none text-sm min-h-[100px] focus:bg-yellow-50 focus:outline-none font-medium resize-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]`}
                                    />
                                    {!reworkComment && (
                                        <p className="text-xs text-red-500 font-bold">Instructions are required</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Reject Comments - Textarea */}
                        {decision === 'REJECT' && (
                            <div className="animate-fade-in space-y-2">
                                <label className="block text-xs font-black text-slate-500 uppercase">Reason *</label>
                                <textarea
                                    value={rejectComment}
                                    onChange={(e) => setRejectComment(e.target.value)}
                                    placeholder="Please provide reason for rejection..."
                                    className={`w-full p-4 border-2 ${rejectComment ? 'border-black' : 'border-red-500'} rounded-none text-sm min-h-[120px] focus:bg-yellow-50 focus:outline-none font-medium resize-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]`}
                                />
                                {!rejectComment && (
                                    <p className="text-xs text-red-500 font-bold">Reason is required</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-8">
                        <button
                            disabled={!decision || isSubmitting ||
                                (decision === 'REWORK' && (!reworkStage || reworkStage === '' || !reworkReason || !reworkComment)) ||
                                (decision === 'REJECT' && (!rejectComment || rejectComment.trim() === ''))}
                            onClick={() => {
                                console.log('Button clicked', { decision, reworkStage, approveComment, reworkReason, reworkComment, rejectComment });
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
            </div >
            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={() => {
                        setShowPopup(false);
                        onComplete();
                    }}
                    duration={popupDuration}
                />
            )}

            {/* Confirmation Popup */}
            {
                showConfirmation && (
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
                )
            }
        </div >
    );
};

export default CeoReviewScreen;