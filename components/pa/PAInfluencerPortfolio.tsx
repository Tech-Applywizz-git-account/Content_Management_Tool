import React, { useState } from 'react';
import { Project, User, STAGE_LABELS, WorkflowStage, TaskStatus, Role } from '../../types';
import { ArrowLeft, Video, CheckCircle2, User as UserIcon, FileText, ExternalLink, Info, Clock, AlertCircle, Users, Mail, History, Send, Layers, Briefcase, ChevronRight, Loader2, Check, Link, Rocket, X, Play } from 'lucide-react';
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

const PAInfluencerPortfolio: React.FC<Props> = ({ project, allInfluencerProjects = [], user, onBack, onComplete }) => {
    const [influencerName, setInfluencerName] = useState(project.data?.influencer_name || (project as any).influencer_name || '');
    const [influencerEmail, setInfluencerEmail] = useState(project.data?.influencer_email || (project as any).influencer_email || '');
    const [isSending, setIsSending] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [newVideoLink, setNewVideoLink] = useState('');
    const [isEditingInfluencer, setIsEditingInfluencer] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [influencerRecord, setInfluencerRecord] = useState<any>(null);
    const [launchStep, setLaunchStep] = useState<number>(0); // 0: closed, 1: select script, 2: preview
    const [availableScripts, setAvailableScripts] = useState<any[]>([]);
    const [selectedScript, setSelectedScript] = useState<any>(null);
    const [customContent, setCustomContent] = useState('');

    React.useEffect(() => {
        const fetchScripts = async () => {
            let brandName = project.data?.brand || project.brandSelected || project.brand || '';
            if (!brandName) return;

            // Clean brand name - remove (REEL), (STORY), etc. if present
            const cleanBrand = brandName.split(' (')[0].trim().toLowerCase();
            console.log('🔍 Filtering scripts for brand (cleaned):', cleanBrand);

            // Fetch ALL projects for the library and filter in JS to avoid malformed PostgREST queries
            // This also bypasses issues with missing columns like 'brandSelected' or 'is_deleted'
            const { data, error } = await supabase
                .from('projects')
                .select('*');
            
            if (error) {
                console.error('❌ Error fetching scripts:', error);
                return;
            }
            
            if (data) {
                // Filter by brand name first
                const brandProjects = data.filter(p => {
                    const b1 = (p.brand || '').trim().toLowerCase();
                    const b2 = (p.brandSelected || '').trim().toLowerCase();
                    const b3 = (p.data?.brand || '').trim().toLowerCase();
                    
                    return b1.includes(cleanBrand) || b2.includes(cleanBrand) || b3.includes(cleanBrand);
                });

                console.log(`📊 Found ${brandProjects.length} total projects for brand: ${cleanBrand}`);
                
                // Then filter to only include those that are actually scripts and have PASSED CEO review (SCRIPT_REVIEW_L2)
                const filtered = brandProjects.filter(p => {
                    // 1. Strict script content check
                    // ONLY include projects that have actual script_content
                    if (!p.data?.script_content) {
                        console.debug(`❌ Skipping ${p.title}: No script_content found`);
                        return false;
                    }

                    // 2. Check if moved past SCRIPT_REVIEW_L2
                    const scriptReviewStages = [
                        'SCRIPT',
                        'SCRIPT_REVIEW_L1',
                        'SCRIPT_REVIEW_L2'
                    ];

                    const hasMovedPastL2 = !scriptReviewStages.includes(p.current_stage);
                    const wasApprovedByCeo = p.history?.some((h: any) => 
                        h.stage === 'SCRIPT_REVIEW_L2' && h.action === 'APPROVED'
                    );

                    const isFinalized = hasMovedPastL2 || wasApprovedByCeo || p.status === 'DONE';
                    
                    if (!isFinalized) {
                        console.debug(`❌ Skipping ${p.title}: Still in stage ${p.current_stage} and no L2 approval in history`);
                        return false;
                    }

                    console.log(`✅ Included Script: ${p.title} (${p.current_stage})`);
                    return true;
                });
                
                setAvailableScripts(filtered);
            }
        };
        fetchScripts();
    }, [project]);

    React.useEffect(() => {
        const fetchInfluencer = async () => {
            const registryId = project.data?.registry_id || project.data?.influencer_id;
            const name = project.data?.influencer_name || project.title?.replace('DRAFT: ', '') || '';
            const brand = project.data?.brand || project.brandSelected || project.brand || '';
            
            let query = supabase.from('influencers').select('*');
            
            if (registryId) {
                query = query.eq('id', registryId);
            } else {
                query = query.ilike('influencer_name', name.trim()).eq('brand_name', brand);
            }

            const { data } = await query.maybeSingle();
            
            if (data) {
                setInfluencerRecord(data);
                setEditForm({
                    influencer_name: data.influencer_name,
                    instagram_profile: data.instagram_profile,
                    budget: data.budget,
                    raw_video: data.raw_video || '',
                    edited_video: data.edited_video || '',
                    proof_link: data.proof_link || ''
                });
            }
        };
        fetchInfluencer();
    }, [project]);

    const handleUpdateInfluencer = async () => {
        if (!influencerRecord?.id) {
            toast.error('Registry record not found');
            return;
        }
        setIsSending(true);
        try {
            const updates = {
                influencer_name: editForm.influencer_name,
                instagram_profile: editForm.instagram_profile,
                budget: editForm.budget
            };
            await db.influencers.update(influencerRecord.id, updates);
            toast.success('Influencer details updated');
            setIsEditingInfluencer(false);
            onComplete(); // Refresh data
        } catch (error) {
            console.error('Error updating influencer:', error);
            toast.error('Failed to update details');
        } finally {
            setIsSending(false);
        }
    };

    const [uploadType, setUploadType] = useState<'RAW' | 'EDITED' | 'PROOF' | null>(null);

    const handleUploadLink = async (projId: string, type: 'RAW' | 'EDITED' | 'PROOF') => {
        if (!newVideoLink.trim()) {
            toast.error('Please enter a link');
            return;
        }

        setIsSending(true);
        try {
            const { data: latestProject } = await supabase.from('projects').select('*').eq('id', projId).single();
            if (!latestProject) throw new Error('Project not found');

            let updateData: any = {};
            
            if (type === 'RAW') {
                const currentHistory = latestProject.cine_video_links_history || [];
                updateData = {
                    video_link: newVideoLink,
                    cine_video_links_history: [...currentHistory, newVideoLink],
                    pa_raw_footage_uploaded_at: new Date().toISOString()
                };
                
                if (latestProject.current_stage === WorkflowStage.SENT_TO_INFLUENCER) {
                    updateData.current_stage = WorkflowStage.PA_VIDEO_CMO_REVIEW;
                    updateData.assigned_to_role = Role.CMO;
                    updateData.assigned_to_user_id = null;
                    updateData.status = TaskStatus.WAITING_APPROVAL;
                }
            } else if (type === 'EDITED') {
                const currentHistory = latestProject.editor_video_links_history || [];
                updateData = {
                    edited_video_link: newVideoLink,
                    editor_video_links_history: [...currentHistory, newVideoLink]
                };
            } else if (type === 'PROOF') {
                updateData = {
                    data: {
                        ...(latestProject.data || {}),
                        posting_proof_link: newVideoLink
                    },
                    current_stage: WorkflowStage.POSTED,
                    project_status: WorkflowStage.POSTED
                };
            }

            await db.projects.update(projId, updateData);
            
            if (type === 'RAW' && latestProject.current_stage === WorkflowStage.SENT_TO_INFLUENCER) {
                await db.influencers.log({
                    parent_project_id: latestProject.data?.parent_script_id || latestProject.id,
                    instance_project_id: projId,
                    influencer_name: latestProject.data?.influencer_name || 'Influencer',
                    influencer_email: latestProject.data?.influencer_email || '',
                    action: 'VIDEO_UPLOADED_FOR_CMO_REVIEW',
                    sent_by: user.full_name,
                    sent_by_id: user.id,
                    status: 'CMO_VIDEO_REVIEW'
                });
            }

            toast.success(`${type === 'PROOF' ? 'Proof' : type === 'EDITED' ? 'Edited Video' : 'Video'} link added successfully`);
            setNewVideoLink('');
            setUploadingId(null);
            setUploadType(null);
            onComplete();
        } catch (error: any) {
            console.error('Error uploading link:', error);
            toast.error('Failed to add link');
        } finally {
            setIsSending(false);
        }
    };

    // Delete project handler
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = (proj: Project) => {
        setProjectToDelete(proj);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!projectToDelete) return;
        
        setIsDeleting(true);
        try {
            // Delete from projects table
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectToDelete.id);
            
            if (error) throw error;
            
            // Also delete from influencers table if exists
            await supabase
                .from('influencers')
                .delete()
                .eq('instance_project_id', projectToDelete.id);
            
            toast.success('Project deleted successfully');
            setShowDeleteModal(false);
            setProjectToDelete(null);
            onComplete(); // Refresh data
        } catch (error: any) {
            console.error('Error deleting project:', error);
            toast.error(error.message || 'Failed to delete project');
        } finally {
            setIsDeleting(false);
        }
    };
    
    const influencerDisplayName = project.data?.influencer_name || (project as any).influencer_name || 'Influencer';
    
    const sortedProjects = [...allInfluencerProjects].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const aggregatedStats = sortedProjects.reduce((acc, p) => {
        const isScriptSent = p.current_stage !== WorkflowStage.PARTNER_REVIEW;
        const hasVideoLink = !!p.video_link || (p.cine_video_links_history || []).length > 0;
        const hasEditedVideo = !!p.edited_video_link || (p.editor_video_links_history || []).length > 0 || (p.sub_editor_video_links_history || []).length > 0;
        const hasProof = !!p.data?.posting_proof_link || p.current_stage === WorkflowStage.POSTED;

        if (isScriptSent) acc.scriptSent += 1;
        if (hasVideoLink) acc.videoLink += 1;
        if (hasEditedVideo) acc.editedVideo += 1;
        if (hasProof) acc.proofPosted += 1;
        
        return acc;
    }, { scriptSent: 0, videoLink: 0, editedVideo: 0, proofPosted: 0 });

    const handleLaunchOutreach = async () => {
        if (!influencerName.trim()) { toast.error('Enter influencer name'); return; }
        if (!influencerEmail.trim() || !influencerEmail.includes('@')) { toast.error('Enter valid email'); return; }
        if (!selectedScript) { toast.error('Please select a script'); return; }

        setIsSending(true);
        try {
            let projectId = project.id;
            let latestProject: any = null;

            // Check if this is a temporary project that needs to be created first
            if (projectId?.startsWith('temp-')) {
                console.log('🆕 Creating new project from temp ID:', projectId);
                
                // Create new project for each script - same influencer can have multiple projects
                const brandName = project.brand || project.data?.brand || selectedScript.data?.brand || '';
                const newProjectData = {
                    title: `${influencerName} - ${selectedScript.title}`,
                    channel: (project.channel || 'INSTAGRAM').toUpperCase(),
                    content_type: 'VIDEO',
                    current_stage: WorkflowStage.SENT_TO_INFLUENCER,
                    task_status: TaskStatus.TODO,
                    priority: 'HIGH',
                    assigned_to_role: Role.PARTNER_ASSOCIATE,
                    assigned_to_user_id: user.id,
                    created_by_user_id: user.id,
                    created_by_name: user.full_name,
                    brand: brandName,
                    data: {
                        ...(project.data || {}),
                        influencer_name: influencerName,
                        influencer_email: influencerEmail,
                        selected_script_id: selectedScript.id,
                        custom_outreach_content: customContent,
                        parent_script_id: selectedScript.id,
                        is_pa_brand: true,
                        influencer_instance: true,
                        influencer_history: [{
                            influencer_name: influencerName,
                            influencer_email: influencerEmail,
                            sent_at: new Date().toISOString(),
                            sent_by: user.full_name || 'PA',
                            sent_by_id: user.id,
                            action: 'INITIAL_OUTREACH'
                        }],
                        brand: brandName
                    },
                    metadata: {
                        ...(project.data || {}),
                        brand: brandName,
                        is_pa_brand: true,
                        influencer_instance: true
                    }
                };

                const { data: newProject, error: createError } = await supabase
                    .from('projects')
                    .insert([newProjectData])
                    .select()
                    .single();

                if (createError) throw createError;
                if (!newProject) throw new Error('Failed to create project');

                projectId = newProject.id;
                latestProject = newProject;
                console.log('✅ Created project with ID:', projectId);

                // Create influencer record linked to the brand so it appears in PA Brand Details page
                await db.influencers.log({
                    parent_project_id: selectedScript.id,
                    instance_project_id: projectId,
                    influencer_name: influencerName,
                    influencer_email: influencerEmail,
                    brand_name: brandName,
                    script_content: selectedScript.data?.script_content,
                    content_description: selectedScript.title,
                    sent_by: user.full_name || 'PA',
                    sent_by_id: user.id,
                    status: 'SENT_TO_INFLUENCER'
                });
                console.log('✅ Created influencer record for brand:', brandName);
            } else {
                // Fetch existing project
                const { data: existingProject } = await supabase.from('projects').select('*').eq('id', projectId).single();
                latestProject = existingProject;
            }

            const scriptContent = selectedScript.data?.script_content || selectedScript.data?.idea_description || 'No script content available';

            const newHistoryEntry = {
                influencer_name: influencerName,
                influencer_email: influencerEmail,
                script_title: selectedScript.title,
                script_content: scriptContent,
                custom_content: customContent,
                sent_at: new Date().toISOString(),
                sent_by: user.full_name || 'PA'
            };

            const currentHistory = latestProject?.data?.influencer_history || [];
            const updatedHistory = [...currentHistory, newHistoryEntry];

            await db.projects.update(projectId, {
                pa_script_sent_at: new Date().toISOString(),
                data: {
                    ...(latestProject?.data || {}),
                    influencer_name: influencerName,
                    influencer_email: influencerEmail,
                    selected_script_id: selectedScript.id,
                    custom_outreach_content: customContent,
                    influencer_history: updatedHistory
                }
            });

            await supabase.functions.invoke('send-workflow-email', {
                body: {
                    event: 'SEND_TO_INFLUENCER',
                    recipient_email: influencerEmail,
                    data: {
                        project_id: projectId,
                        actor_name: user.full_name || 'PA',
                        comment: customContent || 'Campaign launched from Partnership Hub',
                        content_description: selectedScript.title || 'Script content for review',
                        script_content: scriptContent,
                        influencer_name: influencerName
                    }
                }
            });

            // Don't advance workflow for new projects - they should stay at SENT_TO_INFLUENCER
            // await db.advanceWorkflow(projectId, `Campaign launched by PA with script: ${selectedScript.title}`);
            
            setShowSuccessModal(true);
            setLaunchStep(0);
            setTimeout(() => {
                onComplete();
            }, 1500);
        } catch (error: any) {
            toast.error(error.message || 'Error launching campaign.');
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
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto p-8 space-y-10">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        <div className="p-8 bg-white border-2 border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col items-center text-center justify-center relative overflow-hidden group">
                           <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center font-black text-3xl text-white shadow-xl mb-4 relative z-10">
                                {influencerDisplayName.charAt(0)}
                           </div>
                           <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none relative z-10">{influencerDisplayName}</h2>
                           <p className="text-[10px] font-bold text-slate-400 mt-2 relative z-10 truncate w-full">{project.data?.influencer_email || '—'}</p>
                        </div>

                        <div className="p-8 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 text-white flex flex-col justify-center relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100 mb-2 relative z-10">Scripts Sent</span>
                            <div className="flex items-baseline gap-3 relative z-10">
                                <p className="text-5xl font-black">{aggregatedStats.scriptSent}</p>
                                <Send className="w-6 h-6 text-indigo-300" />
                            </div>
                        </div>

                        <div className="p-8 bg-blue-500 rounded-3xl shadow-xl shadow-blue-200 text-white flex flex-col justify-center relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100 mb-2 relative z-10">Video Link</span>
                            <div className="flex items-baseline gap-3 relative z-10">
                                <p className="text-5xl font-black">{aggregatedStats.videoLink}</p>
                                <Video className="w-6 h-6 text-blue-200" />
                            </div>
                        </div>

                        <div className="p-8 bg-purple-500 rounded-3xl shadow-xl shadow-purple-200 text-white flex flex-col justify-center relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-100 mb-2 relative z-10">Edited Video</span>
                            <div className="flex items-baseline gap-3 relative z-10">
                                <p className="text-5xl font-black">{aggregatedStats.editedVideo}</p>
                                <Layers className="w-6 h-6 text-purple-200" />
                            </div>
                        </div>

                        <div className="p-8 bg-emerald-500 rounded-3xl shadow-xl shadow-emerald-200 text-white flex flex-col justify-center relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100 mb-2 relative z-10">Proof Posted</span>
                            <div className="flex items-baseline gap-3 relative z-10">
                                <p className="text-5xl font-black">{aggregatedStats.proofPosted}</p>
                                <CheckCircle2 className="w-6 h-6 text-emerald-200" />
                            </div>
                        </div>
                    </div>

                    {/* Outreach Action Area for unlaunched projects */}
                    {project.current_stage === WorkflowStage.PARTNER_REVIEW && (
                        <div className="relative group animate-slide-up">
                            {/* Decorative Background Blob - subtle indigo instead of multi-color/pink */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
                            
                            <div className="relative bg-white border-2 border-slate-100 p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 space-y-10 overflow-hidden">
                                {/* Top Badge */}
                                <div className="absolute top-0 right-0 px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-bl-2xl">
                                    Pending Outreach
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                                        <Send className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-4xl font-black text-slate-800 uppercase tracking-tighter leading-none">Launch Campaign</h3>
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                                            Action Required to Proceed
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3 group/field">
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-1 group-focus-within/field:text-indigo-600 transition-colors">Influencer Name</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={influencerName}
                                                onChange={(e) => setInfluencerName(e.target.value)}
                                                placeholder="Enter full name..."
                                                className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-2xl font-bold text-base focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
                                            />
                                            <Users className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                        </div>
                                    </div>
                                    <div className="space-y-3 group/field">
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-1 group-focus-within/field:text-indigo-600 transition-colors">Influencer Email</label>
                                        <div className="relative">
                                            <input 
                                                type="email" 
                                                value={influencerEmail}
                                                onChange={(e) => setInfluencerEmail(e.target.value)}
                                                placeholder="name@provider.com"
                                                className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-2xl font-bold text-base focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
                                            />
                                            <Mail className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setLaunchStep(1)}
                                    className="group/btn w-full py-6 bg-indigo-600 text-white font-black uppercase text-2xl rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:translate-y-[-4px] active:translate-y-[0px] transition-all flex items-center justify-center gap-4"
                                >
                                    <div className="p-2 bg-white/20 rounded-lg group-hover/btn:scale-110 transition-transform">
                                        <Rocket className="w-6 h-6 text-white" />
                                    </div>
                                    Launch Outreach & Select Script
                                </button>
                            </div>
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
                            const proofLink = proj.data?.posting_proof_link;
                            const isNew = idx === 0;
                            
                            return (
                                <div key={proj.id} className={`bg-white border-2 rounded-[2rem] shadow-xl overflow-hidden transition-all duration-300 ${
                                    isNew ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-indigo-100' : 'border-slate-100 shadow-slate-100'
                                }`}>
                                    <div className={`p-5 px-8 flex flex-wrap items-center justify-between gap-4 ${
                                        isNew ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-slate-900 text-white'
                                    }`}>
                                        <div className="flex items-center gap-5 flex-1">
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
                                        {/* Delete Button */}
                                        <button
                                            onClick={() => handleDeleteClick(proj)}
                                            className="p-2 bg-white/20 hover:bg-red-500 text-white rounded-lg transition-colors"
                                            title="Delete Project"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2">
                                        <div className="p-8 border-b lg:border-b-0 lg:border-r border-slate-100">
                                            <div className="flex items-center justify-between mb-6">
                                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-3">
                                                    <FileText className="w-5 h-5" /> Script Content ({influencerHistory.length || 1})
                                                </span>
                                            </div>
                                            <div className="space-y-6 max-h-[450px] overflow-y-auto pr-4 custom-scrollbar">
                                                {influencerHistory.length > 0 ? (
                                                    influencerHistory
                                                        .map((entry: any, hIdx: number) => (
                                                            <div key={hIdx} className="p-6 bg-indigo-50/30 rounded-3xl border-2 border-indigo-50">
                                                                <div className="text-sm font-medium text-slate-700 italic">
                                                                    <ScriptDisplay content={entry.script_content || proj.data?.script_content || 'No script content found'} showBox={false} />
                                                                </div>
                                                            </div>
                                                        )).reverse()
                                                ) : (
                                                    <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100">
                                                        <ScriptDisplay content={proj.data?.script_content || proj.data?.idea_description || 'No content found'} showBox={false} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-8 space-y-8 bg-slate-50/30">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-3">
                                                        <Video className="w-5 h-5" /> Video Link ({rawLinksHistory.length})
                                                    </span>
                                                    {proj.current_stage !== WorkflowStage.POSTED && (
                                                        <button 
                                                            onClick={() => {
                                                                if (uploadingId === proj.id && uploadType === 'RAW') {
                                                                    setUploadingId(null);
                                                                    setUploadType(null);
                                                                } else {
                                                                    setUploadingId(proj.id);
                                                                    setUploadType('RAW');
                                                                }
                                                            }}
                                                            className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all"
                                                        >
                                                            {uploadingId === proj.id && uploadType === 'RAW' ? 'Cancel' : 'Add Link'}
                                                        </button>
                                                    )}
                                                </div>

                                                {uploadingId === proj.id && uploadType === 'RAW' && (
                                                    <div className="p-4 bg-blue-50/50 border-2 border-blue-100 rounded-2xl flex flex-col gap-3 animate-scale-in">
                                                        <input 
                                                            type="url" 
                                                            value={newVideoLink}
                                                            onChange={(e) => setNewVideoLink(e.target.value)}
                                                            placeholder="Paste video link here"
                                                            className="w-full bg-white border border-blue-200 p-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        <button 
                                                            onClick={() => handleUploadLink(proj.id, 'RAW')}
                                                            disabled={isSending}
                                                            className="w-full py-3 bg-blue-600 text-white font-black uppercase text-[10px] rounded-xl flex items-center justify-center gap-2"
                                                        >
                                                            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Submit Video Link'}
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 gap-3">
                                                    {rawLinksHistory.map((link, lIdx) => (
                                                        <a key={lIdx} href={link} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-white border-2 border-blue-50 rounded-2xl group">
                                                            <span className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{link}</span>
                                                            <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                        </a>
                                                    )).reverse()}
                                                    {rawLinksHistory.length === 0 && (
                                                        <div className="p-4 text-slate-400 text-[10px] font-black uppercase text-center border-2 border-dashed border-slate-100 rounded-2xl">No Video Link Found</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-3">
                                                        <CheckCircle2 className="w-5 h-5" /> Edited Video ({editedLinksHistory.length})
                                                    </span>
                                                    <button 
                                                        onClick={() => {
                                                            if (uploadingId === proj.id && uploadType === 'EDITED') {
                                                                setUploadingId(null);
                                                                setUploadType(null);
                                                            } else {
                                                                setUploadingId(proj.id);
                                                                setUploadType('EDITED');
                                                            }
                                                        }}
                                                        className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all"
                                                    >
                                                        {uploadingId === proj.id && uploadType === 'EDITED' ? 'Cancel' : 'Add Link'}
                                                    </button>
                                                </div>

                                                {uploadingId === proj.id && uploadType === 'EDITED' && (
                                                    <div className="p-4 bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl flex flex-col gap-3 animate-scale-in">
                                                        <input 
                                                            type="url" 
                                                            value={newVideoLink}
                                                            onChange={(e) => setNewVideoLink(e.target.value)}
                                                            placeholder="Paste edited video link here"
                                                            className="w-full bg-white border border-emerald-200 p-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                        />
                                                        <button 
                                                            onClick={() => handleUploadLink(proj.id, 'EDITED')}
                                                            disabled={isSending}
                                                            className="w-full py-3 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-xl flex items-center justify-center gap-2"
                                                        >
                                                            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Submit Edited Video'}
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 gap-3">
                                                    {editedLinksHistory.map((link, lIdx) => (
                                                        <a key={lIdx} href={link as string} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-white border-2 border-emerald-50 rounded-2xl group">
                                                            <span className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{link}</span>
                                                            <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                                                        </a>
                                                    )).reverse()}
                                                    {editedLinksHistory.length === 0 && (
                                                        <div className="p-4 text-slate-400 text-[10px] font-black uppercase text-center border-2 border-dashed border-slate-100 rounded-2xl">No Edited Video</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Proof of Posting */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] flex items-center gap-3">
                                                        <Link className="w-5 h-5" /> Proof of Posting
                                                    </span>
                                                    <button 
                                                        onClick={() => {
                                                            if (uploadingId === proj.id && uploadType === 'PROOF') {
                                                                setUploadingId(null);
                                                                setUploadType(null);
                                                            } else {
                                                                setUploadingId(proj.id);
                                                                setUploadType('PROOF');
                                                            }
                                                        }}
                                                        className="px-3 py-1 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-[9px] font-black uppercase hover:bg-orange-600 hover:text-white transition-all"
                                                    >
                                                        {uploadingId === proj.id && uploadType === 'PROOF' ? 'Cancel' : (proofLink ? 'Edit Link' : 'Add Link')}
                                                    </button>
                                                </div>

                                                {uploadingId === proj.id && uploadType === 'PROOF' && (
                                                    <div className="p-4 bg-orange-50/50 border-2 border-orange-100 rounded-2xl flex flex-col gap-3 animate-scale-in">
                                                        <input 
                                                            type="url" 
                                                            value={newVideoLink}
                                                            onChange={(e) => setNewVideoLink(e.target.value)}
                                                            placeholder="Paste live URL here"
                                                            className="w-full bg-white border border-orange-200 p-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                        />
                                                        <button 
                                                            onClick={() => handleUploadLink(proj.id, 'PROOF')}
                                                            disabled={isSending}
                                                            className="w-full py-3 bg-orange-600 text-white font-black uppercase text-[10px] rounded-xl flex items-center justify-center gap-2"
                                                        >
                                                            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Submit Proof'}
                                                        </button>
                                                    </div>
                                                )}

                                                {proofLink ? (
                                                    <a href={proofLink} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl group hover:bg-orange-100 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                                                                <CheckCircle2 className="w-4 h-4 text-white" />
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-700 truncate max-w-[160px]">{proofLink}</span>
                                                        </div>
                                                        <ExternalLink className="w-4 h-4 text-orange-400 group-hover:text-orange-600 transition-colors shrink-0" />
                                                    </a>
                                                ) : (
                                                    <div className="p-4 text-slate-400 text-[10px] font-black uppercase text-center border-2 border-dashed border-slate-100 rounded-2xl">No Proof Added Yet</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Step 1: Select Script Modal */}
            {launchStep === 1 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-2xl shadow-indigo-200/50 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b-2 border-slate-50 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                    <FileText className="w-7 h-7" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black uppercase tracking-tight text-slate-800">Select Script</h3>
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-1">Choose from finalized brand library</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setLaunchStep(0)} 
                                className="w-12 h-12 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-colors border-2 border-transparent hover:border-slate-200"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-8 max-h-[450px] overflow-y-auto space-y-4 scrollbar-hide bg-slate-50/50">
                            {availableScripts.length > 0 ? (
                                availableScripts.map(script => (
                                    <button 
                                        key={script.id}
                                        onClick={() => {
                                            setSelectedScript(script);
                                            setLaunchStep(2);
                                        }}
                                        className="w-full text-left p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-100 transition-all group flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                <Play className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-lg text-slate-800 uppercase leading-none">{script.title}</h4>
                                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-2 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" /> Ready to send
                                                </p>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            <ChevronRight className="w-5 h-5" />
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-20 bg-white border-2 border-dashed border-slate-200 rounded-[2rem]">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <AlertCircle className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <h4 className="text-xl font-black text-slate-800 uppercase">Library Empty</h4>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">No CEO-approved video scripts found.</p>
                                </div>
                            )}
                        </div>
                        {/* Modal Footer */}
                        <div className="p-6 bg-white border-t-2 border-slate-50 flex items-center justify-center">
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">
                                Showing {availableScripts.length} Approved Scripts
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Preview & Launch Modal */}
            {launchStep === 2 && selectedScript && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-2xl shadow-indigo-200/50 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b-2 border-slate-50 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <button onClick={() => setLaunchStep(1)} className="w-12 h-12 flex items-center justify-center bg-white hover:shadow-lg rounded-2xl transition-all border-2 border-slate-100">
                                    <ArrowLeft className="w-5 h-5 text-indigo-600" />
                                </button>
                                <div>
                                    <h3 className="text-3xl font-black uppercase tracking-tight text-slate-800">Finalize & Send</h3>
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-1">Review outreach details before launching</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setLaunchStep(0)} 
                                className="w-12 h-12 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-8 space-y-8 max-h-[500px] overflow-y-auto scrollbar-hide">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 space-y-2">
                                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Recipient</label>
                                    <p className="text-lg font-black text-slate-800 uppercase">{influencerName}</p>
                                    <p className="text-xs font-bold text-slate-400">{influencerEmail}</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 space-y-2">
                                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Selected Script</label>
                                    <p className="text-lg font-black text-slate-800 uppercase truncate">{selectedScript.title}</p>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Ready for Launch</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Script Content Preview</label>
                                    <span className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-tighter">Read Only</span>
                                </div>
                                <div className="p-8 bg-indigo-50/30 border-2 border-indigo-50 rounded-[2rem] max-h-60 overflow-y-auto scrollbar-hide text-base font-medium text-slate-700 leading-relaxed italic shadow-inner">
                                    <ScriptDisplay content={selectedScript.data?.script_content || selectedScript.data?.idea_description || 'No content found'} showBox={false} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2 flex items-center justify-between">
                                    Personalized Outreach Message
                                    <span className="text-[8px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full italic uppercase font-black">Highly Recommended</span>
                                </label>
                                <textarea 
                                    value={customContent}
                                    onChange={(e) => setCustomContent(e.target.value)}
                                    placeholder="Add a personalized message or additional instructions for the influencer..."
                                    className="w-full bg-white border-2 border-slate-100 p-6 rounded-[2rem] font-bold text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all h-40 shadow-sm"
                                />
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50/50 border-t-2 border-slate-50 flex items-center justify-between">
                            <div className="flex flex-col">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Official Outreach Email</p>
                                <p className="text-xs font-black text-slate-800">hello@readytowork.agency</p>
                            </div>
                            <button 
                                onClick={handleLaunchOutreach}
                                disabled={isSending}
                                className="group/launch px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-base shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:translate-y-[-4px] active:translate-y-[0px] disabled:opacity-50 transition-all flex items-center gap-4"
                            >
                                {isSending ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-6 h-6 group-hover/launch:translate-x-1 group-hover/launch:-translate-y-1 transition-transform" /> 
                                        Launch & Send Script
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="bg-white border-2 border-slate-50 rounded-[3rem] p-16 shadow-2xl shadow-emerald-100 text-center max-w-md w-full animate-in zoom-in-95 duration-300">
                        <div className="relative w-32 h-32 mx-auto mb-10">
                            <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-25"></div>
                            <div className="relative w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-200">
                                <Check className="w-16 h-16 text-white stroke-[5]" />
                            </div>
                        </div>
                        <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-4">Outreach Live!</h2>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-8">
                            The script has been sent to {influencerName}. <br/>Workflow updated successfully.
                        </p>
                        <div className="flex items-center justify-center gap-3 py-4 px-6 bg-slate-50 rounded-2xl border-2 border-slate-50 inline-flex">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Finalizing Dashboard...</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && projectToDelete && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-white border-4 border-red-500 shadow-[12px_12px_0px_0px_rgba(239,68,68,1)] max-w-md w-full p-10 animate-scale-in">
                        <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
                        <h3 className="text-3xl font-black text-slate-900 uppercase mb-4">Confirm Delete</h3>
                        <p className="text-sm font-bold text-slate-500 uppercase mb-8 leading-relaxed">
                            Are you sure you want to delete <span className="text-red-600">{projectToDelete.title}</span>?<br/>
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 py-4 border-2 border-black font-black uppercase text-xs hover:bg-slate-100 transition-all"
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="flex-1 py-4 bg-red-500 text-white border-2 border-black font-black uppercase text-xs hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <X className="w-4 h-4" />
                                        Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PAInfluencerPortfolio;
