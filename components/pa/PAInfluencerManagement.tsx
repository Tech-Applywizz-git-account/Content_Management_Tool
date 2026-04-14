import React, { useState } from 'react';
import { Project, User, STAGE_LABELS, WorkflowStage } from '../../types';
import { ArrowLeft, Video, CheckCircle2, User as UserIcon, FileText, ExternalLink, Info, Clock, AlertCircle, Users, Mail, History, Send, Layers, Briefcase, ChevronRight, Loader2, Check } from 'lucide-react';
import { format } from 'date-fns';
import ScriptDisplay from '../ScriptDisplay';
import { toast } from 'sonner';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    project: Project; // Main selected project
    allInfluencerProjects?: Project[]; // All projects for this influencer
    user: User;
    onBack: () => void;
    onComplete: () => void;
}

const PAInfluencerManagement: React.FC<Props> = ({ project, allInfluencerProjects = [], user, onBack, onComplete }) => {
    const [influencerName, setInfluencerName] = useState(project.data?.influencer_name || project.influencer_name || '');
    const [influencerEmail, setInfluencerEmail] = useState(project.data?.influencer_email || project.influencer_email || '');
    const [isSending, setIsSending] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const influencerDisplayName = project.data?.influencer_name || project.influencer_name || 'Influencer';

    const sortedProjects = [...allInfluencerProjects].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const aggregatedStats = sortedProjects.reduce((acc, p) => {
        const isScriptSent = p.current_stage !== WorkflowStage.PARTNER_REVIEW;
        const hasRawVideo = !!p.video_link || [
            WorkflowStage.VIDEO_EDITING,
            WorkflowStage.PA_FINAL_REVIEW,
            WorkflowStage.POSTED
        ].includes(p.current_stage);
        const isEditedSent = p.current_stage === WorkflowStage.POSTED;

        if (isScriptSent) acc.scriptSent += 1;
        if (hasRawVideo) acc.rawReceived += 1;
        if (isEditedSent) acc.editedSent += 1;

        return acc;
    }, { scriptSent: 0, rawReceived: 0, editedSent: 0 });

    const handleLaunchOutreach = async () => {
        if (!influencerName.trim()) { toast.error('Enter influencer name'); return; }
        if (!influencerEmail.trim() || !influencerEmail.includes('@')) { toast.error('Enter valid email'); return; }

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
                        comment: 'Campaign launched from Partnership Hub',
                        content_description: project.data?.brief || 'Script content for review',
                        script_content: scriptContent,
                        influencer_name: influencerName
                    }
                }
            });

            await db.advanceWorkflow(project.id, 'Campaign launched by PA');

            setShowSuccessModal(true);
            setTimeout(() => {
                onComplete();
            }, 1500);
        } catch (error: any) {
            toast.error(error.message || 'Error launching campaign.');
            setShowConfirmModal(false);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans flex flex-col animate-fade-in pb-32 relative">

            {/* Confirmation Modal */}
            {showConfirmModal && !showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-md w-full p-10 animate-scale-in">
                        <AlertCircle className="w-16 h-16 text-black mb-6" />
                        <h3 className="text-3xl font-black text-slate-900 uppercase mb-4">Confirm Launch</h3>
                        <p className="text-sm font-bold text-slate-500 uppercase mb-8 leading-relaxed">
                            Are you sure you want to launch this campaign? This will send the script to {influencerName} and advance the workflow.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-4 border-2 border-black font-black uppercase text-xs hover:bg-slate-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLaunchOutreach}
                                disabled={isSending}
                                className="flex-1 py-4 border-2 border-black bg-black text-white font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(34,197,94,1)] max-w-sm w-full p-12 text-center animate-bounce-in">
                        <div className="w-24 h-24 bg-green-500 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <Check className="w-12 h-12 text-white stroke-[4px]" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 uppercase mb-2">Campaign Live!</h3>
                        <p className="text-xs font-black text-green-600 uppercase tracking-widest mb-6">Outreach Successful</p>
                        <div className="flex items-center justify-center gap-2 text-slate-400 font-bold uppercase text-[10px]">
                            <Loader2 className="w-3 h-3 animate-spin" /> Redirecting to Dashboard
                        </div>
                    </div>
                </div>
            )}

            <header className="h-16 bg-white/90 backdrop-blur-md border-b-2 border-indigo-50 flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center space-x-6">
                    <button
                        onClick={onBack}
                        className="p-2.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-xl transition-all shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">{influencerDisplayName}</h1>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Partnership Hub</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg shadow-indigo-200">
                        <Layers className="w-4 h-4 text-indigo-300" /> Executive Analytics
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto p-8 space-y-10">

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="p-8 bg-white border-2 border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col items-center text-center justify-center relative overflow-hidden group">
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center font-black text-3xl text-white shadow-xl mb-4 relative z-10">
                                {influencerDisplayName.charAt(0)}
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none relative z-10">{influencerDisplayName}</h2>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 relative z-10 truncate w-full">{project.data?.influencer_email || 'No email set'}</p>
                        </div>

                        <div className="p-8 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 text-white flex flex-col justify-center relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100 mb-2 relative z-10">Scripts Sent</span>
                            <div className="flex items-baseline gap-3 relative z-10">
                                <p className="text-5xl font-black">{aggregatedStats.scriptSent}</p>
                                <Send className="w-6 h-6 text-indigo-300" />
                            </div>
                        </div>

                        <div className="p-8 bg-blue-500 rounded-3xl shadow-xl shadow-blue-200 text-white flex flex-col justify-center relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100 mb-2 relative z-10">Raw Footage</span>
                            <div className="flex items-baseline gap-3 relative z-10">
                                <p className="text-5xl font-black">{aggregatedStats.rawReceived}</p>
                                <Video className="w-6 h-6 text-blue-200" />
                            </div>
                        </div>

                        <div className="p-8 bg-emerald-500 rounded-3xl shadow-xl shadow-emerald-200 text-white flex flex-col justify-center relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100 mb-2 relative z-10">Live Outputs</span>
                            <div className="flex items-baseline gap-3 relative z-10">
                                <p className="text-5xl font-black">{aggregatedStats.editedSent}</p>
                                <CheckCircle2 className="w-6 h-6 text-emerald-200" />
                            </div>
                        </div>
                    </div>

                    {/* Outreach Action Area for unlaunched projects */}
                    {project.current_stage === WorkflowStage.PARTNER_REVIEW && (
                        <div className="bg-white border-4 border-black p-8 rounded-[2rem] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] space-y-8 animate-slide-up">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center font-black">
                                    <Send className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 uppercase">Ready for Outreach</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Action Required to Proceed</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Influencer Identity</label>
                                    <input
                                        type="text"
                                        value={influencerName}
                                        onChange={(e) => setInfluencerName(e.target.value)}
                                        placeholder="Full Name"
                                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm focus:border-indigo-500 focus:outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Outreach Channel</label>
                                    <input
                                        type="email"
                                        value={influencerEmail}
                                        onChange={(e) => setInfluencerEmail(e.target.value)}
                                        placeholder="Valid Email Address"
                                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm focus:border-indigo-500 focus:outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => setShowConfirmModal(true)}
                                className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xl rounded-2xl shadow-xl shadow-indigo-100 hover:translate-y-[-2px] transition-all flex items-center justify-center gap-3"
                            >
                                <Mail className="w-6 h-6" /> Launch Campaign & Send Script
                            </button>
                        </div>
                    )}

                    <div className="space-y-12">
                        <div className="flex items-center gap-6">
                            <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                                <History className="w-6 h-6 text-indigo-600" /> Partnership History
                            </h3>
                            <div className="h-1 bg-gradient-to-r from-indigo-100 to-transparent flex-1 rounded-full"></div>
                        </div>

                        {sortedProjects.map((proj, idx) => {
                            const influencerHistory = proj.data?.influencer_history || [];
                            const rawLinksHistory = [...(proj.cine_video_links_history || []), proj.video_link].filter(Boolean);
                            const editedLinksHistory = [...(proj.editor_video_links_history || []), ...(proj.sub_editor_video_links_history || []), proj.edited_video_link].filter(Boolean);
                            const isNew = idx === 0;

                            return (
                                <div key={proj.id} className={`bg-white border-2 rounded-[2rem] shadow-xl overflow-hidden transition-all duration-300 ${isNew ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-indigo-100' : 'border-slate-100 shadow-slate-100'
                                    }`}>
                                    <div className={`p-5 px-8 flex flex-wrap items-center justify-between gap-4 ${isNew ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-slate-900 text-white'
                                        }`}>
                                        <div className="flex items-center gap-5">
                                            <div className="w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-xl flex items-center justify-center font-black text-lg border border-white/30">
                                                {sortedProjects.length - idx}
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black tracking-tight uppercase">{proj.title}</h4>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="px-2 py-0.5 bg-white/20 text-[8px] font-black uppercase tracking-widest rounded transition-all">{STAGE_LABELS[proj.current_stage]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2">
                                        <div className="p-8 border-b lg:border-b-0 lg:border-r border-slate-100">
                                            <div className="flex items-center justify-between mb-6">
                                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-3">
                                                    <FileText className="w-5 h-5" /> Campaign Assets ({influencerHistory.length || 1})
                                                </span>
                                            </div>
                                            <div className="space-y-6 max-h-[450px] overflow-y-auto pr-4 custom-scrollbar">
                                                {influencerHistory.length > 0 ? (
                                                    influencerHistory.map((entry: any, hIdx: number) => (
                                                        <div key={hIdx} className="p-6 bg-indigo-50/30 rounded-3xl border-2 border-indigo-50">
                                                            <div className="text-sm font-medium text-slate-700 italic">
                                                                <ScriptDisplay
                                                                    content={entry.script_content || 'Content synchronized'}
                                                                    caption={proj.data?.captions}
                                                                    showBox={false}
                                                                />
                                                            </div>
                                                        </div>
                                                    )).reverse()
                                                ) : (
                                                    <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100">
                                                        <ScriptDisplay
                                                            content={proj.data?.script_content || proj.data?.idea_description || 'No content found'}
                                                            caption={proj.data?.captions}
                                                            showBox={false}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-8 space-y-8 bg-slate-50/30">
                                            <div className="space-y-4">
                                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-3">
                                                    <Video className="w-5 h-5" /> Footage Logs ({rawLinksHistory.length})
                                                </span>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {rawLinksHistory.map((link, lIdx) => (
                                                        <a key={lIdx} href={link} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-white border-2 border-blue-50 rounded-2xl group">
                                                            <span className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{link}</span>
                                                            <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                        </a>
                                                    )).reverse()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PAInfluencerManagement;
