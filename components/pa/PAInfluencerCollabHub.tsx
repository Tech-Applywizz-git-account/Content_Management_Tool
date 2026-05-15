import React, { useState, useEffect } from 'react';
import { Project, User, STAGE_LABELS, WorkflowStage, TaskStatus, Role } from '../../types';
import { ArrowLeft, Video, CheckCircle2, User as UserIcon, FileText, ExternalLink, Info, Clock, AlertCircle, Users, Mail, History, Send, Layers, Briefcase, ChevronRight, Loader2, Check, Link, Rocket, X, Play, Edit2, Search, Instagram, Building2, Target, Tag, MapPin, DollarSign, Building, Plus, Save } from 'lucide-react';
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
    initialInfluencer?: any;
}

const PAInfluencerCollabHub: React.FC<Props> = ({ project, allInfluencerProjects = [], user, onBack, onComplete, initialInfluencer }) => {
    const [influencerName, setInfluencerName] = useState(initialInfluencer?.influencer_name || project.data?.influencer_name || (project as any).influencer_name || '');
    const [influencerEmail, setInfluencerEmail] = useState(initialInfluencer?.influencer_email || project.data?.influencer_email || (project as any).influencer_email || '');
    const influencerDisplayName = influencerName || 'Influencer';

    const [influencerRecord, setInfluencerRecord] = useState<any>(null);
    const [isEditingInfluencer, setIsEditingInfluencer] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [editForm, setEditForm] = useState<any>({
        influencer_name: '',
        budget: '',
        raw_video: '',
        edited_video: '',
        proof_link: '',
        influencer_links: [],
        posting_date: '',
        leads: '',
        comments: '',
        resource: ''
    });

    const [launchStep, setLaunchStep] = useState<number>(0); // 0: closed, 1: select script, 2: preview
    const [availableScripts, setAvailableScripts] = useState<any[]>([]);
    const [selectedScript, setSelectedScript] = useState<any>(null);
    const [customContent, setCustomContent] = useState('');

    const [newVideoLink, setNewVideoLink] = useState('');
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [uploadType, setUploadType] = useState<'RAW' | 'EDITED' | 'PROOF' | null>(null);
    const [editingLinkInfo, setEditingLinkInfo] = useState<{ projId: string, type: 'RAW' | 'EDITED' | 'PROOF', index?: number } | null>(null);
    const [editLinkValue, setEditLinkValue] = useState('');

    const [leadsData, setLeadsData] = useState<any[]>([]);
    const [leadsCount, setLeadsCount] = useState<number>(0);
    const [isLeadsLoading, setIsLeadsLoading] = useState(false);
    const [selectedLeadSource, setSelectedLeadSource] = useState<string>('All');
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Source filter function for brand mapping
    const getSourceFilterForBrand = (decodedBrandName: string): ((source: string) => boolean) | null => {
        const brand = decodedBrandName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (brand.includes('jobboard')) {
            return (source: string) => {
                const s = source.toLowerCase();
                return s.includes('jobboard') || s.includes('job board');
            };
        }
        if (brand.includes('leadmagnet') || brand.includes('rtw')) {
            return (source: string) => {
                const s = source.toLowerCase();
                return s.includes('rtw') || s.includes('lead magnet') || s.includes('leadmagnet') || 
                       s.includes('digital resume') || s.includes('resume') || s.includes('resunme');
            };
        }
        if (brand.includes('careeridentifier') || brand.includes('careridentifier') || brand.includes('cir')) {
            return (source: string) => {
                const s = source.toLowerCase();
                return s.includes('cir') || s.includes('career identifier') || s.includes('careeridentifier');
            };
        }
        if (brand.includes('applywizz') || brand === 'aw') {
            return (source: string) => {
                const s = source.toLowerCase();
                return s.includes('aw') || s.includes('applywizz') || s.includes('apply wizz');
            };
        }
        return null;
    };

    const fetchLeads = async () => {
        const targetBrand = project.brand || project.data?.brand || '';
        if (!influencerName) return;
        setIsLeadsLoading(true);
        try {
            const rawUrl = import.meta.env.VITE_LEADS_API_URL || 'http://localhost:3000/api/leads';
            const urlObj = new URL(rawUrl);
            urlObj.search = '';
            const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const end = new Date().toISOString().split('T')[0];
            urlObj.searchParams.set('startDate', start);
            urlObj.searchParams.set('endDate', end);

            const response = await fetch(urlObj.toString());
            if (!response.ok) throw new Error('Failed to fetch leads');
            const data = await response.json();
            const allLeads: any[] = data.data && Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];

            let brandFilteredLeads = allLeads;
            if (targetBrand) {
                const decodedBrand = decodeURIComponent(targetBrand);
                const sourceFilter = getSourceFilterForBrand(decodedBrand);
                if (sourceFilter) brandFilteredLeads = allLeads.filter(lead => sourceFilter(lead.source || ''));
            }

            const normalizedInfluencerName = influencerName.trim().toLowerCase();
            const influencerFilteredLeads = brandFilteredLeads.filter(lead => {
                const leadSource = (lead.source || '').trim().toLowerCase();
                return leadSource.includes(normalizedInfluencerName);
            });

            const uniqueLeads = influencerFilteredLeads.filter((lead, index, self) =>
                index === self.findIndex(l => l.email === lead.email || l.phone === lead.phone)
            );

            setLeadsData(uniqueLeads);
            setLeadsCount(uniqueLeads.length);
        } catch (err) {
            console.warn('Leads fetch error:', err);
            setLeadsCount(0);
            setLeadsData([]);
        } finally {
            setIsLeadsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
        const interval = setInterval(fetchLeads, 60000);
        return () => clearInterval(interval);
    }, [influencerName, project.brand, project.data?.brand]);

    React.useEffect(() => {
        const fetchScripts = async () => {
            let brandName = project.brand || project.data?.brand || '';
            if (!brandName) return;
            const cleanBrand = brandName.split(' (')[0].trim().toLowerCase();
            const { data } = await supabase.from('projects').select('*');
            if (data) {
                const normalizeBrand = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                const normalizedTargetBrand = normalizeBrand(cleanBrand);
                const brandProjects = data.filter(p => {
                    let pData = p.data;
                    let pMetadata = p.metadata;
                    try { if (typeof pData === 'string') pData = JSON.parse(pData); if (typeof pMetadata === 'string') pMetadata = JSON.parse(pMetadata); } catch (e) {}
                    const b1 = normalizeBrand(p.brand); const b2 = normalizeBrand(p.brandSelected); const b3 = normalizeBrand(pData?.brand);
                    const isBrandMatch = (b1 && (b1.includes(normalizedTargetBrand) || normalizedTargetBrand.includes(b1))) || (b2 && (b2.includes(normalizedTargetBrand) || normalizedTargetBrand.includes(b2))) || (b3 && (b3.includes(normalizedTargetBrand) || normalizedTargetBrand.includes(b3)));
                    const isPaBrand = pData?.is_pa_brand === true || pMetadata?.is_pa_brand === true;
                    const isInfluencer = pData?.is_influencer === true || pMetadata?.is_influencer === true;
                    return isBrandMatch && (isPaBrand || isInfluencer);
                });
                const filtered = brandProjects.filter(p => {
                    let pData = p.data;
                    try { if (typeof pData === 'string') pData = JSON.parse(pData); } catch (e) {}
                    if (!pData?.script_content) return false;
                    const scriptReviewStages = ['SCRIPT', 'SCRIPT_REVIEW_L1', 'SCRIPT_REVIEW_L2'];
                    const hasMovedPastL2 = !scriptReviewStages.includes(p.current_stage);
                    const wasApprovedByCeo = p.history?.some((h: any) => h.stage === 'SCRIPT_REVIEW_L2' && h.action === 'APPROVED');
                    return hasMovedPastL2 || wasApprovedByCeo || p.status === 'DONE' || !!pData?.pa_final_approval_at || p.current_stage === WorkflowStage.POSTED;
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
            if (registryId) { query = query.eq('id', registryId); } else { query = query.ilike('influencer_name', name.trim()).eq('brand_name', brand); }
            const { data } = await query.maybeSingle();
            if (data) {
                const { data: links } = await supabase.from('influencer_links').select('*').eq('influencer_id', data.id).order('created_at', { ascending: false });
                setInfluencerRecord({ ...data, influencer_links: links || [] });
                setEditForm({ influencer_name: data.influencer_name, budget: data.budget, raw_video: data.raw_video || '', edited_video: data.edited_video || '', proof_link: data.proof_link || '', influencer_links: links || [], posting_date: data.posting_date || '', leads: data.leads || '', comments: data.comments || '', resource: data.resource || '' });
            }
        };
        fetchInfluencer();
    }, [project]);

    const handleUpdateInfluencer = async () => {
        if (!influencerRecord?.id) { toast.error('Registry record not found'); return; }
        setIsSending(true);
        try {
            await db.influencers.update(influencerRecord.id, { influencer_name: editForm.influencer_name, budget: editForm.budget, posting_date: editForm.posting_date, leads: editForm.leads, comments: editForm.comments, resource: editForm.resource });
            const currentLinks = editForm.influencer_links || [];
            const { data: existingLinks } = await supabase.from('influencer_links').select('*').eq('influencer_id', influencerRecord.id);
            const linksToDelete = (existingLinks || []).filter(el => !currentLinks.some(cl => cl.id === el.id));
            const linksToAdd = currentLinks.filter(cl => !cl.id && cl.link.trim());
            const linksToUpdate = currentLinks.filter(cl => { const matching = (existingLinks || []).find(el => el.id === cl.id); return matching && matching.link !== cl.link; });
            await Promise.all([ ...linksToDelete.map(l => db.influencerLinks.delete(l.id)), ...linksToAdd.map(l => db.influencerLinks.add({ influencer_id: influencerRecord.id, link: l.link, brand_name: influencerRecord.brand_name, created_by_user_id: user.id })), ...linksToUpdate.map(l => supabase.from('influencer_links').update({ link: l.link }).eq('id', l.id)) ]);
            toast.success('Updated'); setIsEditingInfluencer(false); onComplete();
        } catch (error) { toast.error('Failed'); } finally { setIsSending(false); }
    };

    const handleUploadLink = async (projId: string, type: 'RAW' | 'EDITED' | 'PROOF') => {
        if (!newVideoLink.trim()) { toast.error('Please enter a link'); return; }
        setIsSending(true);
        try {
            let latestProject: any = null; let actualProjId = projId;
            if (projId.startsWith('temp-')) {
                const targetProj = sortedProjects.find(p => p.id === projId);
                const brandName = project.brand || project.data?.brand || (targetProj as any)?.brand || '';
                const createdProj = await db.projects.create({ 
                    title: `${influencerName} - Direct Video`, 
                    channel: (project.channel || 'INSTAGRAM').toUpperCase() as any, 
                    content_type: 'VIDEO', 
                    current_stage: WorkflowStage.PARTNER_REVIEW, 
                    task_status: TaskStatus.TODO, 
                    priority: 'HIGH', 
                    assigned_to_role: Role.PARTNER_ASSOCIATE, 
                    assigned_to_user_id: user.id, 
                    created_by_user_id: user.id, 
                    created_by_name: user.full_name, 
                    brand: brandName, 
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    writer_id: user.id,
                    data: { 
                        influencer_name: influencerName, 
                        influencer_email: influencerEmail, 
                        is_pa_brand: true, 
                        is_influencer: true, 
                        influencer_instance: true, 
                        brand: brandName, 
                        sent_by_id: user.id 
                    } 
                });
                latestProject = createdProj; actualProjId = createdProj.id;
            } else { const { data } = await supabase.from('projects').select('*').eq('id', projId).single(); latestProject = data; if (!latestProject) throw new Error('Project not found'); }
            let updateData: any = {};
            if (type === 'RAW') { updateData = { video_link: newVideoLink, cine_video_links_history: [...(latestProject.cine_video_links_history || []), newVideoLink], pa_raw_footage_uploaded_at: new Date().toISOString() }; if (latestProject.current_stage === WorkflowStage.SENT_TO_INFLUENCER || latestProject.current_stage === WorkflowStage.PARTNER_REVIEW) { updateData.current_stage = WorkflowStage.PA_VIDEO_CMO_REVIEW; updateData.assigned_to_role = Role.CMO; updateData.status = TaskStatus.WAITING_APPROVAL; } }
            else if (type === 'EDITED') { updateData = { edited_video_link: newVideoLink, editor_video_links_history: [...(latestProject.editor_video_links_history || []), newVideoLink] }; if (latestProject.current_stage === WorkflowStage.PA_VIDEO_CMO_REVIEW) { updateData.current_stage = WorkflowStage.PA_FINAL_REVIEW; updateData.assigned_to_role = Role.PARTNER_ASSOCIATE; updateData.assigned_to_user_id = user.id; } }
            else if (type === 'PROOF') { updateData = { data: { ...(latestProject.data || {}), posting_proof_link: newVideoLink }, current_stage: WorkflowStage.POSTED, project_status: WorkflowStage.POSTED, status: TaskStatus.DONE }; }
            await db.projects.update(actualProjId, updateData);
            await db.influencers.log({ parent_project_id: latestProject.data?.parent_script_id || actualProjId, instance_project_id: actualProjId, influencer_name: influencerName, influencer_email: influencerEmail, sent_by: user.full_name, sent_by_id: user.id, brand_name: latestProject.brand || project.brand || '', status: type === 'PROOF' ? 'POSTED' : type === 'RAW' ? 'CMO_VIDEO_REVIEW' : undefined, raw_video: type === 'RAW' ? newVideoLink : undefined, edited_video: type === 'EDITED' ? newVideoLink : undefined, proof_link: type === 'PROOF' ? newVideoLink : undefined, is_posted: type === 'PROOF' });
            toast.success(`${type} added`); setNewVideoLink(''); setUploadingId(null); setUploadType(null); onComplete();
        } catch (error: any) { toast.error('Failed'); } finally { setIsSending(false); }
    };

    const handleUpdateHistoryLink = async () => {
        if (!editingLinkInfo || !editLinkValue.trim()) return;
        setIsSending(true);
        try {
            const { projId, type, index } = editingLinkInfo;
            const { data: latestProject } = await supabase.from('projects').select('*').eq('id', projId).single();
            if (!latestProject) throw new Error('Project not found');
            let updateData: any = {};
            if (type === 'RAW') { const history = [...(latestProject.cine_video_links_history || [])]; if (index === history.length) { updateData.video_link = editLinkValue; } else { history[index!] = editLinkValue; updateData.cine_video_links_history = history; } }
            else if (type === 'EDITED') { const history = [...(latestProject.editor_video_links_history || [])]; const subHistory = [...(latestProject.sub_editor_video_links_history || [])]; const hLen = history.length; if (index === hLen + subHistory.length) { updateData.edited_video_link = editLinkValue; } else if (index! < hLen) { history[index!] = editLinkValue; updateData.editor_video_links_history = history; } else { subHistory[index! - hLen] = editLinkValue; updateData.sub_editor_video_links_history = subHistory; } }
            else if (type === 'PROOF') { updateData = { data: { ...(latestProject.data || {}), posting_proof_link: editLinkValue } }; }
            await db.projects.update(projId, updateData); toast.success('Updated'); setEditingLinkInfo(null); onComplete();
        } catch (error) { toast.error('Failed'); } finally { setIsSending(false); }
    };

    const handleDeleteClick = (proj: Project) => { setProjectToDelete(proj); setShowDeleteModal(true); };
    const handleConfirmDelete = async () => { if (!projectToDelete) return; setIsDeleting(true); try { await supabase.from('projects').delete().eq('id', projectToDelete.id); await supabase.from('influencers').delete().eq('instance_project_id', projectToDelete.id); toast.success('Deleted'); setShowDeleteModal(false); onComplete(); } catch (error) { toast.error('Failed'); } finally { setIsDeleting(false); } };
    const sortedProjects = [...allInfluencerProjects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const aggregatedStats = sortedProjects.reduce((acc, p) => { const isDirect = !!p.video_link && !p.data?.script_content; if (p.current_stage !== WorkflowStage.PARTNER_REVIEW && !isDirect) acc.scriptSent += 1; if (!!p.video_link || (p.cine_video_links_history || []).length > 0) acc.videoLink += 1; if (!!p.edited_video_link || (p.editor_video_links_history || []).length > 0) acc.editedVideo += 1; if (!!p.data?.posting_proof_link || p.current_stage === WorkflowStage.POSTED) acc.proofPosted += 1; return acc; }, { scriptSent: 0, videoLink: 0, editedVideo: 0, proofPosted: 0 });

    const handleLaunchOutreach = async () => {
        if (!influencerName.trim() || !influencerEmail.trim() || !selectedScript) { toast.error('Fields missing'); return; }
        setIsSending(true);
        try {
            let projectId = project.id;
            if (!projectId || projectId.startsWith('temp-') || project.current_stage === WorkflowStage.POSTED) {
                const brandName = project.brand || project.data?.brand || selectedScript.data?.brand || '';
                const { data: newProject } = await supabase.from('projects').insert([{ title: `${influencerName} - ${selectedScript.title}`, channel: (project.channel || 'INSTAGRAM').toUpperCase(), content_type: 'VIDEO', current_stage: WorkflowStage.SENT_TO_INFLUENCER, task_status: TaskStatus.TODO, priority: 'HIGH', assigned_to_role: Role.PARTNER_ASSOCIATE, assigned_to_user_id: user.id, created_by_user_id: user.id, created_by_name: user.full_name, brand: brandName, data: { influencer_name: influencerName, influencer_email: influencerEmail, selected_script_id: selectedScript.id, custom_outreach_content: customContent, parent_script_id: selectedScript.id, is_pa_brand: true, influencer_instance: true, influencer_history: [{ influencer_name: influencerName, influencer_email: influencerEmail, sent_at: new Date().toISOString(), sent_by: user.full_name, action: 'INITIAL_OUTREACH' }], brand: brandName } }]).select().single();
                projectId = newProject.id;
            }
            await db.projects.update(projectId, { current_stage: WorkflowStage.SENT_TO_INFLUENCER, pa_script_sent_at: new Date().toISOString() });
            await supabase.functions.invoke('send-workflow-email', { body: { event: 'SEND_TO_INFLUENCER', recipient_email: influencerEmail, data: { project_id: projectId, actor_name: user.full_name, script_content: selectedScript.data?.script_content, influencer_name: influencerName } } });
            await db.influencers.log({ parent_project_id: selectedScript.id, instance_project_id: projectId, influencer_name: influencerName, influencer_email: influencerEmail, status: 'SCRIPT_SENT', brand_name: project.brand || project.data?.brand || '', sent_by: user.full_name });
            setShowSuccessModal(true); setLaunchStep(0); setTimeout(() => onComplete(), 1500);
        } catch (error) { toast.error('Error'); } finally { setIsSending(false); }
    };
    
    const reelPerformanceData = (influencerRecord?.influencer_links || []).slice().sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
        <div className="min-h-screen bg-slate-50 font-sans flex flex-col animate-fade-in pb-32 relative">
            <header className="h-16 bg-white/90 backdrop-blur-md border-b-2 border-indigo-50 flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center space-x-6">
                    <button onClick={onBack} className="p-2.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-xl transition-all"><ArrowLeft className="w-5 h-5" /></button>
                    <div><h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Brand Hub</h1><p className="text-[10px] font-bold text-indigo-500 uppercase mt-1">Managed by {user.full_name}</p></div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-1.5 bg-slate-100 rounded-full border text-[10px] font-bold text-slate-600 uppercase">{project.brand || project.data?.brand}</div>
                    <button onClick={() => setLaunchStep(1)} className="px-6 py-2.5 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-xl shadow-lg hover:bg-indigo-700">Send New Script</button>
                    {user.role !== Role.CMO && <button onClick={() => setIsEditingInfluencer(true)} className="p-2.5 bg-white border-2 border-slate-100 rounded-xl"><Edit2 className="w-5 h-5" /></button>}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-8 py-10 space-y-10">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="p-5 bg-white border-2 border-slate-100 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black text-xl mb-3">{influencerDisplayName.charAt(0)}</div>
                            <h2 className="text-lg font-bold text-slate-900 uppercase">{influencerDisplayName}</h2>
                        </div>
                        {[ {l:'Script Sent', v:aggregatedStats.scriptSent, c:'bg-indigo-600', i:<Send className="w-4 h-4"/>}, {l:'Raw Videos', v:aggregatedStats.videoLink, c:'bg-blue-500', i:<Video className="w-4 h-4"/>}, {l:'Edited Videos', v:aggregatedStats.editedVideo, c:'bg-purple-500', i:<Layers className="w-4 h-4"/>}, {l:'Proof', v:aggregatedStats.proofPosted, c:'bg-emerald-500', i:<CheckCircle2 className="w-4 h-4"/>}, {l:'Leads', v:leadsCount, c:'bg-slate-900', i:<Target className="w-4 h-4"/>} ].map((s,i)=>(
                            <div key={i} className={`p-5 ${s.c} rounded-2xl shadow-lg text-white flex flex-col justify-center`}>
                                <span className="text-[9px] font-bold uppercase tracking-wider mb-2 opacity-80">{s.l}</span>
                                <div className="flex items-baseline gap-2"><p className="text-3xl font-bold">{s.v}</p>{s.i}</div>
                            </div>
                        ))}
                    </div>

                    <section className="space-y-6">
                        <div className="flex items-center gap-4"><h2 className="text-xl font-black uppercase text-slate-900">Influencer Details</h2><div className="h-px flex-1 bg-slate-200" /></div>
                        <div className="grid gap-3 lg:grid-cols-2">
                            <div className="rounded-[2rem] border-2 border-slate-100 bg-white p-4 shadow-sm">
                                <h3 className="text-sm font-black uppercase text-indigo-600 mb-4">Campaign</h3>
                                <div className="grid gap-3 grid-cols-2">
                                    <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Type</p><p className="text-sm font-bold">{influencerRecord?.campaign_type || '—'}</p></div>
                                    <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Comm.</p><p className="text-sm font-bold">{influencerRecord?.commercials || '—'}</p></div>
                                </div>
                            </div>
                            <div className="rounded-[2rem] border-2 border-slate-100 bg-white p-4 shadow-sm">
                                <h3 className="text-sm font-black uppercase text-orange-600 mb-4">Payment</h3>
                                <div className="grid gap-3 grid-cols-3">
                                    <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Status</p><p className="text-sm font-bold">{influencerRecord?.payment_status || '—'}</p></div>
                                    <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Date</p><p className="text-sm font-bold">{influencerRecord?.payment_date?.split('T')[0] || '—'}</p></div>
                                    <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Platform</p><p className="text-sm font-bold">{influencerRecord?.platform_type || '—'}</p></div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-black uppercase text-slate-900">Reel Performance</h2>
                            <div className="h-px flex-1 bg-slate-200" />
                        </div>
                        
                        <div className="bg-white border-2 border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Posting Date</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Reel URL</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Resource</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Comments</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Leads</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {reelPerformanceData.map((reel, idx) => (
                                            <tr key={reel.id || idx} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {reel.posting_date ? new Date(reel.posting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 min-w-[200px] max-w-[300px]">
                                                    <a 
                                                        href={reel.link} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors group"
                                                    >
                                                        <Instagram className="w-3.5 h-3.5" />
                                                        <span className="text-xs font-bold truncate block flex-1">{reel.link}</span>
                                                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </a>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100 inline-block">
                                                        {reel.resource || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-sm font-black text-slate-900">{reel.comments || '0'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-sm font-black text-indigo-600">{reel.leads || '0'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <DollarSign className="w-3 h-3 text-slate-400" />
                                                        <span className="text-sm font-black text-slate-900">{reel.price || '—'}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {reelPerformanceData.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-50/20">
                                                    No reel performance data found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <div className="flex items-center gap-3"><h2 className="text-xl font-black uppercase text-slate-900">Leads Information</h2><div className="h-px flex-1 bg-slate-200" /></div>
                        <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-4 shadow-sm space-y-4">
                            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="p-2 bg-slate-900 text-white rounded-xl"><Target className="w-5 h-5"/></div><div><p className="text-[10px] font-black text-slate-400 uppercase">Total Leads</p><p className="text-xl font-bold">{leadsCount}</p></div></div>{isLeadsLoading && <div className="text-indigo-600 animate-pulse text-[10px] font-bold uppercase">Syncing...</div>}</div>
                            {leadsData.length > 0 && (
                                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    <button onClick={()=>setSelectedLeadSource('All')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${selectedLeadSource==='All' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>All ({leadsData.length})</button>
                                    {Array.from(new Set(leadsData.map(l=>l.source))).filter(Boolean).map(s=>{ const c = leadsData.filter(l=>l.source===s).length; return <button key={s} onClick={()=>setSelectedLeadSource(s)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${selectedLeadSource===s ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 border'}`}>{s} ({c})</button> })}
                                </div>
                            )}
                            <div className="space-y-1">
                                {leadsData.filter(l=>selectedLeadSource==='All'||l.source===selectedLeadSource).map((l,i)=>(
                                    <div key={i} className="grid md:grid-cols-4 gap-4 items-center p-3 bg-slate-50/50 hover:bg-white border border-transparent hover:border-indigo-100 rounded-xl transition-all">
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Name</span><span className="text-xs font-bold">{l.name||'—'}</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Phone</span><span className="text-xs font-bold">{l.phone||'—'}</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Email</span><span className="text-xs font-bold text-slate-600 truncate">{l.email||'—'}</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Source</span><span className="text-[10px] font-bold text-indigo-600 uppercase">{l.source||'—'}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <div className="space-y-12">
                        <div className="flex items-center gap-4"><h3 className="text-lg font-bold text-slate-900 uppercase flex items-center gap-2"><History className="w-5 h-5 text-indigo-600" /> Partnership History</h3><div className="h-0.5 bg-gradient-to-r from-indigo-100 to-transparent flex-1 rounded-full"></div></div>
                        {sortedProjects.map((proj, idx) => {
                            const influencerHistory = proj.data?.influencer_history || [];
                            const rawLinksHistory = Array.from(new Set([...(proj.cine_video_links_history || []), proj.video_link])).filter(Boolean);
                            const editedLinksHistory = Array.from(new Set([...(proj.editor_video_links_history || []), ...(proj.sub_editor_video_links_history || []), proj.edited_video_link])).filter(Boolean);
                            const isNew = idx === 0;
                            return (
                                <div key={proj.id} className={`bg-white border-2 rounded-[2rem] shadow-xl overflow-hidden ${isNew ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-100'}`}>
                                    <div className={`p-4 px-6 flex items-center justify-between ${isNew ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-slate-900 text-white'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold">{sortedProjects.length - idx}</div>
                                            <div><h4 className="text-lg font-bold uppercase">{proj.title}</h4><span className="px-2 py-0.5 bg-white/20 text-[8px] font-bold uppercase rounded">{STAGE_LABELS[proj.current_stage]}</span></div>
                                        </div>
                                        {user.role !== Role.CMO && <button onClick={() => handleDeleteClick(proj)} className="p-2 bg-white/20 hover:bg-red-500 rounded-lg"><X className="w-5 h-5" /></button>}
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2">
                                        <div className="p-6 border-r border-slate-100 max-h-[450px] overflow-y-auto scrollbar-hide">
                                            <span className="text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-2 mb-4"><FileText className="w-4 h-4" /> Script</span>
                                            {influencerHistory.map((e: any, i: number) => ( <div key={i} className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-50 mb-3"><p className="text-xs">{e.script_content}</p></div> )).reverse()}
                                        </div>
                                        <div className="p-6 space-y-6 bg-slate-50/30">
                                            {[ {t:'RAW', label:'Video Link', links:rawLinksHistory, color:'text-blue-600', bg:'bg-blue-50', btnBg:'bg-blue-600'}, {t:'EDITED', label:'Edited Video', links:editedLinksHistory, color:'text-emerald-600', bg:'bg-emerald-50', btnBg:'bg-emerald-600'}, {t:'PROOF', label:'Proof', links:proj.data?.posting_proof_link ? [proj.data.posting_proof_link] : [], color:'text-orange-600', bg:'bg-orange-50', btnBg:'bg-orange-600'} ].map((sec,si)=>(
                                                <div key={si} className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-[9px] font-bold uppercase ${sec.color}`}>{sec.label} ({sec.links.length})</span>
                                                        {proj.current_stage !== WorkflowStage.POSTED && user.role !== Role.CMO && <button onClick={()=> { setUploadingId(uploadingId === proj.id && uploadType === sec.t ? null : proj.id); setUploadType(uploadingId === proj.id && uploadType === sec.t ? null : sec.t as any); }} className={`px-3 py-1 ${sec.bg} ${sec.color} rounded-lg text-[9px] font-black uppercase border`}>{uploadingId === proj.id && uploadType === sec.t ? 'Cancel' : 'Add'}</button>}
                                                    </div>
                                                    {uploadingId === proj.id && uploadType === sec.t && (
                                                        <div className={`p-4 ${sec.bg} rounded-2xl border flex flex-col gap-3`}>
                                                            <input value={newVideoLink} onChange={e=>setNewVideoLink(e.target.value)} placeholder="Paste link..." className="w-full bg-white p-3 rounded-xl text-xs font-bold border outline-none"/>
                                                            <button onClick={()=>handleUploadLink(proj.id, sec.t as any)} className={`w-full py-3 ${sec.btnBg} text-white font-black uppercase text-[10px] rounded-xl`}>Submit</button>
                                                        </div>
                                                    )}
                                                    {sec.links.map((l,li)=>(
                                                        <div key={li} className="flex items-center gap-2 group">
                                                            <a href={l as string} target="_blank" className="flex-1 flex items-center justify-between p-4 bg-white border rounded-2xl hover:border-indigo-200"><span className="text-xs font-bold truncate max-w-[180px]">{l}</span><ExternalLink className="w-4 h-4 opacity-30"/></a>
                                                            {user.role !== Role.CMO && <button onClick={()=>{ setEditingLinkInfo({projId:proj.id, type:sec.t as any, index:li}); setEditLinkValue(l as string); }} className="p-3 bg-white border rounded-2xl"><Link className="w-4 h-4"/></button>}
                                                        </div>
                                                    )).reverse()}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            {isEditingInfluencer && ( <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"><div className="bg-white rounded-[2.5rem] w-full max-w-xl p-8 shadow-2xl"> <div className="flex justify-between mb-8"><div><h3 className="text-2xl font-black uppercase">Edit Profile</h3></div><button onClick={()=>setIsEditingInfluencer(false)}><X className="w-5 h-5"/></button></div> <div className="space-y-4"> <input value={editForm.influencer_name} onChange={e=>setEditForm({...editForm, influencer_name:e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-2" placeholder="Name"/> <input value={editForm.posting_date} onChange={e=>setEditForm({...editForm, posting_date:e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-2" placeholder="Posting Date"/> <input value={editForm.leads} onChange={e=>setEditForm({...editForm, leads:e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-2" placeholder="Leads"/> </div> <button onClick={handleUpdateInfluencer} className="w-full py-5 bg-indigo-600 text-white font-black uppercase rounded-2xl mt-8">Save Changes</button> </div></div> )}
        </div>
    );
};

export default PAInfluencerCollabHub;
