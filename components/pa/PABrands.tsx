import React, { useState, useEffect, useMemo } from 'react';
import { User, Role } from '../../types';
import { db, normalizePABrandName, SYSTEM_BRANDS, getDynamicSourceFilterForBrand } from '../../services/supabaseDb';
import { CheckCircle2, AlertCircle, Building2, Trash2, Plus, ArrowLeft, ArrowRight, Search, Users, Instagram, Mail, X, Shirt, Smartphone, Coffee, Clapperboard, Zap, ShoppingBag, Crown, Palette, Globe, Trophy, Video, MapPin, Tag, DollarSign, ExternalLink, Phone, Calendar, Pencil, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../src/integrations/supabase/client';
import SearchResultsTable, { InfluencerSearchRow } from './SearchResultsTable';


interface PABrandsProps {
  user: User;
  category?: 'REEL' | 'STORY' | null;
}


const PABrands: React.FC<PABrandsProps> = ({ user, category: propCategory }) => {
  const navigate = useNavigate();
  const { category: urlCategory } = useParams();
  const [brands, setBrands] = useState<any[]>([]);
  const [allInfluencers, setAllInfluencers] = useState<any[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInfluencer, setSelectedInfluencer] = useState<any | null>(null);
  const [selectedInfluencerRow, setSelectedInfluencerRow] = useState<InfluencerSearchRow | null>(null);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedBrandData, setExpandedBrandData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [brandToDelete, setBrandToDelete] = useState<{ id: string, name: string } | null>(null);

  // Restore cached data instantly on mount to avoid blank screens
  useEffect(() => {
    try {
      const cachedBrands = sessionStorage.getItem('pa_brands_cache');
      const cachedInfluencers = sessionStorage.getItem('pa_influencers_cache');
      if (cachedBrands) setBrands(JSON.parse(cachedBrands));
      if (cachedInfluencers) setAllInfluencers(JSON.parse(cachedInfluencers));
    } catch {}
  }, []);
  
  // Resolve active category from prop or URL
  const [activeTab, setActiveTab] = useState<'REEL' | 'STORY' | null>(null);
  
  useEffect(() => {
    if (propCategory) {
      setActiveTab(propCategory);
    } else if (urlCategory) {
      const cat = urlCategory.toUpperCase();
      if (cat === 'REELS' || cat === 'REEL') setActiveTab('REEL');
      else if (cat === 'STORIES' || cat === 'STORY') setActiveTab('STORY');
      else setActiveTab(null);
    } else {
      setActiveTab(null);
    }
  }, [propCategory, urlCategory]);

  const [totalInfluencerCount, setTotalInfluencerCount] = useState(0);
  

  // Consistent brand name normalization - same as PABrandDetails
  const normalizeBrand = normalizePABrandName;
  const normalizeBrandForCount = (value: string | null | undefined = '') => {
    const raw = (value || '').toString().trim();
    if (raw.toUpperCase() === 'JOB BOARD') return '';
    return normalizePABrandName(raw);
  };

  const getInstagramHandle = (links: any[] = [], explicitHandle?: string) => {
    const parseHandle = (value: string) => {
      const raw = value.trim();
      if (!raw) return '';

      const urlMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(.+)/i);
      const candidate = urlMatch ? urlMatch[1] : raw;
      const cleaned = candidate
        .replace(/\?.*$/, '')
        .replace(/\//g, '')
        .replace(/^@+/, '')
        .trim();

      return cleaned ? `@${cleaned}` : '';
    };

    if (explicitHandle && explicitHandle.trim()) {
      const parsed = parseHandle(explicitHandle);
      if (parsed) return parsed;
    }

    const instagramLink = links
      .map((link: any) => link.link || '')
      .find((link: string) => link.toLowerCase().includes('instagram.com'));

    if (!instagramLink) return '@unknown';

    const cleaned = parseHandle(instagramLink);
    return cleaned || '@unknown';
  };

  const parseBudgetValue = (value: unknown) => {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return value;
    const cleaned = String(value).replace(/[^0-9.]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const groupInfluencersByNameAndBrand = (rows: any[]) => {
    const grouped = new Map<string, any>();
    rows.forEach(inf => {
      const key = `${(inf.influencer_name || '').trim().toLowerCase()}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          ...inf,
          brand_name: normalizeBrand(inf.brand_name),
          influencer_links: inf.influencer_links || [],
          stories: inf.stories || [],
          brands: inf.brand_name ? [inf.brand_name.trim()] : [],
          brand_types: [(inf.brand_type || 'UNKNOWN').toUpperCase()],
        });
        return;
      }

      existing.influencer_links = [...(existing.influencer_links || []), ...(inf.influencer_links || [])]
        .filter((link, index, arr) => link?.link && arr.findIndex(item => item.link === link.link) === index);
      existing.stories = [...(existing.stories || []), ...(inf.stories || [])]
        .filter((story, index, arr) => story?.id ? arr.findIndex(item => item.id === story.id) === index : true);
      existing.influencer_email = existing.influencer_email || inf.influencer_email;
      existing.budget = existing.budget || inf.budget;
      existing.niche = existing.niche || inf.niche;
    });
    return Array.from(grouped.values());
  };

  const influencerSearchRows = useMemo<InfluencerSearchRow[]>(() => {
    const rows = new Map<string, any>();
    const leadSources = allLeads.map(lead => (lead.source || '').trim().toLowerCase());

    allInfluencers.forEach((inf: any) => {
      const key = `${(inf.influencer_name || '').trim().toLowerCase()}`;
      const existing = rows.get(key);
      const brandName = (inf.brand_name || 'Unassigned').trim();
      const brandType = (inf.brand_type || 'UNKNOWN').toUpperCase();
      const instagram_handle = inf.instagram_profile || '';
      const budgetValue = parseBudgetValue(inf.budget || inf.commercials || 0);

      if (!existing) {
        rows.set(key, {
          id: inf.id || key,
          influencer_name: inf.influencer_name || 'Unknown creator',
          influencer_email: inf.influencer_email || '',
          instagram_handle,
          influencer_links: inf.influencer_links || [],
          total_budget: budgetValue,
          total_leads: key ? leadSources.filter(source => source.includes(key)).length : 0,
          brands: brandName ? [brandName] : [],
          brand_types: [brandType],
          primary_brand: brandName,
          profile_initial: (inf.influencer_name || 'I')[0]?.toUpperCase() || 'I',
          profile_color: 'bg-slate-900',
        });
        return;
      }

      existing.total_budget = Number(existing.total_budget || 0) + budgetValue;
      existing.influencer_links = [...new Map([...(existing.influencer_links || []), ...(inf.influencer_links || [])].map((link: any) => [link.link, link])).values()];
      if (brandName && !existing.brands.includes(brandName)) {
        existing.brands.push(brandName);
      }
      if (brandType && !existing.brand_types.includes(brandType)) {
        existing.brand_types.push(brandType);
      }
      if (!existing.instagram_handle) {
        existing.instagram_handle = instagram_handle;
      }
    });

    return Array.from(rows.values()).map(item => ({
      ...item,
      total_budget: `$${Number(item.total_budget || 0).toLocaleString()}`,
    }));
  }, [allInfluencers, allLeads]);

  const filteredInfluencerRows = useMemo<InfluencerSearchRow[]>(() => {
    if (!searchQuery) return [];
    const low = searchQuery.toLowerCase();

    return influencerSearchRows.filter(row => {
      const nameMatch = row.influencer_name.toLowerCase().includes(low);
      const instagramMatch = row.instagram_handle.toLowerCase().includes(low);
      const brandMatch = row.brands.some(brand => brand.toLowerCase().includes(low));
      const linkMatch = row.influencer_links.some(link => (link.link || '').toLowerCase().includes(low));
      return nameMatch || instagramMatch || brandMatch || linkMatch;
    });
  }, [influencerSearchRows, searchQuery]);

  const handleSelectBrandDetails = async (brandName: string, rowId: string) => {
    if (expandedRowId === rowId && expandedBrandData?.brand_name === brandName) {
      setExpandedRowId(null);
      setExpandedBrandData(null);
      return;
    }

    setExpandedRowId(rowId);
    setExpandedBrandData({ brand_name: brandName, _loading: true });
    setSelectedInfluencerRow(null);
    setOpenPopoverId(null);

    const row = influencerSearchRows.find(r => r.id === rowId);
    const influencerName = row?.influencer_name?.trim() || '';
    const infNameLower = influencerName.toLowerCase();

    const brandSourceFilter = getDynamicSourceFilterForBrand(brandName, brands);

    try {
      // 1. Fetch directly from influencers table for accurate raw data
      const { data: infRecords } = await supabase
        .from('influencers')
        .select('*, influencer_links(*)')
        .ilike('influencer_name', influencerName)
        .order('created_at', { ascending: false });

      const specificInf = (infRecords || []).find((inf: any) =>
        normalizePABrandName(inf.brand_name) === normalizePABrandName(brandName)
      );

      // 2. Cross-reference with projects to get the latest workflow state
      let latestAction = 'No recent action';
      let proofLink: string | null = null;

      if (specificInf) {
        const parentId = specificInf.parent_project_id || 'none';
        const instanceId = specificInf.instance_project_id || 'none';

        const { data: projectData } = await supabase
          .from('projects')
          .select('current_stage, data, pa_script_sent_at, video_link, edited_video_link')
          .or(`id.eq.${parentId},id.eq.${instanceId}`)
          .limit(1);

        const project = projectData?.[0];
        proofLink = project?.data?.posting_proof_link || project?.data?.live_url || null;

        const scriptSent = !!specificInf.script_content || !!project?.pa_script_sent_at;
        const rawVideo = !!(project?.video_link || specificInf.video_link);
        const editedVideo = !!(project?.edited_video_link || specificInf.edited_video_link);
        const isPosted = !!(project?.data?.posting_proof_link || project?.data?.live_url);

        if (proofLink || isPosted)       latestAction = 'Proof Uploaded';
        else if (editedVideo)            latestAction = 'Edited Video Uploaded';
        else if (rawVideo)               latestAction = 'Raw Video Received';
        else if (scriptSent)             latestAction = 'Script Sent';
        else if (specificInf.status === 'SENT_TO_INFLUENCER' || specificInf.pitch_sent === 'yes')
                                         latestAction = 'Pitch Sent';
      }

      // 3. Count leads: first filter by brand, THEN by influencer name
      let leads = allLeads;
      if (leads.length === 0) {
        try {
          const start = '2024-01-01';
          const end = new Date().toISOString().split('T')[0];
          const rawUrl = import.meta.env.VITE_LEADS_API_URL || 'http://localhost:3000/api/leads';
          const urlObj = new URL(rawUrl);
          urlObj.search = '';
          urlObj.searchParams.set('startDate', start);
          urlObj.searchParams.set('endDate', end);
          const resp = await fetch(urlObj.toString());
          if (resp.ok) {
            const d = await resp.json();
            leads = d.data && Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
          }
        } catch (_) {}
      }

      // Step A: filter leads down to only those belonging to this brand
      const brandLeads = leads.filter((l: any) => brandSourceFilter ? brandSourceFilter(l.source || '') : false);

      // Step B: within brand leads, count those whose source matches this influencer name
      const influencerBrandLeads = infNameLower
        ? brandLeads.filter((l: any) => (l.source || '').toLowerCase().includes(infNameLower)).length
        : brandLeads.length;

      const found = brands.find(b => normalizePABrandName(b.brand_name) === normalizePABrandName(brandName));

      setExpandedBrandData({
        brand_name: brandName,
        campaign_name: found?.campaign_name || found?.brand_name || brandName,
        niche: specificInf?.niche || 'N/A',
        collab_type: specificInf?.campaign_type || specificInf?.collab_type || specificInf?.collab || 'N/A',
        influencer_budget: specificInf?.budget || specificInf?.commercials || 'Not available',
        influencer_brand_leads: influencerBrandLeads,
        latest_action: latestAction,
        proof_link: proofLink,
      });
    } catch (err) {
      console.error('Error fetching brand details:', err);
      setExpandedBrandData(null);
      setExpandedRowId(null);
    }
  };


  const handleViewDetails = (row: InfluencerSearchRow) => {
    setSelectedInfluencerRow(row);
    setExpandedRowId(null);
    setExpandedBrandData(null);
    setOpenPopoverId(null);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setOpenPopoverId(null);
    setExpandedRowId(null);
    setExpandedBrandData(null);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Brands first
      console.log('🔄 Dashboard: Fetching brands...');
      const brandsData = await db.brands.getAll();
      const allBrands = [...brandsData, ...SYSTEM_BRANDS];
      const uniqueBrandsMap = new Map<string, any>();
      allBrands.forEach((brand: any) => {
        const normalized = normalizeBrand(brand.brand_name || '');
        if (!normalized) return;
        if (!uniqueBrandsMap.has(normalized)) {
          uniqueBrandsMap.set(normalized, brand);
        }
      });
      setBrands(Array.from(uniqueBrandsMap.values()));
      try { sessionStorage.setItem('pa_brands_cache', JSON.stringify(Array.from(uniqueBrandsMap.values()))); } catch {}
      
      // 2. Fetch Influencers and calculate unique counts based on the brands we just got
      console.log('📊 Dashboard: Requesting influencers...');
      const influencerData = await db.influencers.getAll();
      const influencerIds = (influencerData || []).map((inf: any) => inf.id);
      const [{ data: links }, { data: stories }] = influencerIds.length > 0
        ? await Promise.all([
            supabase.from('influencer_links').select('*').in('influencer_id', influencerIds),
            supabase.from('influencer_stories').select('*').in('influencer_id', influencerIds)
          ])
        : [{ data: [] }, { data: [] }];
      const enrichedInfluencers = (influencerData || []).map((inf: any) => ({
        ...inf,
        influencer_links: (links || []).filter((link: any) => link.influencer_id === inf.id),
        stories: (stories || []).filter((story: any) => story.influencer_id === inf.id)
      }));
      setAllInfluencers(enrichedInfluencers);
      try { sessionStorage.setItem('pa_influencers_cache', JSON.stringify(enrichedInfluencers)); } catch {}
      
      const uniqueInfluencers = new Set(
        influencerData?.filter(inf => {
          const infBrandClean = normalizeBrandForCount(inf.brand_name);
          return infBrandClean && allBrands.some(b => normalizeBrand(b.brand_name) === infBrandClean);
        }).map(inf => `${inf.influencer_name}-${normalizeBrandForCount(inf.brand_name)}`)
      );
      setTotalInfluencerCount(uniqueInfluencers.size);
      
      // 3. Fetch Leads for total counts
      try {
        const start = '2024-01-01';
        const end = new Date().toISOString().split('T')[0];
        const rawUrl = import.meta.env.VITE_LEADS_API_URL || 'http://localhost:3000/api/leads';
        const urlObj = new URL(rawUrl);
        urlObj.search = '';
        urlObj.searchParams.set('startDate', start);
        urlObj.searchParams.set('endDate', end);
        
        const response = await fetch(urlObj.toString());
        if (response.ok) {
            const data = await response.json();
            const fetchedLeads: any[] = data.data && Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
            setAllLeads(fetchedLeads);
        }
      } catch (e) {
        console.warn('Leads fetch error:', e);
      }
      
    } catch (err) {
      console.error("❌ Dashboard: Data fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  const categoryCounts = useMemo(() => {
    const reelBrands = brands.filter(b => (b.brand_type || 'REEL').toUpperCase() === 'REEL').map(b => normalizeBrand(b.brand_name));
    const storyBrands = brands.filter(b => (b.brand_type || '').toUpperCase() === 'STORY').map(b => normalizeBrand(b.brand_name));
    
    const reelInfs = allInfluencers.filter(inf => reelBrands.includes(normalizeBrandForCount(inf.brand_name)));
    const storyInfs = allInfluencers.filter(inf => storyBrands.includes(normalizeBrandForCount(inf.brand_name)));
    
    return {
        reelBrands: reelBrands.length,
        storyBrands: storyBrands.length,
        reelInfs: reelInfs.length,
        storyInfs: storyInfs.length
    };
  }, [brands, allInfluencers]);

  const handleBrandClick = (brand: any) => {
    const rolePath = user.role === Role.SUB_EDITOR ? 'sub_editor' : user.role.toLowerCase();
    navigate(`/${rolePath}/brand-details/${encodeURIComponent(brand.brand_name)}`, {
      state: { fromTab: activeTab || 'REEL' }
    });
  };

  const handleDeleteBrand = (e: React.MouseEvent, brandId: string, brandName: string) => {
    e.stopPropagation(); // Prevent navigation
    setBrandToDelete({ id: brandId, name: brandName });
  };

  const confirmDeleteBrand = async () => {
    if (!brandToDelete) return;
    
    setIsSubmitting(true);
    try {
      await db.brands.delete(brandToDelete.id);
      setBrands(prev => prev.filter(b => b.id !== brandToDelete.id));
      setSuccessMessage(`Brand "${brandToDelete.name}" was successfully deleted`);
      setBrandToDelete(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      toast.error(error.message || 'Failed to delete brand');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBrandIcon = (name: string) => {
    const n = name.toLowerCase();
    const iconClass = "w-5 h-5 text-slate-800 group-hover:text-black transition-colors";
    
    if (n.includes('cloth') || n.includes('fashion') || n.includes('wear')) return <Shirt className={iconClass} />;
    if (n.includes('tech') || n.includes('gadget') || n.includes('phone') || n.includes('app')) return <Zap className={iconClass} />;
    if (n.includes('food') || n.includes('drink') || n.includes('cafe')) return <Coffee className={iconClass} />;
    if (n.includes('video') || n.includes('media') || n.includes('film')) return <Video className={iconClass} />;
    if (n.includes('store') || n.includes('shop') || n.includes('market')) return <ShoppingBag className={iconClass} />;
    if (n.includes('premium') || n.includes('luxur')) return <Crown className={iconClass} />;
    if (n.includes('art') || n.includes('design') || n.includes('creative')) return <Palette className={iconClass} />;
    if (n.includes('global') || n.includes('world')) return <Globe className={iconClass} />;
    
  // Default fallback - more professional building icon
    return <Building2 className={iconClass} />;
  };

  const filteredBrands = brands.filter(brand => {
    const brandMatch = brand.brand_name.toLowerCase().includes(searchQuery.toLowerCase());
    // Also include brands if any of their influencers match the search query
    const hasMatchingInfluencer = allInfluencers.some(inf => {
      const infBrandClean = normalizeBrand(inf.brand_name);
      const bNameClean = normalizeBrand(brand.brand_name);
      return infBrandClean === bNameClean && 
      inf.influencer_name.toLowerCase().includes(searchQuery.toLowerCase());
    });
    return brandMatch || hasMatchingInfluencer;

  });

  const activeTabFilteredRows = useMemo(() => {
    if (!activeTab || !searchQuery) return [];
    return filteredInfluencerRows.filter(row =>
      row.brands.some(brand => {
        const matchedBrand = brands.find(b => normalizeBrand(b.brand_name) === normalizeBrand(brand));
        return matchedBrand ? (matchedBrand.brand_type || 'REEL').toUpperCase() === activeTab : false;
      })
    );
  }, [activeTab, filteredInfluencerRows, brands, searchQuery]);

  const handleCategorySelect = (type: 'REEL' | 'STORY') => {
    const rolePath = user.role === Role.SUB_EDITOR ? 'sub_editor' : user.role.toLowerCase();
    const categoryPath = type === 'REEL' ? 'reels' : 'stories';
    const url = `/${rolePath}/brands/${categoryPath}`;
    navigate(url);
  };


  return (
    <div className="animate-fade-in w-full max-w-7xl mx-auto h-screen overflow-visible py-3 px-3 font-sans text-sm">
      <div className="h-full flex flex-col overflow-visible">
        <div className="h-full max-h-screen overflow-visible">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-4">
        <div className="flex items-center gap-6">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">
              {activeTab ? `${activeTab === 'REEL' ? 'Reels' : 'Stories'} Brands` : 'Brand Dashboard'}
            </h2>
            
            {!activeTab && (
              <div className="flex items-center gap-4 px-4 py-3 bg-[#7C3AED] text-white border-2 border-black rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all group">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                      <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col">
                      <span className="text-3xl font-black leading-none tracking-tighter">{totalInfluencerCount}</span>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-200 mt-1">Total Influencers</span>
                  </div>
              </div>
            )}
        </div>

        {activeTab && (
          <div className="flex items-center gap-4">
             <button
              onClick={() => {
                const rolePath = user.role === Role.SUB_EDITOR ? 'sub_editor' : user.role.toLowerCase();
                navigate(`/${rolePath}/brands`);
              }}
              className="flex items-center gap-2 px-6 py-4 bg-white text-black border-4 border-black font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>

            {user?.role !== Role.CMO && (
              <button
                onClick={() => navigate('/partner_associate/create-brand', { state: { defaultType: activeTab } })}
                className="flex items-center gap-3 px-8 py-4 bg-yellow-400 text-black border-4 border-black font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-y-0 animate-in fade-in zoom-in duration-300"
              >
                <Plus className="w-6 h-6" />
                <span>Add New Brand</span>
              </button>
            )}
          </div>
        )}
      </div>

      {!activeTab && (
        <div className="mb-6 relative max-w-2xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none z-10">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search creators, influencers, niches, or brands..."
            className="w-full pl-12 pr-6 py-4 bg-white border-[3px] border-black rounded-3xl font-black text-base transition-all outline-none focus:ring-6 focus:ring-violet-50 tracking-tight shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {!activeTab && searchQuery && (
        <div className="max-w-6xl mx-auto py-8">
          <SearchResultsTable
            rows={filteredInfluencerRows}
            searchQuery={searchQuery}
            isLoading={isLoading}
            resultsLabel="Influencer search results"
            onClearSearch={handleClearSearch}
            openPopoverId={openPopoverId}
            onTogglePopover={(id) => setOpenPopoverId(openPopoverId === id ? null : id)}
            onSelectBrand={handleSelectBrandDetails}
            onViewDetails={handleViewDetails}
            expandedRowId={expandedRowId}
            expandedBrandData={expandedBrandData}
            onCloseExpanded={() => {
              setExpandedRowId(null);
              setExpandedBrandData(null);
            }}
            userRole={user.role}
          />
        </div>
      )}

      {!activeTab && !searchQuery && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto py-6">
            <button
                onClick={() => handleCategorySelect('REEL')}
                className="px-5 py-5 border-[5px] border-black font-black tracking-tight transition-all flex flex-col items-center gap-3 rounded-[2.25rem] bg-white text-slate-900 hover:bg-violet-600 hover:text-white hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group"
            >
                <div className="w-20 h-20 rounded-[1.75rem] bg-slate-50 flex items-center justify-center border-3 border-black transition-colors group-hover:bg-white group-hover:text-violet-600">
                    <Video className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <span className="text-2xl uppercase tracking-tighter italic block mb-1">Reels</span>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100">View Reel Brands</p>
                </div>
                
                <div className="flex flex-col gap-2 w-full mt-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border-2 border-black text-xs flex-1 justify-center bg-black text-white group-hover:bg-white group-hover:text-black">
                        <Building2 className="w-4 h-4" />
                        <span className="font-black uppercase">{categoryCounts.reelBrands} Brands</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border-2 border-black text-xs flex-1 justify-center bg-violet-100 text-violet-600 group-hover:bg-white group-hover:text-violet-600">
                        <Users className="w-4 h-4" />
                        <span className="font-black uppercase">{categoryCounts.reelInfs} Influencers</span>
                    </div>
                </div>
            </button>

            <button
                onClick={() => handleCategorySelect('STORY')}
                className="px-5 py-5 border-[5px] border-black font-black tracking-tight transition-all flex flex-col items-center gap-3 rounded-[2.25rem] bg-white text-slate-900 hover:bg-cyan-600 hover:text-white hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group"
            >
                <div className="w-20 h-20 rounded-[1.75rem] bg-slate-50 flex items-center justify-center border-3 border-black transition-colors group-hover:bg-white group-hover:text-cyan-600">
                    <Building2 className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <span className="text-2xl uppercase tracking-tighter italic block mb-1">Stories</span>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100">View Story Brands</p>
                </div>

                <div className="flex flex-col gap-2 w-full mt-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border-2 border-black text-xs flex-1 justify-center bg-black text-white group-hover:bg-white group-hover:text-black">
                        <Building2 className="w-4 h-4" />
                        <span className="font-black uppercase">{categoryCounts.storyBrands} Brands</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border-2 border-black text-xs flex-1 justify-center bg-cyan-100 text-cyan-600 group-hover:bg-white group-hover:text-cyan-600">
                        <Users className="w-4 h-4" />
                        <span className="font-black uppercase">{categoryCounts.storyInfs} Influencers</span>
                    </div>
                </div>
            </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 text-green-700 p-4 border-2 border-green-400 font-bold shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] flex items-center gap-3 mb-8">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          {successMessage}
        </div>
      )}

      {isLoading && brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-[#7C3AED] rounded-full animate-spin mb-4" />
              <p className="text-slate-400 font-black uppercase tracking-widest">Loading Brands...</p>
          </div>
      ) : activeTab ? (
        <>
          {searchQuery && activeTabFilteredRows.length > 0 && (
            <div className="mb-8">
              <SearchResultsTable
                rows={activeTabFilteredRows}
                searchQuery={searchQuery}
                isLoading={isLoading}
                resultsLabel={`Search results for ${activeTab === 'REEL' ? 'Reels' : 'Stories'}`}
                onClearSearch={handleClearSearch}
                openPopoverId={openPopoverId}
                onTogglePopover={(id) => setOpenPopoverId(openPopoverId === id ? null : id)}
                onSelectBrand={handleSelectBrandDetails}
                onViewDetails={handleViewDetails}
                expandedRowId={expandedRowId}
                expandedBrandData={expandedBrandData}
                onCloseExpanded={() => {
                  setExpandedRowId(null);
                  setExpandedBrandData(null);
                }}
                userRole={user.role}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 py-3">
            {filteredBrands
              .filter((brand: any) => ((brand.brand_type || 'REEL').toUpperCase() === activeTab))
              .sort((a: any, b: any) => (a.brand_name || '').localeCompare(b.brand_name || ''))
              .map((brand: any) => (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => handleBrandClick(brand)}
                  className="group flex h-full flex-col justify-between rounded-[2rem] border border-slate-200 bg-white p-6 text-left transition hover:border-slate-300 hover:shadow-[0_18px_45px_-25px_rgba(15,23,42,0.12)] hover:bg-slate-50"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-slate-900">
                    {getBrandIcon(brand.brand_name)}
                  </div>

                  <h3 className="mt-4 text-base md:text-lg font-black uppercase tracking-tight leading-tight text-slate-900 break-words line-clamp-2">
                    {brand.brand_name}
                  </h3>

                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Objective</p>
                    <p className="mt-2 text-sm text-slate-700 leading-snug line-clamp-2">
                      {brand.campaign_objective || 'Not specified'}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-sky-600">
                      <Users className="h-4 w-4" />
                      {new Set(
                        allInfluencers
                          .filter((inf: any) => normalizeBrandForCount(inf.brand_name) === normalizeBrand(brand.brand_name))
                          .map((inf: any) => `${inf.influencer_name}-${inf.influencer_email}`)
                      ).size} influencers
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-500 transition group-hover:text-slate-700" />
                  </div>
                </button>
              ))}
          </div>
        </>
      ) : null}

      {brandToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-4 border-black p-8 max-w-md w-full shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">Confirm Delete</h3>
            <p className="font-bold text-slate-600 mb-8 leading-relaxed">
              Are you sure you want to delete <span className="text-black font-black underline decoration-red-500 decoration-2 italic">"{brandToDelete.name}"</span>?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setBrandToDelete(null)}
                className="flex-1 px-6 py-3 border-2 border-black font-black uppercase hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteBrand}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-red-500 text-white border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}


      </div>
    </div>

      {selectedInfluencer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border-2 border-black p-0 max-w-2xl w-full rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">{selectedInfluencer.influencer_name}</h3>
                        <div className="flex items-center gap-2 opacity-80">
                            <Building2 className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">{selectedInfluencer.brand_name || 'No Influencer'}</span>
                        </div>
                    </div>
                </div>
                <button 
                  onClick={() => setSelectedInfluencer(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div className="flex items-center gap-2 text-indigo-600 mb-2">
                            <Mail className="w-4 h-4" />
                            <span className="text-[10px] font-black tracking-widest text-slate-400">Email Address</span>
                        </div>
                        <p className="font-bold text-slate-800 break-all">{selectedInfluencer.influencer_email || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div className="flex items-center gap-2 text-pink-600 mb-2">
                            <Instagram className="w-4 h-4" />
                            <span className="text-[10px] font-black tracking-widest text-slate-400">Reel Links</span>
                        </div>
                        <p className="font-bold text-slate-800 break-all">{(selectedInfluencer.influencer_links || []).map((linkObj: any) => linkObj.link).join(' | ') || '—'}</p>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <Tag className="w-4 h-4 text-purple-600 mb-2" />
                        <span className="text-[9px] font-black text-slate-400 block">Niche</span>
                        <span className="font-bold text-sm uppercase">{selectedInfluencer.niche || '—'}</span>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <MapPin className="w-4 h-4 text-red-600 mb-2" />
                        <span className="text-[9px] font-black text-slate-400 block">Location</span>
                        <span className="font-bold text-sm uppercase">{selectedInfluencer.location || '—'}</span>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <DollarSign className="w-4 h-4 text-green-600 mb-2" />
                        <span className="text-[9px] font-black text-slate-400 block">Budget</span>
                        <span className="font-bold text-sm uppercase">{selectedInfluencer.budget || '—'}</span>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <Calendar className="w-4 h-4 text-blue-600 mb-2" />
                        <span className="text-[9px] font-black text-slate-400 block">Category</span>
                        <span className="font-bold text-sm uppercase">{selectedInfluencer.brand_type || 'REEL'}</span>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => handleBrandClick({ brand_name: selectedInfluencer.brand_name })}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-200"
                >
                    <Building2 className="w-5 h-5" />
                    View Brand Details
                </button>
                <button 
                  onClick={() => setSelectedInfluencer(null)}
                  className="px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                    Close
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PABrands;
