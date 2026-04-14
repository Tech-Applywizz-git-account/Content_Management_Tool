import React, { useState } from 'react';
import { Project, User, STAGE_LABELS, WorkflowStage, Role, TaskStatus, Channel } from '../../types';
import { ArrowLeft, Video, CheckCircle2, User as UserIcon, FileText, History, Send, Layers, Loader2, Check, ExternalLink, Download, Play, X } from 'lucide-react';
import ScriptDisplay from '../ScriptDisplay';
import Popup from '../Popup';
import { toast } from 'sonner';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    project: Project; // Current selected project
    allInfluencerProjects?: Project[]; // All related projects (instances + parent)
    user: User;
    onBack: () => void;
    onComplete: () => void;
}

const PAInfluencerManagement: React.FC<Props> = ({ project, allInfluencerProjects = [], user, onBack, onComplete }) => {
    const [influencerName, setInfluencerName] = useState('');
    const [influencerEmail, setInfluencerEmail] = useState('');
    const [contentDescription, setContentDescription] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupType, setPopupType] = useState<'success' | 'error'>('success');
    const [externalHistory, setExternalHistory] = useState<any[]>([]);

    const isInstance = project.data?.influencer_instance === true;
    const currentStage = project.current_stage;
    const isApproved = currentStage === WorkflowStage.POSTED;

    React.useEffect(() => {
        const fetchHistory = async () => {
            const parentId = project.data?.parent_script_id || project.id;
            const data = await db.influencers.getByParent(parentId);
            setExternalHistory(data || []);
        };
        fetchHistory();
    }, [project.id, project.data?.parent_script_id]);

    const handleLaunchOutreach = async () => {
        if (!influencerName.trim()) {
            setPopupMessage('Influencer name is required');
            setPopupType('error');
            setShowPopup(true);
            return;
        }
        if (!influencerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(influencerEmail)) {
            setPopupMessage('Enter a valid email address');
            setPopupType('error');
            setShowPopup(true);
            return;
        }

        setIsSending(true);
        try {
            setPopupType('success');
            const { data: latestProject } = await supabase.from('projects').select('*').eq('id', project.id).single();
            const scriptContent = latestProject?.data?.script_content || project.data?.script_content || project.data?.idea_description || 'No script content available';

            const newProjectData = {
                title: project.title,
                channel: project.channel,
                content_type: project.content_type,
                current_stage: WorkflowStage.SENT_TO_INFLUENCER,
                status: TaskStatus.TODO,
                priority: project.priority,
                assigned_to_role: Role.PARTNER_ASSOCIATE,
                assigned_to_user_id: user.id,
                created_by_user_id: user.id,
                created_by_name: user.full_name,
                writer_id: project.writer_id || user.id, // Ensure writer info is preserved or default to PA
                writer_name: project.writer_name || user.full_name,
                due_date: project.due_date,
                data: {
                    ...(latestProject?.data || project.data || {}),
                    influencer_name: influencerName,
                    influencer_email: influencerEmail,
                    content_description: contentDescription,
                    parent_script_id: project.data?.parent_script_id || project.id, // Link to the original CEO-approved script
                    influencer_instance: true,
                    influencer_history: [{
                        influencer_name: influencerName,
                        influencer_email: influencerEmail,
                        sent_at: new Date().toISOString(),
                        sent_by: user.full_name || 'PA',
                        sent_by_id: user.id, // Record PA ID
                        action: 'INITIAL_OUTREACH'
                    }]
                }
            };

            const createdProject = await db.projects.create(newProjectData as any);

            const parentId = project.data?.parent_script_id || project.id;
            const { data: parentScript } = await supabase.from('projects').select('*').eq('id', parentId).single();
            const parentHistory = Array.isArray(parentScript?.data?.influencer_history) ? parentScript.data.influencer_history : [];
            const isFirstInfluencer = parentHistory.length === 0;

            if (isFirstInfluencer) {
                await db.projects.updateData(parentId, {
                    influencer_history: [...parentHistory, {
                        influencer_name: influencerName,
                        influencer_email: influencerEmail,
                        instance_id: createdProject.id,
                        sent_at: new Date().toISOString(),
                        sent_by: user.full_name || 'PA',
                        sent_by_id: user.id // Record PA ID
                    }]
                });
            } else {
                await db.influencers.log({
                    parent_project_id: parentId,
                    instance_project_id: createdProject.id,
                    influencer_name: influencerName,
                    influencer_email: influencerEmail,
                    script_content: scriptContent,
                    content_description: contentDescription,
                    sent_by: user.full_name || 'PA',
                    sent_by_id: user.id, // Record PA ID
                    status: 'SENT_TO_INFLUENCER'
                });
            }

            await supabase.functions.invoke('send-workflow-email', {
                body: {
                    event: 'SEND_TO_INFLUENCER',
                    recipient_email: influencerEmail,
                    data: {
                        project_id: createdProject.id,
                        actor_name: user.full_name || 'PA',
                        comment: 'Campaign launched by PA from Partnership Hub',
                        content_description: contentDescription || project.data?.brief || 'Script content for review',
                        script_content: scriptContent,
                        influencer_name: influencerName
                    }
                }
            });

            setPopupMessage('The script is send to the influencer');
            setStageName('SENT TO INFLUENCER');
            setShowPopup(true);

            setInfluencerName('');
            setInfluencerEmail('');
            setContentDescription('');

            // Proactively refresh external history so it shows behind the popup immediately
            const pId = project.data?.parent_script_id || project.id;
            const freshHistory = await db.influencers.getByParent(pId);
            setExternalHistory(freshHistory || []);

        } catch (error: any) {
            toast.error(error.message || 'Error launching campaign.');
        } finally {
            setIsSending(false);
            setShowConfirmModal(false);
        }
    };

    const handleUpdateInstance = async (stage: WorkflowStage, status: TaskStatus = TaskStatus.TODO) => {
        setIsSending(true);
        try {
            const nextHistoryEntry = {
                influencer_name: project.data?.influencer_name,
                sent_at: new Date().toISOString(),
                sent_by: user.full_name,
                action: `Updated to ${stage.replace(/_/g, ' ')}`
            };

            await db.projects.update(project.id, {
                current_stage: stage,
                status: status,
                data: {
                    ...(project.data || {}),
                    influencer_history: [...(project.data?.influencer_history || []), nextHistoryEntry]
                }
            });

            let msg = '';
            let sName = '';
            if (stage === WorkflowStage.VIDEO_EDITING) {
                msg = 'The influencer video is uplaoded it moves to the editor';
                sName = 'VIDEO EDITING';
            } else if (stage === WorkflowStage.PA_FINAL_REVIEW) {
                msg = 'Editor has uploaded the video. Ready for Final Approval.';
                sName = 'PA FINAL REVIEW';
            } else if (stage === WorkflowStage.POSTED) {
                msg = 'The video is approved now it shows in the video approved page';
                sName = 'POSTED';
            }

            setPopupMessage(msg);
            setStageName(sName);
            setShowPopup(true);

            // Refresh history
            const pId = project.data?.parent_script_id || project.id;
            const freshHistory = await db.influencers.getByParent(pId);
            setExternalHistory(freshHistory || []);

        } catch (error) {
            toast.error('Failed to update workflow');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col animate-fade-in relative">
            <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20">
                <div className="flex items-center space-x-6">
                    <button onClick={onBack} className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all">
                        <ArrowLeft className="w-6 h-6 text-black" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">{project.title}</h1>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                            <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                {STAGE_LABELS[project.current_stage]}
                            </span>
                            <span className={`px-3 py-1 text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${project.channel === Channel.YOUTUBE ? 'bg-[#FF4F4F] text-white' :
                                    project.channel === Channel.LINKEDIN ? 'bg-[#0085FF] text-white' :
                                        project.channel === Channel.INSTAGRAM ? 'bg-[#D946EF] text-white' :
                                            'bg-black text-white'
                                }`}>
                                {project.channel}
                            </span>
                            <span className={`px-3 py-1 text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isInstance ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'
                                }`}>
                                {isInstance ? 'INSTANCE' : 'PARENT'}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar h-[calc(100vh-80px)]">
                <div className="flex flex-col md:flex-row w-full items-start min-h-full">
                    <div className="flex-1 px-6 md:px-12 pb-12 bg-slate-50 min-h-full">
                        {/* 6-Column Metadata Grid like PA Review Screen */}
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
                                <div className="font-bold text-[#0085FF] uppercase text-xs truncate">{project.data?.brand?.replace(/_/g, ' ') || 'UNBRANDED'}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Influencer</label>
                                <div className="font-bold text-slate-900 uppercase text-xs truncate">{project.data?.influencer_name || '—'}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Email</label>
                                <div className="font-bold text-slate-900 uppercase text-xs truncate">{project.data?.influencer_email || '—'}</div>
                            </div>
                        </div>

                        {project.data?.brief && (
                            <section className="space-y-4 pt-8">
                                <h3 className="text-2xl font-black text-slate-900 uppercase">Campaign Brief</h3>
                                <div className="border-2 border-black bg-white p-8 min-h-[100px] whitespace-pre-wrap text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    {project.data.brief}
                                </div>
                            </section>
                        )}

                        <section className="space-y-4 pt-8">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Script Content</h3>
                            <div className="border-2 border-black bg-white p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <ScriptDisplay content={project.data?.script_content || project.data?.idea_description || 'Content empty.'} showBox={false} />
                            </div>
                        </section>

                        {/* Complete Influencer History Section */}
                        <section className="space-y-6 pt-12 pb-12">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                                <History className="w-8 h-8 text-black" /> Influencer History
                            </h3>
                            <div className="space-y-8">
                                {(() => {
                                    const parentId = project.data?.parent_script_id || project.id;
                                    const parentProject = allInfluencerProjects.find(p => p.id === parentId);

                                    const internalHistory = (parentProject?.data?.influencer_history || [])
                                        .filter((h: any) => h.sent_by_id === user.id) // Filter by current PA
                                        .map((h: any) => ({ ...h, source: 'Internal' }));

                                    const externalLog = externalHistory
                                        .filter(h => h.sent_by_id === user.id) // Filter by current PA
                                        .map(h => ({ ...h, source: 'Registry', action: h.action || 'CAMPAIGN_OUTREACH' }));

                                    const combined = [...internalHistory, ...externalLog]
                                        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

                                    if (combined.length === 0) return (
                                        <div className="p-10 border-2 border-dashed border-slate-300 text-center text-slate-400 font-bold uppercase text-sm bg-white">
                                            No Outreach History Recorded
                                        </div>
                                    );

                                    return combined.map((entry: any, idx: number) => {
                                        const instanceProject = allInfluencerProjects.find(p => p.id === entry.instance_id || p.id === entry.instance_project_id);
                                        const rawVideo = instanceProject?.video_link || entry.video_link;
                                        const editedVideo = instanceProject?.edited_video_link || entry.edited_video_link;

                                        return (
                                            <div key={idx} className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 flex flex-col gap-6 animate-slide-up">
                                                <div className="flex items-center justify-between border-b-2 border-black pb-6">
                                                    <div className="flex items-center gap-6">
                                                        <div className={`w-10 h-10 ${entry.source === 'Internal' ? 'bg-black' : 'bg-[#0085FF]'} text-white flex items-center justify-center font-black text-xs border-2 border-black`}>#{combined.length - idx}</div>
                                                        <div>
                                                            <div className="flex items-center gap-3">
                                                                <h4 className="font-black text-slate-900 uppercase text-lg">{entry.influencer_name}</h4>
                                                                <span className={`px-2 py-0.5 text-[8px] font-black border-2 border-black uppercase ${entry.source === 'Internal' ? 'bg-slate-900 text-white' : 'bg-[#0085FF] text-white'}`}>
                                                                    {entry.source === 'Internal' ? 'Primary' : 'Secondary'}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{entry.influencer_email || 'No Email'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Launch</div>
                                                        <div className="text-sm font-black text-slate-900 uppercase">{new Date(entry.sent_at).toLocaleDateString()}</div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="flex items-center justify-between bg-slate-50 p-4 border-2 border-black">
                                                        <span className="text-[10px] font-black text-slate-900 uppercase flex items-center gap-3">
                                                            <Video className="w-5 h-5" /> Raw Video
                                                        </span>
                                                        {rawVideo ? (
                                                            <a href={rawVideo} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-white bg-black px-4 py-2 hover:bg-slate-800 transition-colors border-2 border-black">VIEW ASSET</a>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-slate-300 uppercase italic">Pending</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between bg-blue-50 p-4 border-2 border-black">
                                                        <span className="text-[10px] font-black text-[#0085FF] uppercase flex items-center gap-3">
                                                            <CheckCircle2 className="w-5 h-5" /> Final Output
                                                        </span>
                                                        {editedVideo ? (
                                                            <a href={editedVideo} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-white bg-[#0085FF] px-4 py-2 hover:bg-blue-700 transition-colors border-2 border-black">VIEW ASSET</a>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-blue-200 uppercase italic">In Edit</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </section>
                    </div>

                    {/* Sidebar: Persistent Actions */}
                    <aside className="w-full md:w-[400px] bg-white border-l-2 border-black p-8 sticky top-0 h-fit">

                        {/* Dynamic Sidebar Content */}
                        {isInstance ? (
                            <div className="space-y-8 animate-fade-in pt-8">
                                <div className="flex flex-col gap-2 mb-8">
                                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                                        SUBMIT ACTION
                                    </h2>
                                    <div className="h-1 w-20 bg-black" />
                                </div>

                                <div className="space-y-6">
                                    {/* Influencer Video Card (Image Style) */}
                                    <div className="bg-[#D946EF] border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-4">
                                        <div className="bg-white/20 p-3 rounded-xl">
                                            <Video className="w-8 h-8 text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-black uppercase text-lg leading-none">INFLUENCER VIDEO</h4>
                                            <p className="text-white/70 text-[10px] font-bold uppercase mt-1">PASTE OUTPUT LINK BELOW</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 pb-12">
                                        <input
                                            type="text"
                                            placeholder="PASTE RAW VIDEO LINK HERE"
                                            className="w-full bg-white border-2 border-slate-900 p-5 font-black text-xs uppercase focus:outline-none focus:border-black placeholder:text-slate-300"
                                            value={project.video_link || ''}
                                            onChange={(e) => {
                                                // Live local status update could go here
                                            }}
                                        />

                                        <button
                                            onClick={() => handleUpdateInstance(WorkflowStage.VIDEO_EDITING)}
                                            className="w-full py-6 bg-black text-white font-black uppercase text-xl tracking-tighter hover:bg-[#D946EF] transition-all border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                                        >
                                            SUBMIT VIDEO LINK
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-0 transition-all pt-8">
                                <div className="flex items-center gap-4 mb-2">
                                    <Send className="w-8 h-8 text-[#D946EF] transform -rotate-12" />
                                    <h2 className="text-3xl font-black text-[#1E293B] uppercase tracking-tighter">
                                        SEND TO INFLUENCER
                                    </h2>
                                </div>
                                <div className="h-1.5 w-full bg-[#D946EF] mb-8" />

                                <div className="space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-1">
                                            INFLUENCER NAME <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={influencerName}
                                            onChange={(e) => setInfluencerName(e.target.value)}
                                            className="w-full bg-white border-2 border-slate-900 p-4 font-bold text-slate-500 focus:outline-none focus:border-black transition-all"
                                            placeholder="Enter influencer name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-1">
                                            INFLUENCER EMAIL <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={influencerEmail}
                                            onChange={(e) => setInfluencerEmail(e.target.value)}
                                            className="w-full bg-white border-2 border-slate-900 p-4 font-bold text-slate-500 focus:outline-none focus:border-black transition-all"
                                            placeholder="Enter influencer email"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-1">
                                            COMMENT (OPTIONAL)
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={contentDescription}
                                            onChange={(e) => setContentDescription(e.target.value)}
                                            className="w-full bg-white border-2 border-slate-900 p-4 font-bold text-slate-500 focus:outline-none focus:border-black transition-all resize-none"
                                            placeholder="Add any notes"
                                        />
                                    </div>

                                    <div className="pt-4 pb-12">
                                        <button
                                            onClick={() => setShowConfirmModal(true)}
                                            disabled={isSending}
                                            className="w-full relative group"
                                        >
                                            <div className="absolute inset-0 bg-black translate-x-1.5 translate-y-1.5 transition-transform group-hover:translate-x-2.5 group-hover:translate-y-2.5" />
                                            <div className="relative flex items-center justify-center gap-4 py-6 bg-[#F472B6] border-2 border-black text-white font-black uppercase text-lg tracking-tighter group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all active:translate-x-0 active:translate-y-0">
                                                {isSending ? (
                                                    <Loader2 className="w-6 h-6 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Send className="w-6 h-6" />
                                                        SEND SCRIPT TO INFLUENCER
                                                    </>
                                                )}
                                            </div>
                                        </button>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight text-center mt-6">
                                            {isSending ? 'SENDING EMAIL...' : 'TRIGGERS AUTOMATED EMAIL WITH SCRIPT CONTENT'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>

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
                            Are you sure you want to send this script to <span className="font-black text-black">{influencerName || 'this influencer'}</span>?
                        </p>

                        <div className="grid grid-cols-2 gap-4 mt-8">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="py-4 border-2 border-black bg-white text-black font-black uppercase text-sm tracking-widest hover:bg-slate-50 transition-all active:translate-y-[2px]"
                            >
                                NO
                            </button>
                            <button
                                onClick={handleLaunchOutreach}
                                className="py-4 border-2 border-black bg-[#0085FF] text-white font-black uppercase text-sm tracking-widest hover:bg-blue-600 transition-all shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px]"
                            >
                                YES
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={async () => {
                        setShowPopup(false);
                        if (onComplete) await onComplete();
                    }}
                />
            )}
        </div>
    );
};

export default PAInfluencerManagement;
