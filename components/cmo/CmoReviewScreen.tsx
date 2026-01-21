import React, { useState, useRef, useEffect } from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, TaskStatus, Channel } from '../../types';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { ArrowLeft, Check, RotateCcw, X, Video, Image as ImageIcon, Download } from 'lucide-react';
import Popup from '../Popup';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getWorkflowState } from '../../services/workflowUtils';

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

    const isFinalReview = project.current_stage === WorkflowStage.FINAL_REVIEW_CMO;
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


    useEffect(() => {
        const fetchPreviousScript = async () => {
            // Fetch previous script version and asset links if project is rejected
            const { data: historyData, error: historyError } = await supabase
                .from('workflow_history')
                .select('script_content, video_link, edited_video_link, thumbnail_link, creative_link')
                .eq('project_id', project.id)
                .in('action', ['REJECTED', 'REWORK', 'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED'])
                .order('timestamp', { ascending: false })
                .limit(1);

            if (historyError) {
                // Handle case where script_content column doesn't exist yet
                if (historyError.code === '42703') {
                    console.warn('script_content column not found in workflow_history table. This is expected if the migration hasn\'t been applied yet.');
                } else {
                    console.error('Error fetching previous script:', historyError);
                }
            } else if (historyData && historyData.length > 0) {
                if (historyData[0].script_content) {
                    setPreviousScript(historyData[0].script_content);
                }

                // Set previous asset links
                setPreviousAssets({
                    video_link: historyData[0].video_link,
                    edited_video_link: historyData[0].edited_video_link,
                    thumbnail_link: historyData[0].thumbnail_link,
                    creative_link: historyData[0].creative_link
                });
            }
        };

        fetchPreviousScript();
    }, [project.id]);

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
                    
                    await db.workflow.approve(
                        project.id,
                        db.getCurrentUser()?.id || '',
                        db.getCurrentUser()?.full_name || 'CMO',
                        Role.CMO,
                        nextStageInfo.stage,
                        nextStageInfo.role,
                        comment || 'Approved by CMO'
                    );
                } else {
                    await db.advanceWorkflow(project.id, comment || 'Approved by CMO');
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
                        
                        await supabase
                            .from('projects')
                            .update({ forwarded_comments: updatedComments })
                            .eq('id', project.id);
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
                
                // Ensure database updates propagate, then show the popup
                // First, fetch the updated project to confirm the stage has changed
                const updatedProject = await db.getProjectById(project.id);
                if (updatedProject && updatedProject.current_stage !== project.current_stage) {
                    // Project has moved to the next stage, show the popup immediately
                    setShowPopup(true);
                } else {
                    // Project hasn't moved yet, wait a bit and then show popup
                    // This might be due to database transaction timing
                    setTimeout(() => {
                        setShowPopup(true);
                    }, 500);
                }
            } else if (decision === 'REWORK') {
                // Rework -> Smart routing based on who sent for rework
                
                // Check workflow history to determine who sent this project for rework
                const { data: history, error: historyError } = await supabase
                    .from('workflow_history')
                    .select('actor_id, action, comment, timestamp')
                    .eq('project_id', project.id)
                    .order('timestamp', { ascending: false });

                if (historyError) {
                    console.error('Error fetching workflow history:', historyError);
                    // Fallback to standard rejectTask if history fetch fails
                    await db.rejectTask(project.id, reworkStage as WorkflowStage, comment);
                } else {
                    // Find the most recent REWORK action
                    const reworkHistory = history?.find(h => h.action === 'REWORK');
                    
                    if (reworkHistory) {
                        // Get the actor's role to determine where to send it back
                        const { data: reviewer, error: reviewerError } = await supabase
                            .from('users')
                            .select('role')
                            .eq('id', reworkHistory.actor_id)
                            .single();
                        
                        if (!reviewerError && reviewer) {
                            // ✅ Route based on WHO sent for rework, not current user role
                            let targetRole: Role;
                            let targetStage: WorkflowStage;
                            
                            if (reviewer.role === Role.CEO) {
                                // If CEO sent for rework, go directly back to CEO
                                targetRole = Role.CEO;
                                targetStage = WorkflowStage.FINAL_REVIEW_CEO;
                            } else {
                                // Otherwise (Writer or others), go to Writer
                                targetRole = Role.WRITER;
                                targetStage = WorkflowStage.SCRIPT;
                            }
                            
                            // Update the project with the routed destination
                            await db.projects.update(project.id, {
                                current_stage: targetStage,
                                assigned_to_role: targetRole,
                                status: TaskStatus.WAITING_APPROVAL
                            });
                            
                            // Add workflow history entry
                            await db.workflow.recordAction(
                                project.id,
                                targetStage as WorkflowStage,
                                db.getCurrentUser()?.id || '',
                                db.getCurrentUser()?.full_name || 'CMO',
                                'REWORK',
                                comment || 'CMO requested rework',
                                undefined,
                                Role.CMO, // fromRole
                                targetRole as Role, // toRole
                                Role.CMO // actorRole
                            );
                        } else {
                            // Fallback if reviewer role cannot be determined
                            await db.rejectTask(project.id, reworkStage as WorkflowStage, comment);
                        }
                    } else {
                        // Fallback if no rework history found
                        await db.rejectTask(project.id, reworkStage as WorkflowStage, comment);
                    }
                }

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

        // For Final Review CMO, can send back to various roles
        if (project.current_stage === WorkflowStage.FINAL_REVIEW_CMO) {
            const options = [];

            // Add Designer option only if thumbnail is required
            const thumbnailRequired = project.data?.thumbnail_required;
            if (thumbnailRequired !== false) { // Include designer if thumbnail_required is true or undefined
                options.push({ value: WorkflowStage.CREATIVE_DESIGN, label: 'Designer (Fix Visuals)' });
            }

            // If video channel, add Editor/Cine
            if (isVideo) {
                options.push({ value: WorkflowStage.VIDEO_EDITING, label: 'Editor (Fix Video)' });
                options.push({ value: WorkflowStage.CINEMATOGRAPHY, label: 'Cinematographer (Reshoot)' });
            }
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
                            {previousScript && (
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
                                {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative' : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Idea' : previousScript ? 'Rework' : 'New'}
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
                            {previousScript ? (
                                // Show both old and new scripts side by side
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Previous Script */}
                                    <div className="bg-white border-2 border-slate-300 p-6">
                                        <h4 className="font-black text-slate-900 uppercase mb-4 text-center">
                                            {project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Previous Idea' : 'Previous Script'}
                                        </h4>
                                        <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-slate-50 p-4 border-2 border-slate-200 max-h-96 overflow-y-auto">
                                            {previousScript ? <div dangerouslySetInnerHTML={{ __html: previousScript }} /> : previousScript}
                                        </div>
                                    </div>

                                    {/* Current Script */}
                                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] p-6">
                                        <h4 className="font-black text-slate-900 uppercase mb-4 text-center">
                                            {project.data?.source === 'DESIGNER_INITIATED' ? 'Creative Link' : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'Current Idea' : 'Current Script'}
                                        </h4>
                                        <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-white p-4 border-2 border-black max-h-96 overflow-y-auto">
                                            {project.data?.source === 'DESIGNER_INITIATED'
                                                ? project.data?.creative_link || 'No creative link available.'
                                                : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content
                                                    ? project.data.idea_description
                                                    : project.data?.script_content 
                                                        ? <div dangerouslySetInnerHTML={{ __html: project.data.script_content }} />
                                                        : 'No script content available.'}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Show single script for non-rework projects
                                <div
                                    className="border-2 border-black bg-white p-8 min-h-[300px] whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                >
                                    {project.data?.source === 'DESIGNER_INITIATED'
                                        ? project.data?.creative_link || 'No creative link available.'
                                        : project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content
                                            ? project.data.idea_description
                                            : project.data?.script_content 
                                                ? <div dangerouslySetInnerHTML={{ __html: project.data.script_content }} />
                                                : 'No script content available.'}
                                </div>
                            )}
                        </div>
                    </section>



                    {/* Assets Section (Only for final review) */}
                    {(project.current_stage === WorkflowStage.FINAL_REVIEW_CMO || project.current_stage === WorkflowStage.POST_WRITER_REVIEW) && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Production Assets</h3>

                            {previousScript ? (
                                // Show both previous and current assets side by side for rework projects
                                <div className="space-y-8">
                                    {/* Raw Video Assets */}
                                    {isVideo && (project.video_link || previousAssets?.video_link) && (
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* Previous Raw Video */}
                                            {previousAssets?.video_link && (
                                                <div className="border-2 border-slate-300 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-100 border-b-2 border-slate-300">
                                                        <h4 className="font-black text-slate-900 text-sm uppercase text-center">Previous Raw Video</h4>
                                                    </div>
                                                    <div className="aspect-video bg-black flex items-center justify-center text-white">
                                                        <Video className="w-16 h-16 opacity-50" />
                                                    </div>
                                                    <div className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <p className="font-black text-slate-900 text-sm uppercase">Raw_Video.mp4</p>
                                                            <p className="text-xs text-slate-500 font-bold">Original footage</p>
                                                        </div>
                                                        <a href={previousAssets.video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Current Raw Video */}
                                            {project.video_link && (
                                                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-900 border-b-2 border-black">
                                                        <h4 className="font-black text-white text-sm uppercase text-center">Current Raw Video</h4>
                                                    </div>
                                                    <div className="aspect-video bg-black flex items-center justify-center text-white">
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
                                        </div>
                                    )}

                                    {/* Edited Video Assets */}
                                    {isVideo && (project.edited_video_link || previousAssets?.edited_video_link) && (
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* Previous Edited Video */}
                                            {previousAssets?.edited_video_link && (
                                                <div className="border-2 border-slate-300 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-100 border-b-2 border-slate-300">
                                                        <h4 className="font-black text-slate-900 text-sm uppercase text-center">Previous Edited Video</h4>
                                                    </div>
                                                    <div className="aspect-video bg-black flex items-center justify-center text-white">
                                                        <Video className="w-16 h-16 opacity-50" />
                                                    </div>
                                                    <div className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <p className="font-black text-slate-900 text-sm uppercase">Edited_Video.mp4</p>
                                                            <p className="text-xs text-slate-500 font-bold">1080p • 24mb</p>
                                                        </div>
                                                        <a href={previousAssets.edited_video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Current Edited Video */}
                                            {project.edited_video_link && (
                                                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-900 border-b-2 border-black">
                                                        <h4 className="font-black text-white text-sm uppercase text-center">Current Edited Video</h4>
                                                    </div>
                                                    <div className="aspect-video bg-black flex items-center justify-center text-white">
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
                                        </div>
                                    )}

                                    {/* Thumbnail/Creative Assets */}
                                    {(project.thumbnail_link || previousAssets?.thumbnail_link || project.data?.creative_link || (previousScript && project.data?.creative_link)) && (
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* Previous Thumbnail/Creative */}
                                            {(previousAssets?.thumbnail_link || previousAssets?.creative_link) && (
                                                <div className="border-2 border-slate-300 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-100 border-b-2 border-slate-300">
                                                        <h4 className="font-black text-slate-900 text-sm uppercase text-center">Previous Creative</h4>
                                                    </div>
                                                    <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300">
                                                        <ImageIcon className="w-16 h-16" />
                                                    </div>
                                                    <div className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <p className="font-black text-slate-900 text-sm uppercase">
                                                                {previousAssets?.thumbnail_link ? 'Creative_Thumbnail.png' : 'Creative Link'}
                                                            </p>
                                                            <p className="text-xs text-slate-500 font-bold">
                                                                {previousAssets?.thumbnail_link ? 'PNG • 2mb' : 'External Link'}
                                                            </p>
                                                        </div>
                                                        <a href={previousAssets.thumbnail_link || previousAssets.creative_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">
                                                            {previousAssets?.thumbnail_link ? 'View File' : 'View Link'}
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Current Thumbnail/Creative or Creative Link */}
                                            {project.thumbnail_link ? (
                                                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-900 border-b-2 border-black">
                                                        <h4 className="font-black text-white text-sm uppercase text-center">Current Creative</h4>
                                                    </div>
                                                    <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300">
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
                                                    <div className="p-3 bg-slate-900 border-b-2 border-black">
                                                        <h4 className="font-black text-white text-sm uppercase text-center">Current Creative</h4>
                                                    </div>
                                                    <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300">
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
                                </div>
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