import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { db } from '../../services/supabaseDb';
import { ArrowLeft, Users, Instagram, Mail, Target, Tag, Briefcase, MapPin, DollarSign, Download, ExternalLink, Search, CheckCircle2, XCircle, FileText, Video, Play, ExternalLink as LinkIcon, Edit2, X, Save, Building2, Send, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowStage } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';

interface PABrandDetailsProps {
  user: User;
}

const PABrandDetails: React.FC<PABrandDetailsProps> = ({ user }) => {
  const { brandName } = useParams<{ brandName: string }>();
  const navigate = useNavigate();
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'SCRIPT_SENT' | 'FOOTAGE_RECEIVED' | 'EDITED_VIDEO' | 'POST_PENDING' | 'POSTED'>('ALL');
  const [currentBrandData, setCurrentBrandData] = useState<any>(null);
  
  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInfluencer, setEditingInfluencer] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM' | 'OVERALL'>('OVERALL');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const fetchInfluencers = async () => {
    if (!brandName) return;
    setIsLoading(true);
    try {
      const decodedBrand = decodeURIComponent(brandName);
      
      // Fetch both influencers and projects for this brand
      const [infByBrand, allInfLogs, { data: allUsers }, brandData] = await Promise.all([
        db.influencers.getByBrand(decodedBrand),
        db.influencers.getAll(),
        supabase.from('users').select('id, full_name'),
        db.brands.getAll()
      ]);

      const brand = brandData.find(b => b.brand_name === decodedBrand);
      if (brand) {
        setCurrentBrandData(brand);
      }

      const allProjects = await db.projects.getAll();
      const projData = allProjects.filter(p => {
        const b1 = (p.brand || '').trim().toLowerCase();
        const b2 = (p.data?.brand || '').trim().toLowerCase();
        const b3 = (p.brandSelected || '').trim().toLowerCase();
        const target = decodedBrand.trim().toLowerCase();
        return b1 === target || b2 === target || b3 === target;
      });

      const projectIds = projData.map(p => p.id);

      const userMap = new Map(allUsers?.map(u => [u.id, u.full_name]) || []);

      // Filter logs related to our projects or having the brand name
      const relevantLogs = allInfLogs.filter(inf => 
        (inf.parent_project_id && projectIds.includes(inf.parent_project_id)) ||
        (inf.instance_project_id && projectIds.includes(inf.instance_project_id)) ||
        (inf.brand_name && inf.brand_name.trim().toLowerCase() === decodedBrand.trim().toLowerCase())
      );

      // Merge and deduplicate by ID
      const combinedInf = [...infByBrand];
      relevantLogs.forEach(inf => {
        if (!combinedInf.find(c => c.id === inf.id)) {
          combinedInf.push(inf);
        }
      });

      console.log(`Found ${projData.length} projects and ${combinedInf.length} influencer records for brand ${decodedBrand}`);

      // 3. Fetch all stories for these influencers
      const influencerIds = combinedInf.map(i => i.id);
      const { data: allStories } = await supabase
          .from('influencer_stories')
          .select('*')
          .in('influencer_id', influencerIds);

      // Merge project and story data into influencers
      const mergedData = combinedInf.map(inf => {
        const infName = (inf.influencer_name || '').trim().toLowerCase();
        const infEmail = (inf.influencer_email || '').trim().toLowerCase();

        // Try to find a matching project
        const project = projData.find(p => 
          p.id === inf.instance_project_id || 
          p.id === inf.parent_project_id ||
          (p.data?.influencer_name?.trim().toLowerCase() === infName && infName.length > 0) ||
          (p.data?.influencer_email?.trim().toLowerCase() === infEmail && infEmail.length > 0)
        );

        const infStories = (allStories || []).filter(s => s.influencer_id === inf.id);
        const storyCount = infStories.length;
        const isActuallyPosted = currentBrandData?.brand_type === 'STORY' ? storyCount > 0 : (project?.current_stage === WorkflowStage.POSTED || !!project?.data?.live_url || !!project?.data?.posting_proof_link);

        return {
          ...inf,
          project_status: project?.current_stage,
          script_sent: project ? [
            WorkflowStage.SENT_TO_INFLUENCER, 
            WorkflowStage.PA_VIDEO_CMO_REVIEW,
            WorkflowStage.VIDEO_EDITING,
            WorkflowStage.PA_FINAL_REVIEW, 
            WorkflowStage.POSTED
          ].includes(project.current_stage) : (inf.status === 'SENT_TO_INFLUENCER'),
          raw_video: project?.video_link || project?.video_url,
          edited_video: project?.edited_video_link,
          is_posted: isActuallyPosted,
          proof_link: project?.data?.posting_proof_link || project?.data?.live_url || project?.data?.referral_link,
          project_id: project?.id,
          added_by_name: inf.created_by_user_id ? userMap.get(inf.created_by_user_id) || 'Unknown' : 'Unknown',
          sent_by_name: project?.data?.sent_by_name || inf.sent_by || '—',
          stories: infStories,
          story_count: storyCount
        };
      });

      setInfluencers(mergedData);
    } catch (err) {
      console.error("Failed to load data:", err);
      toast.error("Failed to load influence data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInfluencers();
  }, [brandName]);


  const getFilteredData = (data: any[]) => {
    return data.filter(inf => {
      if (activeFilter !== 'ALL') {
        if (activeFilter === 'SCRIPT_SENT' && !inf.script_sent) return false;
        if (activeFilter === 'FOOTAGE_RECEIVED' && !inf.raw_video) return false;
        if (activeFilter === 'EDITED_VIDEO' && !inf.edited_video) return false;
        if (activeFilter === 'POST_PENDING' && (inf.project_status !== WorkflowStage.POSTED || !inf.edited_video || inf.proof_link)) return false;
        if (activeFilter === 'POSTED' && !inf.proof_link) return false;
      }

      if (dateFilter !== 'OVERALL') {
        const infDate = new Date(inf.created_at);
        const now = new Date();
        
        let isInRange = false;
        
        // Helper to check if a date is in range
        const checkRange = (dateStr: string) => {
            const d = new Date(dateStr);
            if (dateFilter === 'TODAY') return d.toDateString() === now.toDateString();
            if (dateFilter === 'WEEKLY') {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(now.getDate() - 7);
                return d >= oneWeekAgo;
            }
            if (dateFilter === 'MONTHLY') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            if (dateFilter === 'CUSTOM' && customRange.start && customRange.end) {
                const start = new Date(customRange.start);
                const end = new Date(customRange.end);
                end.setHours(23, 59, 59, 999);
                return d >= start && d <= end;
            }
            return false;
        };

        isInRange = checkRange(inf.created_at);

        // For STORY brands, also check if any individual story is in range
        if (!isInRange && currentBrandData?.brand_type === 'STORY' && (inf.stories || []).length > 0) {
            isInRange = inf.stories.some((s: any) => checkRange(s.story_date));
        }

        if (!isInRange) return false;
      }

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          inf.influencer_name?.toLowerCase().includes(search) ||
          inf.instagram_profile?.toLowerCase().includes(search) ||
          inf.influencer_email?.toLowerCase().includes(search) ||
          inf.location?.toLowerCase().includes(search)
        );
      }

      return true;
    });
  };

  const filteredInfluencers = getFilteredData(influencers);

  const stats = {
    total: influencers.length,
    scriptsSent: influencers.filter(i => i.script_sent).length,
    footageReceived: influencers.filter(i => !!i.raw_video).length,
    editedVideos: influencers.filter(i => !!i.edited_video).length,
    postPending: influencers.filter(i => i.project_status === WorkflowStage.POSTED && !i.proof_link).length,
    posted: influencers.filter(i => !!i.proof_link).length,
    filteredTotal: filteredInfluencers.length,
    filteredPosted: currentBrandData?.brand_type === 'STORY' 
        ? filteredInfluencers.reduce((acc, i) => {
            if (dateFilter === 'OVERALL') return acc + (i.story_count || 0);
            
            // For other filters, count only stories in the range
            const now = new Date();
            const checkRange = (dateStr: string) => {
                const d = new Date(dateStr);
                if (dateFilter === 'TODAY') return d.toDateString() === now.toDateString();
                if (dateFilter === 'WEEKLY') {
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(now.getDate() - 7);
                    return d >= oneWeekAgo;
                }
                if (dateFilter === 'MONTHLY') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                if (dateFilter === 'CUSTOM' && customRange.start && customRange.end) {
                    const start = new Date(customRange.start);
                    const end = new Date(customRange.end);
                    end.setHours(23, 59, 59, 999);
                    return d >= start && d <= end;
                }
                return false;
            };
            const storiesInRange = (i.stories || []).filter((s: any) => checkRange(s.story_date)).length;
            return acc + storiesInRange;
          }, 0)
        : filteredInfluencers.filter(i => !!i.proof_link).length,
    totalAmount: filteredInfluencers.reduce((acc, inf) => {
        const val = parseFloat((inf.budget || '0').toString().replace(/[^0-9.]/g, ''));
        return acc + (isNaN(val) ? 0 : val);
    }, 0)
  };

  const handleExport = () => {
    const headers = ['Name', 'Instagram', 'Email', 'Campaign Type', 'Niche', 'Commercials', 'Location', 'Budget', 'Script Sent', 'Raw Video', 'Edited Video', 'Posted', 'Proof Link'];
    const rows = influencers.map(inf => [
        inf.influencer_name,
        inf.instagram_profile,
        inf.influencer_email,
        inf.campaign_type,
        inf.niche,
        inf.commercials,
        inf.location,
        inf.budget,
        inf.script_sent ? 'YES' : 'NO',
        inf.raw_video || 'N/A',
        inf.edited_video || 'N/A',
        inf.is_posted ? 'YES' : 'NO',
        inf.proof_link || 'N/A'
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${brandName}_influencers.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditClick = (inf: any) => {
    setEditingInfluencer({ ...inf });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInfluencer || !editingInfluencer.id) return;
    
    setIsSaving(true);
    try {
      const { id, project_status, script_sent, raw_video, edited_video, is_posted, proof_link, project_id, ...updates } = editingInfluencer;
      await db.influencers.update(id, updates);
      toast.success('Influencer updated successfully!');
      setIsEditModalOpen(false);
      fetchInfluencers();
    } catch (error) {
      console.error('Error updating influencer:', error);
      toast.error('Failed to update influencer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in w-full px-4 md:px-8 py-6 font-sans pb-20">
      {/* Header Area */}
      <div className="mb-6">
        <button onClick={() => navigate('/partner_associate/brands')} className="flex items-center gap-2 text-slate-500 font-bold hover:text-black mb-4 transition-colors group">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Brands</span>
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-yellow-400 border-2 border-black shadow-sm rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-8 h-8 text-black" />
                </div>
                <div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">{decodeURIComponent(brandName || '')}</h1>
                    <p className="font-bold text-slate-500 uppercase text-xs tracking-widest flex items-center gap-2">
                        <span>Partner Influence Network</span>
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        <span className="text-slate-400">{influencers.length} Total</span>
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex bg-white border-2 border-black rounded-lg overflow-hidden shadow-sm">
                    {(['OVERALL', 'TODAY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] as const).map((filter) => (
                        <button key={filter} onClick={() => setDateFilter(filter)} className={`px-4 py-2 text-[10px] font-black uppercase transition-all ${dateFilter === filter ? 'bg-black text-white' : 'bg-white text-slate-500 hover:bg-slate-50 border-r border-slate-100 last:border-0'}`}>
                            {filter}
                        </button>
                    ))}
                </div>
                {dateFilter === 'CUSTOM' && (
                    <div className="flex items-center gap-2 bg-white border-2 border-black px-3 py-1.5 rounded-lg shadow-sm">
                        <input type="date" className="text-[10px] font-bold focus:outline-none" value={customRange.start} onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))} />
                        <span className="text-slate-300">-</span>
                        <input type="date" className="text-[10px] font-bold focus:outline-none" value={customRange.end} onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))} />
                    </div>
                )}
                <button onClick={handleExport} className="px-6 py-3 bg-white border-2 border-black font-bold uppercase text-xs shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2 rounded-lg"><Download className="w-4 h-4" /> Export CSV</button>
                <button onClick={() => navigate(`/partner_associate/add-influencer?brand=${encodeURIComponent(brandName || '')}`)} className="px-6 py-3 bg-[#D946EF] text-white border-4 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2"><Users className="w-4 h-4" /> New Influencer</button>
            </div>
        </div>
      </div>

      {/* KPI Cards Section */}
      <div className="mb-6">
        {currentBrandData?.brand_type === 'STORY' ? (
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-[#D946EF] rounded-full animate-pulse"></div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                        Tracking Period: <span className="text-black">{dateFilter}</span>
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button onClick={() => setActiveFilter('ALL')} className={`p-6 rounded-2xl border-4 border-black transition-all flex flex-col justify-center h-28 text-left ${activeFilter === 'ALL' ? 'bg-yellow-400 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center"><Users className="w-6 h-6 text-black" /></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Influencers</p>
                                <span className="text-3xl font-black leading-none">{stats.filteredTotal}</span>
                            </div>
                        </div>
                    </button>
                    <button onClick={() => setActiveFilter('POSTED')} className={`p-6 rounded-2xl border-4 border-black transition-all flex flex-col justify-center h-28 text-left ${activeFilter === 'POSTED' ? 'bg-[#10B981] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeFilter === 'POSTED' ? 'bg-white/20' : 'bg-emerald-50'}`}><CheckCircle2 className={`w-6 h-6 ${activeFilter === 'POSTED' ? 'text-white' : 'text-emerald-500'}`} /></div>
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${activeFilter === 'POSTED' ? 'text-emerald-100' : 'text-slate-500'}`}>Total Stories Posted</p>
                                <span className="text-3xl font-black leading-none">{stats.filteredPosted}</span>
                            </div>
                        </div>
                    </button>
                    <div className="p-6 rounded-2xl border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-center h-28 text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-full -mr-12 -mt-12 opacity-50"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center"><DollarSign className="w-6 h-6 text-green-600" /></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Amount</p>
                                <span className="text-3xl font-black leading-none text-green-600">₹{stats.totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <button onClick={() => setActiveFilter('ALL')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'ALL' ? 'bg-yellow-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center"><Users className="w-5 h-5 text-black" /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.total}</span><span className="text-[9px] font-bold text-slate-500 uppercase">Influencers</span></div></div>
                </button>
                <button onClick={() => setActiveFilter('SCRIPT_SENT')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'SCRIPT_SENT' ? 'bg-[#0085FF] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeFilter === 'SCRIPT_SENT' ? 'bg-white/20' : 'bg-blue-50'}`}><Send className={`w-5 h-5 ${activeFilter === 'SCRIPT_SENT' ? 'text-white' : 'text-blue-500'}`} /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.scriptsSent}</span><span className={`text-[9px] font-bold uppercase ${activeFilter === 'SCRIPT_SENT' ? 'text-blue-100' : 'text-slate-500'}`}>Scripts Sent</span></div></div>
                </button>
                <button onClick={() => setActiveFilter('FOOTAGE_RECEIVED')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'FOOTAGE_RECEIVED' ? 'bg-[#D946EF] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeFilter === 'FOOTAGE_RECEIVED' ? 'bg-white/20' : 'bg-pink-50'}`}><Video className={`w-5 h-5 ${activeFilter === 'FOOTAGE_RECEIVED' ? 'text-white' : 'text-pink-500'}`} /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.footageReceived}</span><span className={`text-[9px] font-bold uppercase ${activeFilter === 'FOOTAGE_RECEIVED' ? 'text-pink-100' : 'text-slate-500'}`}>Raw Videos</span></div></div>
                </button>
                <button onClick={() => setActiveFilter('EDITED_VIDEO')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'EDITED_VIDEO' ? 'bg-[#8B5CF6] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeFilter === 'EDITED_VIDEO' ? 'bg-white/20' : 'bg-purple-50'}`}><Play className={`w-5 h-5 ${activeFilter === 'EDITED_VIDEO' ? 'text-white' : 'text-purple-500'}`} /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.editedVideos}</span><span className={`text-[9px] font-bold uppercase ${activeFilter === 'EDITED_VIDEO' ? 'text-purple-100' : 'text-slate-500'}`}>Edited</span></div></div>
                </button>
                <button onClick={() => setActiveFilter('POST_PENDING')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'POST_PENDING' ? 'bg-amber-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeFilter === 'POST_PENDING' ? 'bg-white/20' : 'bg-amber-50'}`}><Clock className={`w-5 h-5 ${activeFilter === 'POST_PENDING' ? 'text-white' : 'text-amber-500'}`} /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.postPending}</span><span className={`text-[9px] font-bold uppercase ${activeFilter === 'POST_PENDING' ? 'text-amber-100' : 'text-slate-500'}`}>Approved</span></div></div>
                </button>
                <button onClick={() => setActiveFilter('POSTED')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'POSTED' ? 'bg-[#10B981] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeFilter === 'POSTED' ? 'bg-white/20' : 'bg-emerald-50'}`}><CheckCircle2 className={`w-5 h-5 ${activeFilter === 'POSTED' ? 'text-white' : 'text-emerald-500'}`} /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.posted}</span><span className={`text-[9px] font-bold uppercase ${activeFilter === 'POSTED' ? 'text-emerald-100' : 'text-slate-500'}`}>Live</span></div></div>
                </button>
            </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 mb-8">
        <div className="flex-1 bg-white border-2 border-black shadow-sm rounded-xl p-3 flex items-center">
            <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" placeholder={`Search within ${activeFilter === 'ALL' ? 'all' : activeFilter.toLowerCase().replace('_', ' ')} records...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-lg font-medium focus:outline-none focus:bg-white focus:border-slate-300 transition-all text-sm" />
            </div>
        </div>
        {activeFilter !== 'ALL' && (
          <button onClick={() => setActiveFilter('ALL')} className="px-6 py-4 bg-slate-100 hover:bg-slate-200 border-2 border-black rounded-xl font-bold uppercase text-xs transition-all flex items-center gap-2">
            <X className="w-4 h-4" /> Clear Filter
          </button>
        )}
      </div>

      <div className="bg-white border-2 border-black shadow-md rounded-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse text-slate-600">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b-2 border-black">
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap w-16">S.No</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Actions</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Influencer Name</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Instagram</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Email Address</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Campaign</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Niche</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Commercials</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Location</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Budget</th>
                {currentBrandData?.brand_type === 'STORY' && (
                    <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Stories</th>
                )}
                {currentBrandData?.brand_type === 'STORY' && (
                    <>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Payment</th>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Platform</th>
                    </>
                )}
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Added By</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Sent By</th>
                {currentBrandData?.brand_type !== 'STORY' && (
                    <>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Script Sent</th>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Raw Video</th>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Edited Video</th>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Posted</th>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Proof</th>
                    </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={currentBrandData?.brand_type === 'STORY' ? 15 : 20} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-slate-200 border-t-[#D946EF] rounded-full animate-spin" />
                      <p className="font-black uppercase text-slate-400 tracking-widest text-xs">Loading Influence Data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredInfluencers.length > 0 ? (
                filteredInfluencers.map((inf, index) => (
                  <tr key={inf.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5 font-bold text-slate-400 text-sm whitespace-nowrap w-16">{(index + 1).toString().padStart(2, '0')}</td>
                    <td className="px-6 py-5"><button onClick={() => handleEditClick(inf)} className="p-2 bg-transparent text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Influencer"><Edit2 className="w-4 h-4" /></button></td>
                    <td className="px-6 py-5">
                        <button onClick={() => { const id = inf.project_id || 'new'; const name = encodeURIComponent(inf.influencer_name); navigate(`/partner_associate/influencer/${id}?name=${name}`); }} className="font-bold text-blue-600 hover:text-blue-800 hover:underline text-sm whitespace-nowrap text-left flex items-center gap-2 group/name">
                          {inf.influencer_name}<ExternalLink className="w-3 h-3 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                        </button>
                    </td>
                    <td className="px-6 py-4">
                      {inf.instagram_profile ? (
                        <a href={`https://instagram.com/${inf.instagram_profile.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-pink-600 font-bold hover:underline transition-all">
                          <Instagram className="w-4 h-4" /><span className="text-xs">{inf.instagram_profile}</span><ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ) : <span className="text-slate-300 text-xs font-bold">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {inf.influencer_email ? (
                        <a 
                          href={`mailto:${inf.influencer_email}`} 
                          className="flex items-center gap-2 text-blue-600 font-bold hover:underline transition-all"
                        >
                          <Mail className="w-4 h-4" />
                          <span className="text-xs lowercase">{inf.influencer_email}</span>
                        </a>
                      ) : (
                        <span className="text-slate-300 text-xs font-bold">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-orange-500" />
                            <span className="text-xs font-bold text-slate-600 uppercase">{inf.campaign_type || '—'}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-bold text-slate-600 uppercase">{inf.niche || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-bold text-slate-600 uppercase">{inf.commercials || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-bold text-slate-600 uppercase">{inf.location || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                        <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full border border-black inline-flex items-center gap-1.5">
                            <DollarSign className="w-3 h-3" />
                            <span className="text-[11px] font-bold">{inf.budget || '—'}</span>
                        </div>
                    </td>

                    {currentBrandData?.brand_type === 'STORY' && (
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="px-3 py-1 bg-blue-50 text-blue-700 border-2 border-blue-200 text-[10px] font-black rounded-lg">
                                    {inf.story_count || 0} POSTED
                                </div>
                            </div>
                        </td>
                    )}

                    {currentBrandData?.brand_type === 'STORY' && (
                        <>
                            <td className="px-6 py-4">
                            {inf.payment ? (
                                <span className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${inf.payment === 'yes' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                                {inf.payment}
                                </span>
                            ) : (
                                <span className="text-slate-300 text-xs font-bold">—</span>
                            )}
                            </td>
                            <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-700">
                                {inf.platform_type || '—'}
                            </span>
                            </td>
                        </>
                    )}
                    <td className="px-6 py-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                      {inf.added_by_name}
                    </td>
                    <td className="px-6 py-5">
                        <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            {inf.sent_by_name}
                        </span>
                    </td>
                    
                    {currentBrandData?.brand_type !== 'STORY' && (
                        <>
                            <td className="px-6 py-5">
                                {inf.script_sent ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-slate-200" />
                                )}
                            </td>
                            <td className="px-6 py-5">
                                {inf.raw_video ? (
                                    <a href={inf.raw_video} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 transition-colors">
                                        <Video className="w-5 h-5" />
                                    </a>
                                ) : (
                                    <XCircle className="w-5 h-5 text-slate-200" />
                                )}
                            </td>
                            <td className="px-6 py-5 bg-slate-50/30">
                                {inf.edited_video ? (
                                    <a href={inf.edited_video} target="_blank" rel="noreferrer" className="text-purple-500 hover:text-purple-700 transition-colors">
                                        <Play className="w-5 h-5" />
                                    </a>
                                ) : (
                                    <XCircle className="w-5 h-5 text-slate-200" />
                                )}
                            </td>
                            <td className="px-6 py-5 bg-slate-50/30">
                                {inf.is_posted ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-slate-200" />
                                )}
                            </td>
                            <td className="px-6 py-5 bg-slate-50/30">
                                {inf.proof_link ? (
                                    <a href={inf.proof_link} target="_blank" rel="noreferrer" className="text-orange-500 hover:text-orange-700 transition-colors">
                                        <LinkIcon className="w-4 h-4" />
                                    </a>
                                ) : (
                                    <span className="text-slate-300 text-xs font-bold">—</span>
                                )}
                            </td>
                        </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={currentBrandData?.brand_type === 'STORY' ? 15 : 20} className="px-6 py-20 text-center bg-slate-50">
                    <div className="max-w-xs mx-auto">
                        <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="font-black uppercase text-slate-400 text-sm mb-2">No results found</p>
                        <p className="text-xs font-bold text-slate-300">Try adjusting your search terms or adding new influencers to this brand.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Influencer Modal */}
      {isEditModalOpen && editingInfluencer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-4 border-black w-full max-w-2xl shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden animate-scale-in">
            <div className="bg-black p-6 flex items-center justify-between">
              <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                <Edit2 className="w-6 h-6 text-yellow-400" />
                Edit Influencer Details
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-white hover:text-red-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Influencer Name</label>
                  <input 
                    type="text" 
                    value={editingInfluencer.influencer_name || ''}
                    onChange={(e) => setEditingInfluencer({...editingInfluencer, influencer_name: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Instagram Profile</label>
                  <div className="relative">
                    <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-500" />
                    <input 
                      type="text" 
                      value={editingInfluencer.instagram_profile || ''}
                      onChange={(e) => setEditingInfluencer({...editingInfluencer, instagram_profile: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                      placeholder="@username"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                    <input 
                      type="email" 
                      value={editingInfluencer.influencer_email || ''}
                      onChange={(e) => setEditingInfluencer({...editingInfluencer, influencer_email: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Campaign Type</label>
                  <div className="relative">
                    <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                    <input 
                      type="text" 
                      value={editingInfluencer.campaign_type || ''}
                      onChange={(e) => setEditingInfluencer({...editingInfluencer, campaign_type: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Niche</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                    <input 
                      type="text" 
                      value={editingInfluencer.niche || ''}
                      onChange={(e) => setEditingInfluencer({...editingInfluencer, niche: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Commercials</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                    <input 
                      type="text" 
                      value={editingInfluencer.commercials || ''}
                      onChange={(e) => setEditingInfluencer({...editingInfluencer, commercials: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    <input 
                      type="text" 
                      value={editingInfluencer.location || ''}
                      onChange={(e) => setEditingInfluencer({...editingInfluencer, location: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Budget</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    <input 
                      type="text" 
                      value={editingInfluencer.budget || ''}
                      onChange={(e) => setEditingInfluencer({...editingInfluencer, budget: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                    />
                  </div>
                </div>

                {(editingInfluencer.brand_type === 'STORY' || currentBrandData?.brand_type === 'STORY') && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400">Payment</label>
                      <select 
                        value={editingInfluencer.payment || 'no'}
                        onChange={(e) => setEditingInfluencer({...editingInfluencer, payment: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50 bg-white"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>

                    {editingInfluencer.payment === 'yes' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400">Platform Type</label>
                        <input 
                          type="text" 
                          value={editingInfluencer.platform_type || ''}
                          onChange={(e) => setEditingInfluencer({...editingInfluencer, platform_type: e.target.value})}
                          className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                          placeholder="e.g. Instagram"
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Brand Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input 
                      type="text" 
                      value={editingInfluencer.brand_name || ''}
                      onChange={(e) => setEditingInfluencer({...editingInfluencer, brand_name: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50 bg-slate-50"
                      disabled
                    />
                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase italic">* Brand name cannot be changed from this view</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-6 border-t-2 border-slate-100 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-4 border-2 border-black font-black uppercase text-sm hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-4 bg-black text-white border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.4)] transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PABrandDetails;
