import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, WorkflowStage } from '../../types';
import { db } from '../../services/supabaseDb';
import { ArrowLeft, Users, Instagram, Mail, Target, Tag, Briefcase, MapPin, DollarSign, Download, ExternalLink, Search, CheckCircle2, XCircle, FileText, Video, Play, ExternalLink as LinkIcon, Edit2, X, Save, Building2, Send, Clock, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../../src/integrations/supabase/client';

interface PABrandDetailsProps {
  user: User;
}

const NICHE_OPTIONS = [
  'Lifestyle',
  'Beauty',
  'Fashion',
  'Travel',
  'Health & Fitness',
  'Food',
  'Comedy & Entertainment',
  'Art & Photography',
  'Music & Dance',
  'mixed content',
  'Education',
  'Technology',
  'Other'
];

const COUNTRY_OPTIONS = [
  'Australia',
  'Canada',
  'Germany',
  'India',
  'Ireland',
  'UK',
  'USA',
  'Other'
];

const COLLAB_OPTIONS = [
  'Barter',
  'Affiliate',
  'Flat',
  'Barter+Affiliate',
  'Affiliate+Flat',
  'Barter+Flat'
];

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
  const [editInstagramError, setEditInstagramError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM' | 'OVERALL'>('OVERALL');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  
  // Advanced Filters
  const [nicheFilter, setNicheFilter] = useState('ALL');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [collabFilter, setCollabFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUpdateProductStatus = async (infId: string, newStatus: string) => {
      try {
          setUpdatingId(infId);
          const { error } = await supabase
              .from('influencers')
              .update({ product_received: newStatus })
              .eq('id', infId);

          if (error) throw error;
          
          // Optimistic update
          setInfluencers(prev => prev.map(inf => 
              inf.id === infId ? { ...inf, product_received: newStatus } : inf
          ));
          
          toast.success(`Product marked as ${newStatus === 'yes' ? 'Received' : 'Pending'}`);
      } catch (error) {
          console.error('Error updating product status:', error);
          toast.error('Failed to update status');
      } finally {
          setUpdatingId(null);
      }
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const checkRange = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    if (dateFilter === 'OVERALL') return true;
    if (dateFilter === 'TODAY') return d.toDateString() === today.toDateString();
    if (dateFilter === 'WEEKLY') {
      const sun = new Date(today);
      sun.setDate(today.getDate() - today.getDay());
      sun.setHours(0, 0, 0, 0);
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);
      sat.setHours(23, 59, 59, 999);
      return d >= sun && d <= sat;
    }
    if (dateFilter === 'MONTHLY') return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    if (dateFilter === 'CUSTOM' && customRange.start && customRange.end) {
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return d >= start && d <= end;
    }
    return false;
  };

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
          ].includes(project.current_stage) : false,
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


  // Check if influencer created_at is in range
  const isInfluencerInRange = (inf: any) => {
    if (dateFilter === 'OVERALL') return true;
    return checkRange(inf.created_at);
  };

  // Check if influencer has stories in range (for STORY brands)
  const hasStoriesInRange = (inf: any) => {
    if (dateFilter === 'OVERALL') return (inf.stories || []).length > 0;
    return (inf.stories || []).some((s: any) => checkRange(s.story_date));
  };

  const getFilteredData = (data: any[]) => {
    const filteredResults = data.filter(inf => {
      // For STORY brands:
      // - ALL filter: show influencers whose created_at is in range
      // - POSTED filter: show influencers who have stories in range
      let isInRange = false;
      
      if (currentBrandData?.brand_type === 'STORY') {
        if (activeFilter === 'POSTED') {
          // For POSTED filter, check stories date
          isInRange = hasStoriesInRange(inf);
        } else {
          // For ALL and other filters, check influencer created_at
          isInRange = isInfluencerInRange(inf);
        }
      } else {
        // For non-STORY brands, check created_at
        isInRange = isInfluencerInRange(inf);
      }

      if (!isInRange && dateFilter !== 'OVERALL') return false;

      // 2. Then apply the KPI card (status) filter
      if (activeFilter !== 'ALL') {
        if (activeFilter === 'SCRIPT_SENT' && !inf.script_sent) return false;
        if (activeFilter === 'FOOTAGE_RECEIVED' && !inf.raw_video) return false;
        if (activeFilter === 'EDITED_VIDEO' && !inf.edited_video) return false;
        if (activeFilter === 'POST_PENDING' && (inf.project_status !== WorkflowStage.POSTED || !inf.edited_video || inf.proof_link)) return false;
        
        if (activeFilter === 'POSTED') {
            if (currentBrandData?.brand_type !== 'STORY') {
                if (!inf.proof_link) return false;
            }
        }
      }

      // Apply Advanced Filters
      if (nicheFilter !== 'ALL' && inf.niche !== nicheFilter) return false;
      if (countryFilter !== 'ALL' && inf.location !== countryFilter) return false;
      if (collabFilter !== 'ALL' && !(inf.commercials || '').startsWith(collabFilter)) return false;

      return true;
    });

    // 3. Finally apply search term
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        return filteredResults.filter(inf => 
          inf.influencer_name?.toLowerCase().includes(lowerSearch) ||
          inf.instagram_profile?.toLowerCase().includes(lowerSearch) ||
          inf.influencer_email?.toLowerCase().includes(lowerSearch) ||
          inf.location?.toLowerCase().includes(lowerSearch) ||
          (inf.stories || []).some((s: any) => s.story_caption?.toLowerCase().includes(lowerSearch))
        );
    }

    return filteredResults;
  };



  const filteredInfluencers = getFilteredData(influencers);

  // Calculate stats for STORY brands separately
  const influencersByCreatedAt = currentBrandData?.brand_type === 'STORY' 
    ? influencers.filter(isInfluencerInRange)
    : filteredInfluencers;

  const storiesByStoryDate = currentBrandData?.brand_type === 'STORY'
    ? influencers.filter(hasStoriesInRange)
    : [];

  const stats = {
    // These are global totals (unfiltered) - for reference only
    total: influencers.length,
    scriptsSent: influencers.filter(i => i.script_sent).length,
    footageReceived: influencers.filter(i => !!i.raw_video).length,
    editedVideos: influencers.filter(i => !!i.edited_video).length,
    postPending: influencers.filter(i => i.project_status === WorkflowStage.POSTED && !i.proof_link).length,
    posted: influencers.filter(i => !!i.proof_link).length,
    // Filtered counts based on date range and active filter
    filteredTotal: currentBrandData?.brand_type === 'STORY'
        ? influencersByCreatedAt.length
        : filteredInfluencers.length,
    // For STORY: Total Stories Posted shows count based on story dates
    filteredPosted: currentBrandData?.brand_type === 'STORY' 
        ? storiesByStoryDate.reduce((acc, i) => {
            if (dateFilter === 'OVERALL') return acc + (i.story_count || 0);
            // Count only stories in the range
            const storiesInRangeCount = (i.stories || []).filter((s: any) => checkRange(s.story_date)).length;
            return acc + storiesInRangeCount;
          }, 0)
        : filteredInfluencers.filter(i => !!i.proof_link).length,
    // Filtered counts for REEL brands KPI cards (based on date filter only, not status filter)
    filteredScriptsSent: currentBrandData?.brand_type === 'STORY' 
        ? 0 
        : influencers.filter(inf => isInfluencerInRange(inf) && inf.script_sent).length,
    filteredFootageReceived: currentBrandData?.brand_type === 'STORY'
        ? 0
        : influencers.filter(inf => isInfluencerInRange(inf) && !!inf.raw_video).length,
    filteredEditedVideos: currentBrandData?.brand_type === 'STORY'
        ? 0
        : influencers.filter(inf => isInfluencerInRange(inf) && !!inf.edited_video).length,
    filteredPostPending: currentBrandData?.brand_type === 'STORY'
        ? 0
        : influencers.filter(inf => isInfluencerInRange(inf) && inf.project_status === WorkflowStage.POSTED && !inf.proof_link).length,
    // For STORY: Budget shows based on influencers with created_at in range
    totalAmount: (currentBrandData?.brand_type === 'STORY' ? influencersByCreatedAt : filteredInfluencers)
        .reduce((acc, inf) => {
            const val = parseFloat((inf.budget || '0').toString().replace(/[^0-9.]/g, ''));
            return acc + (isNaN(val) ? 0 : val);
        }, 0)
  };

  // Network Distribution Stats
  const networkDistribution = {
    countries: influencers.reduce((acc: any, inf) => {
      const key = inf.location || 'Other/Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    niches: influencers.reduce((acc: any, inf) => {
      const key = inf.niche || 'Other/Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    collabs: influencers.reduce((acc: any, inf) => {
      const key = (inf.commercials || 'Other/Unknown').split(' (')[0];
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  };

  const handleExport = () => {
    const headers = ['Name', 'Instagram', 'Email', 'Niche', 'Commercials', 'Location', 'Budget', 'Script Sent', 'Raw Video', 'Edited Video', 'Posted', 'Proof Link'];
    const rows = influencers.map(inf => [
        inf.influencer_name,
        inf.instagram_profile,
        inf.influencer_email,
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
    setEditInstagramError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditInstagramError(null);

    if (!editingInfluencer.instagram_profile?.trim()) {
      setEditInstagramError('Instagram profile URL is required.');
      return;
    }

    const instagramUrlRegex = /^(https?:\/\/)?(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?/;
    if (!instagramUrlRegex.test(editingInfluencer.instagram_profile)) {
      setEditInstagramError('Please enter a valid Instagram URL (e.g., https://www.instagram.com/username)');
      return;
    }
    
    setIsSaving(true);
    try {
      const { id } = editingInfluencer;
      
      // Only include valid influencer table columns to avoid "unknown column" errors
      const updates = {
        influencer_name: editingInfluencer.influencer_name,
        instagram_profile: editingInfluencer.instagram_profile,
        influencer_email: editingInfluencer.influencer_email,
        niche: editingInfluencer.niche,
        commercials: editingInfluencer.commercials,
        location: editingInfluencer.location,
        budget: editingInfluencer.budget,
        contact_details: editingInfluencer.contact_details,
        payment: editingInfluencer.payment,
        platform_type: editingInfluencer.platform_type,
        vercel_form_link: editingInfluencer.vercel_form_link
      };

      await db.influencers.update(id, updates);
      
      // Also update the associated project if one exists, to keep data in sync
      if (editingInfluencer.project_id) {
          try {
              const project = await db.projects.getById(editingInfluencer.project_id);
              if (project) {
                  await db.projects.update(editingInfluencer.project_id, {
                      data: {
                          ...(project.data || {}),
                          influencer_name: updates.influencer_name,
                          influencer_email: updates.influencer_email,
                          instagram_profile: updates.instagram_profile
                      }
                  });
              }
          } catch (projErr) {
              console.warn('Could not sync project data:', projErr);
          }
      }

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
                {dateFilter === 'MONTHLY' && (
                    <div className="flex items-center gap-2 bg-white border-2 border-black px-3 py-1 rounded-lg shadow-sm">
                        <select 
                            className="text-[10px] font-bold focus:outline-none bg-transparent cursor-pointer py-0.5"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        >
                            {months.map((month, idx) => (
                                <option key={month} value={idx}>{month}</option>
                            ))}
                        </select>
                        <select 
                            className="text-[10px] font-bold focus:outline-none bg-transparent cursor-pointer py-0.5 border-l border-slate-200 pl-2"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        >
                            {[2024, 2025, 2026].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                )}
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
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Budget</p>
                                <span className="text-3xl font-black leading-none text-green-600">{stats.totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <button onClick={() => setActiveFilter('ALL')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'ALL' ? 'bg-yellow-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center"><Users className="w-5 h-5 text-black" /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.filteredTotal}</span><span className="text-[9px] font-bold text-slate-500 uppercase">Influencers</span></div></div>
                </button>
                <button onClick={() => setActiveFilter('SCRIPT_SENT')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'SCRIPT_SENT' ? 'bg-[#0085FF] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeFilter === 'SCRIPT_SENT' ? 'bg-white/20' : 'bg-blue-50'}`}><Send className={`w-5 h-5 ${activeFilter === 'SCRIPT_SENT' ? 'text-white' : 'text-blue-500'}`} /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.filteredScriptsSent}</span><span className={`text-[9px] font-bold uppercase ${activeFilter === 'SCRIPT_SENT' ? 'text-blue-100' : 'text-slate-500'}`}>Scripts Sent</span></div></div>
                </button>
                <button onClick={() => setActiveFilter('FOOTAGE_RECEIVED')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'FOOTAGE_RECEIVED' ? 'bg-[#D946EF] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeFilter === 'FOOTAGE_RECEIVED' ? 'bg-white/20' : 'bg-pink-50'}`}><Video className={`w-5 h-5 ${activeFilter === 'FOOTAGE_RECEIVED' ? 'text-white' : 'text-pink-500'}`} /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.filteredFootageReceived}</span><span className={`text-[9px] font-bold uppercase ${activeFilter === 'FOOTAGE_RECEIVED' ? 'text-pink-100' : 'text-slate-500'}`}>Raw Videos</span></div></div>
                </button>
                <button onClick={() => setActiveFilter('EDITED_VIDEO')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'EDITED_VIDEO' ? 'bg-[#8B5CF6] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeFilter === 'EDITED_VIDEO' ? 'bg-white/20' : 'bg-purple-50'}`}><Play className={`w-5 h-5 ${activeFilter === 'EDITED_VIDEO' ? 'text-white' : 'text-purple-500'}`} /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.filteredEditedVideos}</span><span className={`text-[9px] font-bold uppercase ${activeFilter === 'EDITED_VIDEO' ? 'text-purple-100' : 'text-slate-500'}`}>Edited</span></div></div>
                </button>
                <button onClick={() => setActiveFilter('POST_PENDING')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'POST_PENDING' ? 'bg-amber-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeFilter === 'POST_PENDING' ? 'bg-white/20' : 'bg-amber-50'}`}><Clock className={`w-5 h-5 ${activeFilter === 'POST_PENDING' ? 'text-white' : 'text-amber-500'}`} /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.filteredPostPending}</span><span className={`text-[9px] font-bold uppercase ${activeFilter === 'POST_PENDING' ? 'text-amber-100' : 'text-slate-500'}`}>Approved</span></div></div>
                </button>
                <button onClick={() => setActiveFilter('POSTED')} className={`p-4 rounded-xl border-4 border-black transition-all flex flex-col justify-center h-24 text-left ${activeFilter === 'POSTED' ? 'bg-[#10B981] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' : 'bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'}`}>
                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeFilter === 'POSTED' ? 'bg-white/20' : 'bg-emerald-50'}`}><CheckCircle2 className={`w-5 h-5 ${activeFilter === 'POSTED' ? 'text-white' : 'text-emerald-500'}`} /></div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none">{stats.filteredPosted}</span><span className={`text-[9px] font-bold uppercase ${activeFilter === 'POSTED' ? 'text-emerald-100' : 'text-slate-500'}`}>Post</span></div></div>
                </button>
                <div className="p-4 rounded-xl border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-center h-24 text-left relative overflow-hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black leading-none text-green-600">{stats.totalAmount.toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Budget</span>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Network Distribution Breakdown */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
        <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-500" /> Country Distribution
            </h4>
            <div className="flex flex-wrap gap-2">
                {Object.entries(networkDistribution.countries).sort((a: any, b: any) => b[1] - a[1]).map(([name, count]: any) => (
                    <button 
                        key={name} 
                        onClick={() => setCountryFilter(countryFilter === name ? 'ALL' : name)}
                        className={`px-3 py-1.5 border-2 border-black rounded-lg flex items-center gap-2 transition-all hover:translate-y-[-2px] active:translate-y-0 ${countryFilter === name ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-slate-50 text-slate-600 hover:bg-white'}`}
                    >
                        <span className="text-[10px] font-bold uppercase">{name}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md ${countryFilter === name ? 'bg-white text-black' : 'bg-black text-white'}`}>{count}</span>
                    </button>
                ))}
            </div>
        </div>

        <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-500" /> Niche Distribution
            </h4>
            <div className="flex flex-wrap gap-2">
                {Object.entries(networkDistribution.niches).sort((a: any, b: any) => b[1] - a[1]).map(([name, count]: any) => (
                    <button 
                        key={name} 
                        onClick={() => setNicheFilter(nicheFilter === name ? 'ALL' : name)}
                        className={`px-3 py-1.5 border-2 border-black rounded-lg flex items-center gap-2 transition-all hover:translate-y-[-2px] active:translate-y-0 ${nicheFilter === name ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-slate-50 text-slate-600 hover:bg-white'}`}
                    >
                        <span className="text-[10px] font-bold uppercase">{name}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md ${nicheFilter === name ? 'bg-white text-black' : 'bg-black text-white'}`}>{count}</span>
                    </button>
                ))}
            </div>
        </div>

        <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-green-600" /> Collab Type Distribution
            </h4>
            <div className="flex flex-wrap gap-2">
                {Object.entries(networkDistribution.collabs).sort((a: any, b: any) => b[1] - a[1]).map(([name, count]: any) => (
                    <button 
                        key={name} 
                        onClick={() => setCollabFilter(collabFilter === name ? 'ALL' : name)}
                        className={`px-3 py-1.5 border-2 border-black rounded-lg flex items-center gap-2 transition-all hover:translate-y-[-2px] active:translate-y-0 ${collabFilter === name ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-slate-50 text-slate-600 hover:bg-white'}`}
                    >
                        <span className="text-[10px] font-bold uppercase">{name}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md ${collabFilter === name ? 'bg-white text-black' : 'bg-black text-white'}`}>{count}</span>
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* Search Bar Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 mb-8">
        <div className="flex-1 bg-white border-2 border-black shadow-sm rounded-xl p-3 flex items-center">
            <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" placeholder={`Search within ${activeFilter === 'ALL' ? 'all' : activeFilter.toLowerCase().replace('_', ' ')} records...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-lg font-medium focus:outline-none focus:bg-white focus:border-slate-300 transition-all text-sm" />
            </div>
        </div>
        <div className="flex items-center gap-2">
            {(activeFilter !== 'ALL' || nicheFilter !== 'ALL' || countryFilter !== 'ALL' || collabFilter !== 'ALL') && (
            <button 
                onClick={() => {
                    setActiveFilter('ALL');
                    setNicheFilter('ALL');
                    setCountryFilter('ALL');
                    setCollabFilter('ALL');
                }} 
                className="px-6 py-4 bg-slate-100 hover:bg-slate-200 border-2 border-black rounded-xl font-bold uppercase text-[10px] transition-all flex items-center gap-2"
            >
                <X className="w-3 h-3" /> Reset Filters
            </button>
            )}
        </div>
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
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap text-slate-500">Niche</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap text-slate-500">Collab Type</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap text-slate-500">Country</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Budget</th>
                {currentBrandData?.brand_type !== 'STORY' && (
                    <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap text-center">Product</th>
                )}
                {currentBrandData?.brand_type === 'STORY' && (
                    <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Stories</th>
                )}
                {currentBrandData?.brand_type === 'STORY' && (
                    <>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Payment</th>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Platform</th>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Vercel Form Link</th>
                    </>
                )}
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Added By</th>
                <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Sent By</th>
                {currentBrandData?.brand_type !== 'STORY' && (
                    <>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Script Sent</th>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Raw Video</th>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Edited Video</th>
                        <th className="px-6 py-5 uppercase font-bold tracking-wider text-[11px] whitespace-nowrap">Post</th>
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
                        <button 
                          onClick={() => { 
                            const id = inf.project_id || 'new'; 
                            const name = encodeURIComponent(inf.influencer_name); 
                            const infId = encodeURIComponent(inf.id); 
                            navigate(`/partner_associate/influencer/${id}?name=${name}&inf_id=${infId}`, { 
                              state: { 
                                influencer: inf, 
                                brandType: currentBrandData?.brand_type 
                              } 
                            }); 
                          }} 
                          className="font-bold text-blue-600 hover:text-blue-800 hover:underline text-sm whitespace-nowrap text-left flex items-center gap-2 group/name"
                        >
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

                    {currentBrandData?.brand_type !== 'STORY' && (
                        <td className="px-6 py-4">
                            <div className="flex justify-center">
                                {inf.commercials === 'Barter' ? (
                                    <div className="relative">
                                        <select 
                                            value={inf.product_received || 'no'}
                                            onChange={(e) => handleUpdateProductStatus(inf.id, e.target.value)}
                                            disabled={updatingId === inf.id}
                                            className={`appearance-none px-4 py-1.5 rounded-xl border-2 border-black text-[10px] font-black uppercase tracking-widest transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none cursor-pointer pr-8 ${inf.product_received === 'yes' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
                                        >
                                            <option value="yes" className="bg-white text-black">Yes</option>
                                            <option value="no" className="bg-white text-black">No</option>
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                            {updatingId === inf.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3 rotate-90" />}
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-slate-300 text-[10px] font-bold uppercase tracking-widest italic">N/A</span>
                                )}
                            </div>
                        </td>
                    )}

                    {currentBrandData?.brand_type === 'STORY' && (
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="px-3 py-1 bg-blue-50 text-blue-700 border-2 border-blue-200 text-[10px] font-black rounded-lg">
                                    {(inf.stories || []).filter((s: any) => checkRange(s.story_date)).length} POSTED
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
                            <td className="px-6 py-4">
                            {inf.vercel_form_link ? (
                                <a href={inf.vercel_form_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-1">
                                    <LinkIcon className="w-4 h-4" />
                                    <span className="text-xs font-bold truncate max-w-[120px]">Link</span>
                                </a>
                            ) : (
                                <span className="text-slate-300 text-xs font-bold">—</span>
                            )}
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
                
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Instagram Profile *</label>
                  <div className="relative">
                    <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-500" />
                    <input 
                      type="text" 
                      value={editingInfluencer.instagram_profile || ''}
                      onChange={(e) => {
                        setEditingInfluencer({...editingInfluencer, instagram_profile: e.target.value});
                        setEditInstagramError(null);
                      }}
                      className={`w-full pl-10 pr-4 py-3 border-2 font-bold focus:outline-none focus:bg-slate-50 ${
                        editInstagramError ? 'border-red-500 bg-red-50' : 'border-black'
                      }`}
                      placeholder="https://www.instagram.com/username"
                    />
                  </div>
                  {editInstagramError && (
                    <p className="text-red-600 text-xs font-bold">⚠️ {editInstagramError}</p>
                  )}
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
                  <label className="text-[10px] font-black uppercase text-slate-400">Niche</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                    <select 
                      value={NICHE_OPTIONS.includes(editingInfluencer?.niche) ? editingInfluencer.niche : (editingInfluencer?.niche ? 'Other' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Other') {
                          // We don't clear it immediately to keep the custom text visible if they were already editing it
                          // but if they just switched to other, we want them to type
                          if (NICHE_OPTIONS.includes(editingInfluencer.niche)) {
                             setEditingInfluencer({...editingInfluencer, niche: ''});
                          }
                        } else {
                          setEditingInfluencer({...editingInfluencer, niche: val});
                        }
                      }}
                      className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50 bg-white"
                    >
                      <option value="">Select Niche</option>
                      {NICHE_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  {editingInfluencer && (!NICHE_OPTIONS.includes(editingInfluencer.niche) || editingInfluencer.niche === 'Other') && (
                    <div className="mt-2 animate-slide-up">
                       <input 
                        type="text" 
                        value={editingInfluencer.niche === 'Other' ? '' : editingInfluencer.niche}
                        onChange={(e) => setEditingInfluencer({...editingInfluencer, niche: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                        placeholder="Specify custom niche..."
                      />
                    </div>
                  )}
                </div>
                
                {currentBrandData?.brand_type !== 'STORY' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Type of collab</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                      <select 
                        value={COLLAB_OPTIONS.find(opt => editingInfluencer.commercials?.startsWith(opt)) || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingInfluencer({
                            ...editingInfluencer, 
                            commercials: val,
                            budget: val.includes('Barter') ? 'Barter' : editingInfluencer.budget
                          });
                        }}
                        className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50 bg-white"
                      >
                        <option value="">Select Collab Type</option>
                        {COLLAB_OPTIONS.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    {editingInfluencer.commercials?.includes('Barter') && (
                      <div className="mt-2 animate-slide-up space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Product Name / Barter Details</label>
                        <input 
                          type="text" 
                          value={editingInfluencer.commercials.includes('(') ? editingInfluencer.commercials.split('(')[1].replace(')', '') : ''}
                          onChange={(e) => {
                             const base = COLLAB_OPTIONS.find(opt => editingInfluencer.commercials?.startsWith(opt)) || 'Barter';
                             setEditingInfluencer({...editingInfluencer, commercials: `${base} (${e.target.value})`});
                          }}
                          className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                          placeholder="e.g. 2 units of Premium Product X..." 
                        />
                      </div>
                    )}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Country</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    <select 
                      value={COUNTRY_OPTIONS.includes(editingInfluencer?.location) ? editingInfluencer.location : (editingInfluencer?.location ? 'Other' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Other') {
                          if (COUNTRY_OPTIONS.includes(editingInfluencer.location)) {
                            setEditingInfluencer({...editingInfluencer, location: ''});
                          }
                        } else {
                          setEditingInfluencer({...editingInfluencer, location: val});
                        }
                      }}
                      className="w-full pl-10 pr-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50 bg-white"
                    >
                      <option value="">Select Country</option>
                      {COUNTRY_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  {editingInfluencer && (!COUNTRY_OPTIONS.includes(editingInfluencer.location) || editingInfluencer.location === 'Other') && (
                    <div className="mt-2 animate-slide-up">
                       <input 
                        type="text" 
                        value={editingInfluencer.location === 'Other' ? '' : editingInfluencer.location}
                        onChange={(e) => setEditingInfluencer({...editingInfluencer, location: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                        placeholder="Specify custom country..."
                      />
                    </div>
                  )}
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

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black uppercase text-slate-400">Vercel Form Link</label>
                      <input 
                        type="url" 
                        value={editingInfluencer.vercel_form_link || ''}
                        onChange={(e) => setEditingInfluencer({...editingInfluencer, vercel_form_link: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none focus:bg-slate-50"
                        placeholder="https://forms.vercel.com/..."
                      />
                    </div>
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
