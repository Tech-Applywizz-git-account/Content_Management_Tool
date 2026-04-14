import React, { useState, useRef } from 'react';
import { Project, User, WorkflowStage, Channel, STAGE_LABELS, Role, TaskStatus } from '../../types';
import ScriptDisplay from '../ScriptDisplay';
import Popup from '../Popup';
import { ArrowLeft, Send, Loader2, Mail, Video, Upload, Clock, Info, Check, RotateCcw, X, History, FileText, ExternalLink, Globe, Layout, Layers, User as UserIcon, CheckCircle2, AlertCircle, CheckCircle, Play, Download } from 'lucide-react';
import { toast } from 'sonner';
import { db, storage } from '../../services/supabaseDb';
import { format } from 'date-fns';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    project: Project;
    user: User;
    onBack: () => void;
    onComplete: () => void;
    fromCeoApproved?: boolean; // Track if opened from CEO Approved Scripts page
}

const PAReviewScreen: React.FC<Props> = ({ project, user, onBack, onComplete, fromCeoApproved = false }) => {
    // Shared states
    const [isSending, setIsSending] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [comment, setComment] = useState('');

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
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

    const currentStage = project.current_stage;
    const isInitialReview = currentStage === WorkflowStage.PARTNER_REVIEW;
    const isSentToInfluencer = currentStage === WorkflowStage.SENT_TO_INFLUENCER;
    const isEditing = currentStage === WorkflowStage.VIDEO_EDITING;
    const isFinalReview = currentStage === WorkflowStage.PA_FINAL_REVIEW;
    const isApproved = currentStage === WorkflowStage.POSTED;

    const handleSendAndAdvance = async () => {
        setIsSending(true);
        try {
            const { data: latestProject } = await supabase.from('projects').select('*').eq('id', project.id).single();
            const scriptContent = project.data?.script_content || project.data?.idea_description || 'No script content available';

            const newHistoryEntry = {
                influencer_name: influencerName,
                influencer_email: influencerEmail,
                script_content: scriptContent,
                sent_at: new Date().toISOString(),
                sent_by: user.full_name || 'PA'
            };

            const currentHistory = latestProject?.data?.influencer_history || [];
            const updatedHistory = [...currentHistory, newHistoryEntry];

            await db.projects.update(project.id, {
                data: {
                    ...(latestProject?.data || {}),
                    influencer_name: influencerName,
                    influencer_email: influencerEmail,
                    content_description: contentDescription,
                    influencer_history: updatedHistory
                }
            });

            await supabase.functions.invoke('send-workflow-email', {
                body: {
                    event: 'SEND_TO_INFLUENCER',
                    recipient_email: influencerEmail,
                    data: {
                        project_id: project.id,
                        actor_name: user.full_name || 'PA',
                        comment: 'Campaign launched by PA',
                        content_description: contentDescription || project.data?.brief || 'Script content for review',
                        script_content: scriptContent,
                        influencer_name: influencerName
                    }
                }
            });

            await db.advanceWorkflow(project.id, 'Sent to influencer by PA');
            
            setPopupMessage('PA has launched the outreach campaign.');
            setStageName('Sent To Influencer');
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
            await db.projects.update(project.id, {
                video_link: rawVideoLink,
                current_stage: WorkflowStage.VIDEO_EDITING,
                assigned_to_role: Role.EDITOR,
                status: TaskStatus.IN_PROGRESS
            });

            await supabase.from('workflow_history').insert({
                project_id: project.id,
                action: 'VIDEO_UPLOADED',
                actor_name: user.full_name || 'PA',
                actor_role: 'PARTNER_ASSOCIATE',
                from_stage: WorkflowStage.SENT_TO_INFLUENCER,
                to_stage: WorkflowStage.VIDEO_EDITING,
                from_role: 'PARTNER_ASSOCIATE',
                to_role: 'EDITOR',
                comment: 'Influencer video received and sent to editor',
                stage: WorkflowStage.VIDEO_EDITING
            });

            setPopupMessage('Influencer video received and sent to Editor.');
            setStageName('Video Editing');
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
                    status: TaskStatus.REWORK
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
                    status: TaskStatus.REJECTED
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
                setPopupMessage('PA has approved the content.');
                setStageName('Posted');
            } else if (finalDecision === 'REWORK') {
                setPopupMessage('PA has sent the content back for rework to the Editor.');
                setStageName('Rework → Editor');
            } else if (finalDecision === 'REJECT') {
                setPopupMessage('PA has rejected the workflow.');
                setStageName('Rejected');
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

    const triggerSubmit = () => {
        if (isInitialReview) {
            if (!influencerName.trim()) { toast.error('Enter influencer name'); return; }
            if (!influencerEmail.trim() || !influencerEmail.includes('@')) { toast.error('Enter valid email'); return; }
        } else if (isSentToInfluencer) {
            if (!rawVideoLink.trim()) { toast.error('Enter video link'); return; }
        } else if (isFinalReview) {
            if (!finalDecision) { toast.error('Select a decision'); return; }
            if (finalDecision === 'REWORK' && !reworkReason.trim()) { toast.error('Provide rework reason'); return; }
        }
        setShowConfirmModal(true);
    };

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col animate-fade-in relative">
            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white border-2 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-lg w-full p-8 relative animate-scale-in">
                        <button 
                            onClick={() => setShowConfirmModal(false)}
                            className="absolute top-8 right-8 text-slate-500 hover:text-black transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        
                        <h3 className="text-3xl font-black text-slate-900 uppercase mb-4 pr-12">Confirm Action</h3>
                        
                        <p className="text-lg text-slate-700 mb-10 leading-relaxed font-medium">
                            {isFinalReview ? `Are you sure you want to ${finalDecision === 'APPROVE' ? 'approve this content' : finalDecision === 'REWORK' ? 'request a rework' : 'reject this workflow'}?` : 
                             isInitialReview ? 'Are you sure you want to launch outreach?' : 'Are you sure you want to submit the video link?'}
                        </p>
                        
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setShowConfirmModal(false)} 
                                className="flex-1 py-3 border-2 border-black font-black uppercase text-xl hover:bg-slate-100 transition-colors"
                            >
                                NO
                            </button>
                            <button 
                                onClick={isInitialReview ? handleSendAndAdvance : isSentToInfluencer ? handleUploadRawVideo : handleFinalDecisionSubmit}
                                disabled={isSending}
                                className="flex-1 py-3 border-2 border-black bg-[#0085FF] text-white font-black uppercase text-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
                            >
                                {isSending ? <Loader2 className="w-6 h-6 animate-spin" /> : 'YES'}
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
                                <div className="font-bold text-slate-900 uppercase text-xs truncate">{project.data?.influencer_name || project.influencer_name || '—'}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Email</label>
                                <div className="font-bold text-slate-900 uppercase text-xs truncate">{project.data?.influencer_email || project.influencer_email || '—'}</div>
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
                                </div>
                            </section>
                        )}

                    </div>

                    {/* DYNAMIC RIGHT COLUMN */}
                    {!isEditing && !isApproved && (
                        <div className="w-full md:w-[450px] bg-white border-l-2 border-black p-8 pt-0 shadow-[-10px_0px_20px_rgba(0,0,0,0.05)] sticky top-0 min-h-full">
                             <h2 className="text-2xl font-black text-slate-900 uppercase mb-8 border-b-4 border-black pb-2 pt-8 inline-block">
                                {isFinalReview ? 'PA DECISION' : 'SUBMIT ACTION'}
                            </h2>

                            <div className="space-y-6">

                                {isInitialReview && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Influencer Identity</label>
                                                <input
                                                    type="text"
                                                    value={influencerName}
                                                    onChange={(e) => setInfluencerName(e.target.value)}
                                                    className="w-full bg-white border-2 border-black p-4 font-black uppercase text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                                                    placeholder="Enter Full Name"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Communication Channel</label>
                                                <input
                                                    type="email"
                                                    value={influencerEmail}
                                                    onChange={(e) => setInfluencerEmail(e.target.value)}
                                                    className="w-full bg-white border-2 border-black p-4 font-black uppercase text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                                                    placeholder="Enter Valid Email"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Content Description</label>
                                                <textarea
                                                    value={contentDescription}
                                                    onChange={(e) => setContentDescription(e.target.value)}
                                                    className="w-full bg-white border-2 border-black p-4 font-black uppercase text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all min-h-[120px]"
                                                    placeholder="What is this script about?"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isSentToInfluencer && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="p-6 border-2 border-black bg-[#D946EF] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center gap-4">
                                            <Video className="w-10 h-10" />
                                            <div>
                                                <span className="block font-black text-lg uppercase">INFLUENCER VIDEO</span>
                                                <span className="text-[10px] font-bold uppercase text-white/80 tracking-widest italic">Paste output link below</span>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            value={rawVideoLink}
                                            onChange={(e) => setRawVideoLink(e.target.value)}
                                            className="w-full bg-white border-2 border-black p-6 font-black uppercase text-sm text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
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
                                                    className="w-full bg-white border-2 border-black p-6 font-black uppercase text-xs text-slate-900 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-h-[120px]"
                                                    placeholder={finalDecision === 'REWORK' ? "Describe necessary edits in detail..." : "Briefly explain the reason for rejection..."}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="mt-10 pb-12">
                                <button
                                    onClick={triggerSubmit}
                                    disabled={isSending || (isFinalReview && !finalDecision)}
                                    className={`w-full py-6 border-2 border-black font-black uppercase text-xl transition-all flex items-center justify-center gap-3 ${
                                        isSending || (isFinalReview && !finalDecision) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                                        isFinalReview ? 'bg-[#0085FF] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none translate-y-0 active:translate-y-[6px]' :
                                        'bg-black text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none translate-y-0 active:translate-y-[6px]'
                                    }`}
                                >
                                    {isSending ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : 
                                     isFinalReview ? 'SUBMIT DECISION' : 
                                     isInitialReview ? 'LAUNCH OUTREACH' : 
                                     'SUBMIT VIDEO LINK'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PAReviewScreen;
