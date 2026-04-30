import React, { useState } from 'react';
import { Project, User, WorkflowStage, Channel, STAGE_LABELS, Role, TaskStatus } from '../../types';
import ScriptDisplay from '../ScriptDisplay';
import Popup from '../Popup';
import { ArrowLeft, Send, Loader2, Video, Check, RotateCcw, X, ExternalLink, CheckCircle2, Play, Download, History, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    project: Project;
    user: User;
    onBack: () => void;
    onComplete: () => void;
    fromCeoApproved?: boolean; // Track if opened from CEO Approved Scripts page
    allProjects?: Project[];
}

const PAReviewScreen: React.FC<Props> = ({ project, user, onBack, onComplete, fromCeoApproved = false, allProjects = [] }) => {
    // Shared states
    const [isSending, setIsSending] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [comment, setComment] = useState('');

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupType, setPopupType] = useState<'success' | 'error'>('success');
    const [popupDuration, setPopupDuration] = useState(5000);

    // Stage 1: PARTNER_REVIEW
    const [influencerName, setInfluencerName] = useState(project.data?.influencer_name || '');
    const [influencerEmail, setInfluencerEmail] = useState(project.data?.influencer_email || '');
    const [contentDescription, setContentDescription] = useState(project.data?.content_description || '');

    // Stage 2: SENT_TO_INFLUENCER
    const [rawVideoLink, setRawVideoLink] = useState(project.video_link || '');

    // Stage 4: PA_FINAL_REVIEW
    const [finalDecision, setFinalDecision] = useState<'APPROVE' | 'REWORK' | 'REJECT' | null>(null);
    const [reworkReason, setReworkReason] = useState('');
    const [externalHistory, setExternalHistory] = useState<any[]>([]);

    // Posting Details (for POSTED stage)
    const [postScheduledDate, setPostScheduledDate] = useState(project.post_scheduled_date || '');
    const [postingProofLink, setPostingProofLink] = useState(project.data?.posting_proof_link || '');
    const [isSavingPosting, setIsSavingPosting] = useState(false);

    const currentStage = project.current_stage;

    // Determine if this project is a child instance or the shared parent
    const isChildInstance = project.data?.influencer_instance === true;

    React.useEffect(() => {
        const fetchHistory = async () => {
            const parentId = project.data?.parent_script_id || project.id;
            const data = await db.influencers.getByParent(parentId);
            setExternalHistory(data || []);
        };
        fetchHistory();
    }, [project.id, project.data?.parent_script_id]);

    // Stage checks — for parent projects in PARTNER_REVIEW, PA sees the "Send to Influencer" form
    // For child instances, they see the relevant action for their stage
    const isInitialReview = currentStage === WorkflowStage.PARTNER_REVIEW;
    // Widen SENT_TO_INFLUENCER check — don't require isChildInstance flag in case it's missing
    const isSentToInfluencer = currentStage === WorkflowStage.SENT_TO_INFLUENCER;
    const isEditing = currentStage === WorkflowStage.VIDEO_EDITING && isChildInstance;
    const isFinalReview = currentStage === WorkflowStage.PA_FINAL_REVIEW && isChildInstance;
    const isApproved = currentStage === WorkflowStage.POSTED && isChildInstance;

    const handleSendAndAdvance = async () => {
        setIsSending(true);
        try {
            const { data: latestProject } = await supabase.from('projects').select('*').eq('id', project.id).single();
            const scriptContent = project.data?.script_content || project.data?.idea_description || 'No script content available';

            // ✅ FIX: Create a new child project instance scoped to this PA user and influencer.
            // The parent project stays in PARTNER_REVIEW so other PAs can independently work on it.
            const parentId = project.data?.parent_script_id || project.id;

            const newChildProjectData = {
                title: project.title,
                channel: project.channel,
                content_type: project.content_type,
                current_stage: WorkflowStage.SENT_TO_INFLUENCER,
                status: TaskStatus.TODO,
                priority: project.priority,
                brand: project.brand,
                due_date: project.due_date,
                pa_script_sent_at: new Date().toISOString(),
                assigned_to_role: Role.PARTNER_ASSOCIATE,
                assigned_to_user_id: user.id,
                created_by_user_id: user.id,
                created_by_name: user.full_name,
                writer_id: project.writer_id,
                writer_name: project.writer_name,
                data: {
                    ...(latestProject?.data || project.data || {}),
                    // Child-instance specific fields
                    influencer_name: influencerName,
                    influencer_email: influencerEmail,
                    content_description: contentDescription,
                    parent_script_id: parentId,
                    influencer_instance: true,
                    is_pa_brand: latestProject?.data?.is_pa_brand ?? project.data?.is_pa_brand ?? true,
                    sent_by_id: user.id,
                    sent_by_name: user.full_name,
                    influencer_history: [{
                        influencer_name: influencerName,
                        influencer_email: influencerEmail,
                        sent_at: new Date().toISOString(),
                        sent_by: user.full_name || 'PA',
                        sent_by_id: user.id,
                        action: 'INITIAL_OUTREACH'
                    }]
                }
            };

            const createdProject = await db.projects.create(newChildProjectData as any);

            // Log to influencers table for history tracking
            await db.influencers.log({
                parent_project_id: parentId,
                instance_project_id: createdProject.id,
                influencer_name: influencerName,
                influencer_email: influencerEmail,
                script_content: scriptContent,
                content_description: contentDescription,
                sent_by: user.full_name || 'PA',
                sent_by_id: user.id,
                status: 'SENT_TO_INFLUENCER'
            });

            // Send email to influencer
            await supabase.functions.invoke('send-workflow-email', {
                body: {
                    event: 'SEND_TO_INFLUENCER',
                    recipient_email: influencerEmail,
                    data: {
                        project_id: createdProject.id,
                        actor_name: user.full_name || 'PA',
                        comment: 'Campaign launched by PA',
                        content_description: contentDescription || project.data?.brief || 'Script content for review',
                        script_content: scriptContent,
                        influencer_name: influencerName
                    }
                }
            });

            setPopupMessage('Script sent to ' + influencerName + '. Your personal pipeline has been updated.');
            setStageName('SENT TO INFLUENCER');
            toast.success('Script sent to ' + influencerName);
            setShowPopup(true);
            setShowConfirmModal(false);
        } catch (error: any) {
            toast.error(error.message || 'Error processing campaign.');
            setShowConfirmModal(false);
        } finally {
            setIsSending(false);
        }
    };

    const handleUploadRawVideo = async () => {
        setIsSending(true);
        try {
            console.log('Attempting to update project', project.id, 'to stage PA_VIDEO_CMO_REVIEW');

            // Use db.projects.update to ensure correct column mapping (status → task_status)
            await db.projects.update(project.id, {
                video_link: rawVideoLink,
                current_stage: WorkflowStage.PA_VIDEO_CMO_REVIEW,
                assigned_to_role: Role.CMO,
                status: TaskStatus.WAITING_APPROVAL,
                assigned_to_user_id: null,
                pa_raw_footage_uploaded_at: new Date().toISOString(),
                data: {
                    ...(project.data || {}),
                    sent_by_id: project.data?.sent_by_id || user.id,
                    uploaded_by_pa_id: user.id,
                    uploaded_by_pa_name: user.full_name,
                    influencer_instance: true
                }
            } as any);

            console.log('Update successful, logging history...');

            await supabase.from('workflow_history').insert({
                project_id: project.id,
                action: 'VIDEO_UPLOADED_FOR_CMO_REVIEW',
                actor_name: user.full_name || 'PA',
                actor_role: 'PARTNER_ASSOCIATE',
                from_stage: WorkflowStage.SENT_TO_INFLUENCER,
                to_stage: WorkflowStage.PA_VIDEO_CMO_REVIEW,
                from_role: 'PARTNER_ASSOCIATE',
                to_role: 'CMO',
                comment: `Influencer video received by ${user.full_name} and sent to CMO for review`,
                stage: WorkflowStage.PA_VIDEO_CMO_REVIEW
            });

            console.log('History logged, showing popup...');

            setPopupMessage('The influencer video is uploaded. It moves to the CMO for review.');
            setStageName('CMO VIDEO REVIEW');
            toast.success('Video uploaded and sent to CMO for review');
            setShowPopup(true);
            setShowConfirmModal(false);
        } catch (error: any) {
            toast.error(error.message || 'Error updating project.');
            setShowConfirmModal(false);
        } finally {
            setIsSending(false);
        }
    };

    const handleFinalDecisionSubmit = async () => {
        if (!finalDecision) return;
        setIsSending(true);
        try {
            if (finalDecision === 'APPROVE') {
                await db.advanceWorkflow(project.id, 'PA Final Approval - Video ready for posting');
                // Ensure it stays assigned to the PA who approved it for their "Completed" count
                await db.projects.update(project.id, { 
                    assigned_to_user_id: user.id,
                    pa_final_approval_at: new Date().toISOString()
                });
            } else if (finalDecision === 'REWORK') {
                if (!reworkReason.trim()) {
                    toast.error('Please provide a rework reason');
                    setIsSending(false);
                    return;
                }
                
                // Move back to EDITOR
                await db.projects.update(project.id, {
                    current_stage: WorkflowStage.VIDEO_EDITING,
                    assigned_to_role: Role.EDITOR,
                    status: TaskStatus.REWORK,
                    assigned_to_user_id: user.id
                });

                await supabase.from('workflow_history').insert({
                    project_id: project.id,
                    action: 'REWORK',
                    actor_name: user.full_name || 'PA',
                    actor_role: Role.PARTNER_ASSOCIATE,
                    from_stage: WorkflowStage.PA_FINAL_REVIEW,
                    to_stage: WorkflowStage.VIDEO_EDITING,
                    from_role: Role.PARTNER_ASSOCIATE,
                    to_role: Role.EDITOR,
                    comment: reworkReason,
                    stage: WorkflowStage.VIDEO_EDITING
                });
            } else if (finalDecision === 'REJECT') {
                await db.projects.update(project.id, {
                    status: TaskStatus.REJECTED,
                    assigned_to_user_id: user.id,
                    pa_rejection_at: new Date().toISOString()
                });
                await supabase.from('workflow_history').insert({
                    project_id: project.id,
                    action: 'REJECTED',
                    actor_name: user.full_name || 'PA',
                    actor_role: Role.PARTNER_ASSOCIATE,
                    comment: 'Project rejected by PA',
                    stage: WorkflowStage.PA_FINAL_REVIEW
                });
            }

            if (finalDecision === 'APPROVE') {
                setPopupMessage('The video is approved now it shows in the video approved page');
                setStageName('POSTED');
                toast.success('Video approved successfully!');
            } else if (finalDecision === 'REWORK') {
                setPopupMessage('PA has sent the content back for rework to the Editor.');
                setStageName('Rework → Editor');
                toast.success('Sent back for rework');
            } else if (finalDecision === 'REJECT') {
                setPopupMessage('PA has rejected the content.');
                setStageName('REJECTED');
                toast.success('Project rejected');
            }
            setShowPopup(true);
            setShowConfirmModal(false);
        } catch (error: any) {
            toast.error(error.message || 'Error processing decision.');
            setShowConfirmModal(false);
        } finally {
            setIsSending(false);
        }
    };

    const handleUpdatePostingDetails = async () => {
        setIsSavingPosting(true);
        try {
            await db.projects.update(project.id, {
                post_scheduled_date: postScheduledDate,
                pa_posting_proof_added_at: new Date().toISOString(),
                data: {
                    ...(project.data || {}),
                    posting_proof_link: postingProofLink
                }
            } as any);
            toast.success('Posting details updated successfully');
        } catch (error: any) {
            toast.error(error.message || 'Error updating posting details');
        } finally {
            setIsSavingPosting(false);
        }
    };



    const triggerSubmit = () => {
        if (isInitialReview) {
            if (!influencerName.trim()) { 
                setPopupMessage('Influencer name is required');
                setPopupType('error');
                setShowPopup(true);
                return; 
            }
            if (!influencerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(influencerEmail)) { 
                setPopupMessage('Enter a valid influencer email address');
                setPopupType('error');
                setShowPopup(true);
                return; 
            }
        } else if (isSentToInfluencer) {
            if (!rawVideoLink.trim()) { 
                setPopupMessage('Video link is required to proceed');
                setPopupType('error');
                setShowPopup(true);
                return; 
            }
        } else if (isFinalReview) {
            if (!finalDecision) { 
                setPopupMessage('Please select a decision (Approve, Rework, or Reject)');
                setPopupType('error');
                setShowPopup(true);
                return; 
            }
            if (finalDecision === 'APPROVE') {
                // No validation needed for approved
            }
            if (finalDecision === 'REWORK' && !reworkReason.trim()) { 
                setPopupMessage('Please provide a reason for the rework requested');
                setPopupType('error');
                setShowPopup(true);
                return; 
            }
        }
        setShowConfirmModal(true);
    };

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col animate-fade-in relative">
            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white border-[3px] border-black p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative animate-scale-in">
                        <button 
                            onClick={() => setShowConfirmModal(false)}
                            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6 text-slate-400" />
                        </button>
                        
                        <h3 className="text-2xl font-black uppercase mb-6 tracking-tight text-slate-900 pr-8">CONFIRM ACTION</h3>
                        
                        <p className="text-slate-600 font-medium mb-8 text-lg leading-relaxed">
                            {isFinalReview ? `Are you sure you want to ${finalDecision === 'APPROVE' ? 'approve this content' : finalDecision === 'REWORK' ? 'request a rework' : 'reject this workflow'}?` : 
                             isInitialReview ? `Are you sure you want to launch outreach to ${influencerName || 'this influencer'}?` : 'Are you sure you want to submit the video link?'}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4 mt-8">
                            <button 
                                onClick={() => setShowConfirmModal(false)} 
                                className="py-4 border-2 border-black bg-white text-black font-black uppercase text-sm tracking-widest hover:bg-slate-50 transition-all active:translate-y-[2px]"
                            >
                                NO
                            </button>
                            <button 
                                onClick={isInitialReview ? handleSendAndAdvance : isSentToInfluencer ? handleUploadRawVideo : handleFinalDecisionSubmit} 
                                disabled={isSending}
                                className="py-4 border-2 border-black bg-[#0085FF] text-white font-black uppercase text-sm tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 active:translate-y-[2px]"
                            >
                                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'YES'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20">
                <div className="flex items-center space-x-6">
                    <button onClick={onBack} className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full">
                        <ArrowLeft className="w-6 h-6 text-black" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">{project.title}</h1>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                            <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                {STAGE_LABELS[project.current_stage]}
                            </span>
                            <span className={`px-3 py-1 text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                                project.channel === Channel.YOUTUBE ? 'bg-[#FF4F4F] text-white' :
                                project.channel === Channel.LINKEDIN ? 'bg-[#0085FF] text-white' :
                                project.channel === Channel.INSTAGRAM ? 'bg-[#D946EF] text-white' :
                                'bg-black text-white'
                            }`}>
                                {project.channel}
                            </span>
                            <span className={`px-3 py-1 text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                                project.priority === 'HIGH' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-900'
                            }`}>
                                {project.priority}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar h-[calc(100vh-80px)]">
                <div className="flex flex-col md:flex-row w-full items-start min-h-full">
                    {/* CONSISTENT LEFT COLUMN */}
                    <div className="flex-1 px-6 md:px-12 pb-12 bg-slate-50 min-h-full">
                        <div className="mt-8 bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Creator</label>
                                <div className="font-bold text-slate-900 uppercase text-xs truncate">{project.writer_name || project.created_by_name || 'System'}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Channel</label>
                                <div className="font-bold text-slate-900 uppercase text-xs">{project.channel}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Type</label>
                                <div className="font-bold text-slate-900 uppercase text-xs">{project.content_type?.replace(/_/g, ' ')}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Brand</label>
                                <div className="font-bold text-[#0085FF] uppercase text-xs truncate">{project.brand?.replace(/_/g, ' ') || 'UNBRANDED'}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Influencer</label>
                                <div className="font-bold text-slate-900 uppercase text-xs truncate">{project.data?.influencer_name || (project as any).influencer_name || '—'}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Email</label>
                                <div className="font-bold text-slate-900 uppercase text-xs truncate">{project.data?.influencer_email || (project as any).influencer_email || '—'}</div>
                            </div>
                        </div>

                        {project.data?.brief && (
                            <section className="space-y-4 pt-4">
                                <h3 className="text-2xl font-black text-slate-900 uppercase">Campaign Brief</h3>
                                <div className="border-2 border-black bg-white p-8 min-h-[100px] whitespace-pre-wrap text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    {project.data.brief}
                                </div>
                            </section>
                        )}

                        <section className="space-y-4 pt-4">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Script Content</h3>
                            <div className="border-2 border-black bg-white p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <ScriptDisplay 
                                    content={project.data?.script_content || project.data?.idea_description || 'Content empty.'} 
                                    caption={project.data?.captions}
                                    showBox={false} 
                                />
                            </div>
                        </section>

                        {fromCeoApproved && (
                            <section className="space-y-6 pt-12 pb-12">
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                                    <History className="w-8 h-8 text-black" /> Influencer History
                                </h3>
                                <div className="space-y-8">
                                    {(() => {
                                        const parentId = project.data?.parent_script_id || project.id;
                                        
                                        // Internal history from project data
                                        const internalHistory = (project.data?.influencer_history || [])
                                            .map((h: any) => ({ ...h, source: 'Internal' }));

                                        // External logs from influencers table
                                        const externalLog = (externalHistory || [])
                                            .map(h => ({ ...h, source: 'Registry', action: h.action || 'CAMPAIGN_OUTREACH' }));

                                        const combined = [...internalHistory, ...externalLog]
                                            .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

                                        if (combined.length === 0) return (
                                            <div className="p-10 border-2 border-dashed border-slate-300 text-center text-slate-400 font-bold uppercase text-sm bg-white">
                                                No Outreach History Recorded
                                            </div>
                                        );

                                        return (
                                            <div className="space-y-4">
                                                {combined.map((entry: any, idx: number) => {
                                                    const instanceProject = allProjects.find(p => p.id === entry.instance_id || p.id === entry.instance_project_id);
                                                    const rawVideo = instanceProject?.video_link || entry.video_link;
                                                    const editedVideo = instanceProject?.edited_video_link || entry.edited_video_link;

                                                    return (
                                                        <div key={idx} className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 flex flex-col gap-4 animate-slide-up">
                                                            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-8 h-8 ${entry.source === 'Internal' ? 'bg-black' : 'bg-[#0085FF]'} text-white flex items-center justify-center font-black text-[10px] border-2 border-black`}>#{combined.length - idx}</div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="font-black uppercase text-sm">{entry.influencer_name}</h4>
                                                                            <span className={`px-1.5 py-0.5 text-[7px] font-black border border-black uppercase ${entry.source === 'Internal' ? 'bg-black text-white' : 'bg-[#D946EF] text-white'}`}>
                                                                                {entry.source === 'Internal' ? 'PRIMARY' : 'REGISTRY'}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{entry.influencer_email || 'No Email'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Launch Date</div>
                                                                    <div className="text-xs font-black uppercase">{new Date(entry.sent_at).toLocaleDateString()}</div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="text-xs font-medium text-slate-600 italic">
                                                                {entry.script_content || 'Initial Outreach'}
                                                            </div>

                                                            {(rawVideo || editedVideo) && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                                    <div className="flex items-center justify-between bg-slate-50 p-3 border border-black">
                                                                        <span className="text-[9px] font-black uppercase flex items-center gap-2">
                                                                            <Video className="w-4 h-4 text-slate-900" /> Raw
                                                                        </span>
                                                                        {rawVideo ? (
                                                                            <a href={rawVideo} target="_blank" rel="noopener noreferrer" className="text-[8px] font-black text-white bg-black px-3 py-1.5 hover:bg-slate-800 transition-colors border border-black">VIEW</a>
                                                                        ) : (
                                                                            <span className="text-[8px] font-black text-slate-300 uppercase italic">Pending</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center justify-between bg-blue-50 p-3 border border-black">
                                                                        <span className="text-[9px] font-black text-[#0085FF] uppercase flex items-center gap-2">
                                                                            <CheckCircle2 className="w-4 h-4" /> Final
                                                                        </span>
                                                                        {editedVideo ? (
                                                                            <a href={editedVideo} target="_blank" rel="noopener noreferrer" className="text-[8px] font-black text-white bg-[#0085FF] px-3 py-1.5 hover:bg-blue-700 transition-colors border border-black">VIEW</a>
                                                                        ) : (
                                                                            <span className="text-[8px] font-black text-blue-200 uppercase italic">Waiting</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </section>
                        )}
                        
                        {/* Compact Asset Section after Script (Matching CMO style) */}
                        {isFinalReview && (project.edited_video_link || project.video_link) && (
                            <section className="space-y-4 pt-4">
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Production Output</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
                                    {/* Raw Video Card */}
                                    {project.video_link && (
                                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                            <div className="p-2 bg-[#D946EF] border-b-2 border-black">
                                                <h4 className="font-black text-white text-[10px] uppercase text-center tracking-widest">Influencer Raw Video</h4>
                                            </div>
                                            <div className="aspect-video bg-slate-950 flex items-center justify-center text-white relative group">
                                                <Play className="w-12 h-12 text-white/40 group-hover:text-white transition-all transform group-hover:scale-110" />
                                                <a 
                                                    href={project.video_link} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <span className="px-4 py-2 bg-white text-black font-black uppercase text-[10px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Review Raw</span>
                                                </a>
                                            </div>
                                            <div className="p-3 flex justify-between items-center bg-white">
                                                <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" /> Initial Submission
                                                </span>
                                                <div className="flex gap-4">
                                                    <a 
                                                        href={project.video_link} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="text-[#D946EF] hover:underline text-[9px] font-black uppercase flex items-center gap-1"
                                                    >
                                                        <ExternalLink className="w-3 h-3" /> View
                                                    </a>
                                                    <a 
                                                        href={project.video_link} 
                                                        download 
                                                        className="text-slate-900 hover:underline text-[9px] font-black uppercase flex items-center gap-1"
                                                    >
                                                        <Download className="w-3 h-3" /> Download
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Edited Video Card */}
                                    {project.edited_video_link && (
                                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                            <div className="p-2 bg-slate-900 border-b-2 border-black">
                                                <h4 className="font-black text-white text-[10px] uppercase text-center tracking-widest">Edited Video Output</h4>
                                            </div>
                                            <div className="aspect-video bg-slate-950 flex items-center justify-center text-white relative group">
                                                <Play className="w-12 h-12 text-white/40 group-hover:text-white transition-all transform group-hover:scale-110" />
                                                <a 
                                                    href={project.edited_video_link} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <span className="px-4 py-2 bg-white text-black font-black uppercase text-[10px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Review Edit</span>
                                                </a>
                                            </div>
                                            <div className="p-3 flex justify-between items-center bg-white">
                                                <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Final Edit
                                                </span>
                                                <div className="flex gap-4">
                                                    <a 
                                                        href={project.edited_video_link} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="text-[#0085FF] hover:underline text-[9px] font-black uppercase flex items-center gap-1"
                                                    >
                                                        <ExternalLink className="w-3 h-3" /> View
                                                    </a>
                                                    <a 
                                                        href={project.edited_video_link} 
                                                        download 
                                                        className="text-slate-900 hover:underline text-[9px] font-black uppercase flex items-center gap-1"
                                                    >
                                                        <Download className="w-3 h-3" /> Download
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Proof of Posting Card */}
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                        <div className="p-2 bg-orange-500 border-b-2 border-black">
                                            <h4 className="font-black text-white text-[10px] uppercase text-center tracking-widest">Proof of Posting</h4>
                                        </div>
                                        {project.data?.posting_proof_link ? (
                                            <div className="p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shrink-0">
                                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                                    </div>
                                                    <span className="text-[9px] font-black text-orange-700 uppercase">Live on Social Media</span>
                                                </div>
                                                <a 
                                                    href={project.data.posting_proof_link} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="block p-3 bg-orange-50 border border-orange-200 text-orange-700 font-bold text-[10px] break-all hover:bg-orange-100 transition-colors"
                                                >
                                                    {project.data.posting_proof_link}
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="aspect-video bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-300 p-4">
                                                <div className="w-10 h-10 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center">
                                                    <ExternalLink className="w-5 h-5" />
                                                </div>
                                                <span className="text-[9px] font-black uppercase text-slate-300">Awaiting Proof</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Streamlined Asset Section for Approved Videos */}
                        {isApproved && (project.edited_video_link || project.video_link) && (
                            <section className="space-y-4 pt-8">
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Final Output Assets</h3>
                                <div className="space-y-4">
                                    {project.video_link && (
                                        <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-[#D946EF] flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                    <Video className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none mb-1">Influencer Raw Video</h4>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Initial submission</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 w-full sm:w-auto">
                                                <a href={project.video_link} target="_blank" rel="noreferrer" className="flex-1 sm:flex-none px-6 py-3 border-2 border-black font-black uppercase text-xs hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                                                    <ExternalLink className="w-4 h-4" /> View
                                                </a>
                                                <a href={project.video_link} download className="flex-1 sm:flex-none px-6 py-3 border-2 border-black bg-[#D946EF] text-white font-black uppercase text-xs hover:bg-fuchsia-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2">
                                                    <Download className="w-4 h-4" /> Download
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {project.edited_video_link && (
                                        <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-[#0085FF] flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                    <CheckCircle2 className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none mb-1">Final Edited Output</h4>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Approved for distribution</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 w-full sm:w-auto">
                                                <a href={project.edited_video_link} target="_blank" rel="noreferrer" className="flex-1 sm:flex-none px-6 py-3 border-2 border-black font-black uppercase text-xs hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                                                    <ExternalLink className="w-4 h-4" /> View
                                                </a>
                                                <a href={project.edited_video_link} download className="flex-1 sm:flex-none px-6 py-3 border-2 border-black bg-[#0085FF] text-white font-black uppercase text-xs hover:bg-blue-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2">
                                                    <Download className="w-4 h-4" /> Download
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Proof of Posting Row */}
                                    <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${project.data?.posting_proof_link ? 'bg-orange-500' : 'bg-slate-300'}`}>
                                                <ExternalLink className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none mb-1">Proof of Posting</h4>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                    {project.data?.posting_proof_link ? 'Live on social media' : 'Not yet submitted'}
                                                </span>
                                            </div>
                                        </div>
                                        {project.data?.posting_proof_link ? (
                                            <a 
                                                href={project.data.posting_proof_link} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="flex-1 sm:flex-none px-6 py-3 border-2 border-black bg-orange-500 text-white font-black uppercase text-xs hover:bg-orange-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2"
                                            >
                                                <ExternalLink className="w-4 h-4" /> View Live Post
                                            </a>
                                        ) : (
                                            <span className="px-4 py-2 border-2 border-dashed border-slate-300 text-slate-400 font-black uppercase text-[10px]">Pending</span>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                    </div>

                    {/* DYNAMIC RIGHT COLUMN */}
                    {!isEditing && (
                        <div className="w-full md:w-[400px] bg-white border-l-2 border-black p-8 pt-0 sticky top-0 h-fit">
                             <h2 className="text-2xl font-black text-slate-900 uppercase mb-8 border-b-4 border-black pb-2 pt-8 inline-block">
                                {isInitialReview ? 'SEND TO INFLUENCER' : isFinalReview ? 'PA DECISION' : isApproved ? 'POSTING DETAILS' : 'SUBMIT ACTION'}
                            </h2>

                            <div className="space-y-6">

                                {isInitialReview && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Influencer Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={influencerName}
                                                    onChange={(e) => setInfluencerName(e.target.value)}
                                                    className="w-full bg-white border-2 border-black p-4 font-black text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                                                    placeholder="Enter Full Name"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Influencer Mail <span className="text-red-500">*</span></label>
                                                <input
                                                    type="email"
                                                    value={influencerEmail}
                                                    onChange={(e) => setInfluencerEmail(e.target.value)}
                                                    className="w-full bg-white border-2 border-black p-4 font-black text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                                                    placeholder="Enter Valid Email"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Content Description</label>
                                                <textarea
                                                    value={contentDescription}
                                                    onChange={(e) => setContentDescription(e.target.value)}
                                                    className="w-full bg-white border-2 border-black p-4 font-black text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all min-h-[120px]"
                                                    placeholder="What is this script about?"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isSentToInfluencer && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="p-6 border-2 border-black bg-[#D946EF] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-4">
                                            <div className="bg-white/20 p-3 rounded-xl">
                                                <Video className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-lg uppercase leading-none">INFLUENCER VIDEO</h4>
                                                <p className="text-[10px] font-bold uppercase text-white/80 mt-1">Paste output link below</p>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            value={rawVideoLink}
                                            onChange={(e) => setRawVideoLink(e.target.value)}
                                            className="w-full bg-white border-2 border-black p-6 font-black text-sm text-slate-900 focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] placeholder:text-slate-300"
                                            placeholder="Paste Raw Video Link Here"
                                        />
                                    </div>
                                )}

                                {isFinalReview && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="space-y-4">
                                            <label className={`block p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${finalDecision === 'APPROVE' ? 'border-black bg-[#22C55E] text-white' : 'border-black bg-white text-slate-900'}`}
                                                   onClick={() => setFinalDecision('APPROVE')}>
                                                <div className="flex items-center">
                                                    <div className={`w-6 h-6 rounded-full border-2 border-current flex items-center justify-center mr-4`}>
                                                        {finalDecision === 'APPROVE' && <div className="w-3 h-3 bg-white rounded-full" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className="block font-black text-lg uppercase">APPROVE CONTENT</span>
                                                        <span className="text-[10px] font-bold uppercase opacity-80">Final Approval for Posting</span>
                                                    </div>
                                                    <Check className="w-8 h-8 opacity-40 ml-auto" />
                                                </div>
                                            </label>

                                            {/* Removed Scheduled Date Field */}

                                            <label className={`block p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${finalDecision === 'REWORK' ? 'border-black bg-[#EAB308] text-white' : 'border-black bg-white text-slate-900'}`}
                                                   onClick={() => setFinalDecision('REWORK')}>
                                                <div className="flex items-center">
                                                    <div className={`w-6 h-6 rounded-full border-2 border-current flex items-center justify-center mr-4`}>
                                                        {finalDecision === 'REWORK' && <div className="w-3 h-3 bg-white rounded-full" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className="block font-black text-lg uppercase">REQUEST REWORK</span>
                                                        <span className="text-[10px] font-bold uppercase opacity-80">Send back to Editor</span>
                                                    </div>
                                                    <RotateCcw className="w-8 h-8 opacity-40 ml-auto" />
                                                </div>
                                            </label>

                                            <label className={`block p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${finalDecision === 'REJECT' ? 'border-black bg-[#EF4444] text-white' : 'border-black bg-white text-slate-900'}`}
                                                   onClick={() => setFinalDecision('REJECT')}>
                                                <div className="flex items-center">
                                                    <div className={`w-6 h-6 rounded-full border-2 border-current flex items-center justify-center mr-4`}>
                                                        {finalDecision === 'REJECT' && <div className="w-3 h-3 bg-white rounded-full" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className="block font-black text-lg uppercase">REJECT</span>
                                                        <span className="text-[10px] font-bold uppercase opacity-80">Terminate Workflow</span>
                                                    </div>
                                                    <X className="w-8 h-8 opacity-40 ml-auto" />
                                                </div>
                                            </label>
                                        </div>

                                        {(finalDecision === 'REWORK' || finalDecision === 'REJECT') && (
                                            <div className="mt-6 space-y-2 animate-fade-in">
                                                <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Reason for {finalDecision}</label>
                                                <textarea
                                                    value={reworkReason}
                                                    onChange={(e) => setReworkReason(e.target.value)}
                                                    className="w-full bg-white border-2 border-black p-6 font-black text-xs text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-h-[120px]"
                                                    placeholder={finalDecision === 'REWORK' ? "Describe necessary edits in detail..." : "Briefly explain the reason for rejection..."}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isApproved && (
                                    <div className="space-y-8 animate-fade-in">
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                                                    <Calendar className="w-3 h-3" /> Scheduled Posting Date
                                                </label>
                                                <input
                                                    type="date"
                                                    value={postScheduledDate}
                                                    onChange={(e) => setPostScheduledDate(e.target.value)}
                                                    className="w-full bg-white border-2 border-black p-4 font-black text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                                                    <ExternalLink className="w-3 h-3" /> Proof of Posting (Live Link)
                                                </label>
                                                <input
                                                    type="url"
                                                    value={postingProofLink}
                                                    onChange={(e) => setPostingProofLink(e.target.value)}
                                                    className="w-full bg-white border-2 border-black p-4 font-black text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                                                    placeholder="https://social-media.com/post/..."
                                                />
                                                <p className="text-[9px] font-bold text-slate-400 italic mt-1 uppercase">
                                                    * Paste the link once the video is live on social media
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleUpdatePostingDetails}
                                            disabled={isSavingPosting}
                                            className="w-full py-6 bg-green-500 hover:bg-green-600 text-white font-black uppercase text-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-3"
                                        >
                                            {isSavingPosting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'SAVE POST DETAILS'}
                                        </button>
                                    </div>
                                )}


                            </div>

                            {!isApproved && (
                                <div className="mt-10 pb-12">
                                    <button
                                        onClick={triggerSubmit}
                                        disabled={isSending || (isFinalReview && !finalDecision)}
                                        className={`w-full py-6 font-black uppercase text-xl transition-all flex items-center justify-center gap-3 ${
                                            isInitialReview 
                                              ? 'bg-[#D946EF] hover:bg-[#9333EA] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                              : isSending || (isFinalReview && !finalDecision) ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-2 border-black' :
                                              isFinalReview ? 'bg-[#0085FF] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none translate-y-0 active:translate-y-[6px] border-2 border-black' :
                                              'bg-black text-white active:bg-slate-900 shadow-sm'
                                        }`}
                                    >
                                        {isSending ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : 
                                         isFinalReview ? 'SUBMIT DECISION' : 
                                         isInitialReview ? (
                                            <>
                                                <Send className="w-6 h-6" />
                                                SENT TO THE INFLUENCER
                                            </>
                                         ) : 
                                         'SUBMIT VIDEO LINK'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PAReviewScreen;
