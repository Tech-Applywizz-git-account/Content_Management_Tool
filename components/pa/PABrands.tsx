import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { db, SYSTEM_BRANDS, normalizePABrandName } from '../../services/supabaseDb';
import { CheckCircle2, AlertCircle, Building2, Trash2, Plus, ArrowLeft, ArrowRight, Search, UserPlus, Users, Instagram, Mail, X, Shirt, Smartphone, Coffee, Clapperboard, Zap, ShoppingBag, Crown, Palette, Globe, Trophy, Video, MapPin, Tag, DollarSign, ExternalLink, Phone, Calendar, Pencil, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { Role } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';

interface PABrandsProps {
  user: User;
}


const PABrands: React.FC<PABrandsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<any[]>([]);
  const [allInfluencers, setAllInfluencers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInfluencer, setSelectedInfluencer] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [brandToDelete, setBrandToDelete] = useState<{ id: string, name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'REEL' | 'STORY' | null>(null);
  const [totalInfluencerCount, setTotalInfluencerCount] = useState(0);
  

  // Consistent brand name normalization - same as PABrandDetails
  const normalizeBrand = normalizePABrandName;

  const groupInfluencersByNameAndBrand = (rows: any[]) => {
    const grouped = new Map<string, any>();
    rows.forEach(inf => {
      const key = `${(inf.influencer_name || '').trim().toLowerCase()}__${normalizeBrand(inf.brand_name)}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          ...inf,
          brand_name: normalizeBrand(inf.brand_name),
          influencer_links: inf.influencer_links || [],
          stories: inf.stories || []
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Brands first
      console.log('🔄 Dashboard: Fetching brands...');
      const brandsData = await db.brands.getAll();
      const allBrands = [...SYSTEM_BRANDS, ...brandsData];
      setBrands(allBrands);
      
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
      const enrichedInfluencers = groupInfluencersByNameAndBrand((influencerData || []).map((inf: any) => ({
        ...inf,
        influencer_links: (links || []).filter((link: any) => link.influencer_id === inf.id),
        stories: (stories || []).filter((story: any) => story.influencer_id === inf.id)
      })));
      setAllInfluencers(enrichedInfluencers);
      
      const uniqueInfluencers = new Set(
        influencerData?.filter(inf => {
          const infBrandClean = normalizeBrand(inf.brand_name);
          return allBrands.some(b => {
            const bNameClean = normalizeBrand(b.brand_name);
            return bNameClean === infBrandClean && infBrandClean !== '';
          });
        }).map(inf => `${inf.influencer_name}-${normalizeBrand(inf.brand_name)}`)
      );
      setTotalInfluencerCount(uniqueInfluencers.size);
      
    } catch (err) {
      console.error("❌ Dashboard: Data fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  const handleBrandClick = (brand: any) => {
    const rolePath = user.role.toLowerCase();
    navigate(`/${rolePath}/brand-details/${encodeURIComponent(brand.brand_name)}`);
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
  const filteredInfluencers = allInfluencers.filter(inf => 
    inf.influencer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inf.brand_name && inf.brand_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );


  return (
    <div className="animate-fade-in w-full max-w-7xl mx-auto py-8 px-4 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-6">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Brands Dashboard</h2>
            
            <div className="flex items-center gap-4 px-6 py-4 bg-[#7C3AED] text-white border-[3px] border-black rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] transition-all group">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-4xl font-black leading-none tracking-tighter">{totalInfluencerCount}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200 mt-1">Total Influencers</span>
                </div>
            </div>
        </div>

        {user?.role !== Role.CMO && activeTab && (
          <button
            onClick={() => navigate('/partner_associate/create-brand', { state: { defaultType: activeTab } })}
            className="flex items-center gap-3 px-8 py-4 bg-yellow-400 text-black border-4 border-black font-black uppercase tracking-widest shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-y-0 animate-in fade-in zoom-in duration-300"
          >
            <Plus className="w-6 h-6" />
            <span>Create New {activeTab === 'REEL' ? 'Reel' : 'Story'} Brand</span>
          </button>
        )}
      </div>

      <div className="mb-10 relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Search for influencers..."
          className="w-full pl-12 pr-6 py-4 bg-white border border-black rounded-2xl font-black text-sm transition-all outline-none focus:ring-4 focus:ring-slate-50 tracking-tight"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-6 max-w-2xl">
          <button
              onClick={() => setActiveTab('REEL')}
              className={`px-10 py-6 border-[4px] border-black font-black tracking-tight transition-all flex flex-col items-center gap-4 rounded-[2.5rem] flex-1 group ${
                  activeTab === 'REEL' 
                  ? 'bg-violet-600 text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] translate-y-[-4px]' 
                  : 'bg-white text-slate-400 hover:bg-slate-50 hover:translate-y-[-2px]'
              }`}
          >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-black transition-colors ${activeTab === 'REEL' ? 'bg-white text-violet-600' : 'bg-slate-50 text-slate-300 group-hover:bg-white'}`}>
                    <Video className="w-6 h-6" />
                </div>
                <span className="text-2xl uppercase tracking-tighter italic">Reels</span>
              </div>
              <div className="flex items-center gap-3 w-full">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-black text-[10px] flex-1 justify-center ${activeTab === 'REEL' ? 'bg-black text-white' : 'bg-white text-slate-400'}`}>
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="font-black uppercase">{brands.filter(b => (b.brand_type || 'REEL') === 'REEL').length} Brands</span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-black text-[10px] flex-1 justify-center ${activeTab === 'REEL' ? 'bg-black text-white' : 'bg-white text-slate-400'}`}>
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-black uppercase">{
                        new Set(
                          allInfluencers
                            .filter(inf => {
                              const brand = brands.find(b => {
                                const bNameClean = normalizeBrand(b.brand_name);
                                const infBrandClean = normalizeBrand(inf.brand_name);
                                return bNameClean === infBrandClean && infBrandClean !== '';
                              });
                              return brand && (brand.brand_type || 'REEL') === 'REEL';
                            })
                            .map(inf => `${inf.influencer_name}-${normalizeBrand(inf.brand_name)}`)
                        ).size
                      } Influencers</span>
                  </div>
              </div>
          </button>

          <button
              onClick={() => setActiveTab('STORY')}
              className={`px-10 py-6 border-[4px] border-black font-black tracking-tight transition-all flex flex-col items-center gap-4 rounded-[2.5rem] flex-1 group ${
                  activeTab === 'STORY' 
                  ? 'bg-cyan-600 text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] translate-y-[-4px]' 
                  : 'bg-white text-slate-400 hover:bg-slate-50 hover:translate-y-[-2px]'
              }`}
          >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-black transition-colors ${activeTab === 'STORY' ? 'bg-white text-cyan-600' : 'bg-slate-50 text-slate-300 group-hover:bg-white'}`}>
                    <Building2 className="w-6 h-6" />
                </div>
                <span className="text-2xl uppercase tracking-tighter italic">Stories</span>
              </div>
              <div className="flex items-center gap-3 w-full">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-black text-[10px] flex-1 justify-center ${activeTab === 'STORY' ? 'bg-black text-white' : 'bg-white text-slate-400'}`}>
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="font-black uppercase">{brands.filter(b => b.brand_type === 'STORY').length} Brands</span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-black text-[10px] flex-1 justify-center ${activeTab === 'STORY' ? 'bg-black text-white' : 'bg-white text-slate-400'}`}>
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-black uppercase">{
                        new Set(
                          allInfluencers
                            .filter(inf => {
                              const brand = brands.find(b => {
                                const bNameClean = normalizeBrand(b.brand_name);
                                const infBrandClean = normalizeBrand(inf.brand_name);
                                return bNameClean === infBrandClean && infBrandClean !== '';
                              });
                              return brand && brand.brand_type === 'STORY';
                            })
                            .map(inf => `${inf.influencer_name}-${normalizeBrand(inf.brand_name)}`)
                        ).size
                      } Influencers</span>
                  </div>
              </div>
          </button>
      </div>

      {successMessage && (
        <div className="bg-green-50 text-green-700 p-4 border-2 border-green-400 font-bold shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] flex items-center gap-3 mb-8">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          {successMessage}
        </div>
      )}

      {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-[#7C3AED] rounded-full animate-spin mb-4" />
              <p className="text-slate-400 font-black uppercase tracking-widest">Loading Brands...</p>
          </div>
      ) : (
        <>
          {searchQuery && filteredInfluencers.length > 0 && (
            <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-black tracking-tighter text-slate-900">Influencer matches ({filteredInfluencers.length})</h3>
                </div>
                <div className="flex flex-col gap-5">
                    {filteredInfluencers.map(inf => (
                        <div 
                          key={inf.id} 
                          className="bg-white border-[3px] border-black rounded-3xl p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all group"
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <span className="text-white font-black text-2xl">{inf.influencer_name?.[0]?.toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-slate-900 leading-none mb-2">{inf.influencer_name}</h4>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 text-[11px] font-black text-white rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] border-2 border-black">
                                                <Building2 className="w-3.5 h-3.5" />
                                                {inf.brand_name || 'Unassigned'}
                                            </div>
                                            {inf.brand_type && (
                                                <span className="px-3 py-1 bg-slate-50 text-[11px] font-black text-slate-500 rounded-lg border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                                    {inf.brand_type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 flex-1 lg:max-w-2xl">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 tracking-widest mb-1 uppercase">Email</span>
                                        <span className="text-sm font-black text-slate-900 truncate max-w-[150px]">{inf.influencer_email || '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 tracking-widest mb-1 uppercase">Links</span>
                                        {(inf.influencer_links || [])[0]?.link ? (
                                            <a 
                                              href={(inf.influencer_links || [])[0]?.link} 
                                              target="_blank" 
                                              rel="noreferrer"
                                              className="text-sm font-black text-violet-600 hover:underline flex items-center gap-1.5 transition-all"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                                <Instagram className="w-3.5 h-3.5" />
                                                <span className="truncate max-w-[130px]">{inf.influencer_links.length} link{inf.influencer_links.length === 1 ? '' : 's'}</span>
                                            </a>
                                        ) : (
                                            <span className="text-sm font-black text-slate-300">—</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 tracking-widest mb-1 uppercase">Stats</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900">{inf.niche || '—'}</span>
                                            <span className="w-1.5 h-1.5 bg-black rounded-full" />
                                            <span className="text-sm font-black text-cyan-600">{inf.budget || '—'}</span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                  onClick={() => inf.brand_name && handleBrandClick({ brand_name: inf.brand_name })}
                                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-black transition-all flex items-center gap-2 whitespace-nowrap"
                                >
                                    Open Brand <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="h-px bg-slate-200 w-full mt-10 mb-10" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {activeTab && brands
              .filter(brand => (brand.brand_type || 'REEL') === activeTab)
              .map((brand: any) => (
            <div 
              key={brand.id} 
              onClick={() => handleBrandClick(brand)}
              className={`bg-white border border-black p-5 transition-all flex flex-col cursor-pointer group rounded-3xl shadow-sm hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] ${brand.isSystem ? 'bg-slate-50/50' : ''}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className={`p-2.5 rounded-xl border border-black transition-colors bg-white ${activeTab === 'REEL' ? 'text-violet-600' : 'text-cyan-600'}`}>
                  {getBrandIcon(brand.brand_name)}
                </div>
                <div className="flex items-center gap-2">
                  {!brand.isSystem && user.role !== Role.CMO && (
                    <>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/partner_associate/create-brand', { state: { editBrand: brand } });
                        }}
                        className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-200 rounded-lg"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteBrand(e, brand.id, brand.brand_name)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <h3 className={`text-lg font-bold text-slate-800 uppercase mb-2 line-clamp-2 leading-tight transition-colors ${activeTab === 'REEL' ? 'group-hover:text-violet-600' : 'group-hover:text-cyan-600'}`}>{brand.brand_name}</h3>
              
              <div className="space-y-2 mb-1">
                {brand.campaign_objective && (
                  <div>
                    <span className="text-[9px] font-black text-slate-400 tracking-widest block mb-0.5">Objective</span>
                    <p className="text-xs font-bold text-slate-500 line-clamp-2 leading-snug">{brand.campaign_objective}</p>
                  </div>
                )}
              </div>

              <div className="mt-2">
                <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border border-black ${activeTab === 'REEL' ? 'bg-violet-50 text-violet-600' : 'bg-cyan-50 text-cyan-600'}`}>
                        <Users className="w-3 h-3" />
                        <span className="text-[10px] font-bold tracking-tight">
                            {
                                new Set(
                                    allInfluencers
                                        .filter(inf => {
                                            const infBrandClean = normalizeBrand(inf.brand_name);
                                            const bNameClean = normalizeBrand(brand.brand_name);
                                            return infBrandClean === bNameClean && bNameClean !== '';
                                        })
                                        .map(inf => `${inf.influencer_name}-${inf.influencer_email}`)
                                ).size
                            } Influencers
                        </span>


                    </div>
                    <div className="w-6 h-6 border border-black rounded-full flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
                        <ArrowLeft className="w-3 h-3 rotate-180" />
                    </div>
                </div>
              </div>
            </div>
            ))}
          </div>
          {!activeTab && !searchQuery && (
              <div className="flex flex-col items-center justify-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-4">Choose a Category</h3>
                  <div className="flex items-center gap-4">
                      <div className="h-[2px] w-12 bg-slate-100" />
                      <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.4em]">Select Reels or Stories above to begin</p>
                      <div className="h-[2px] w-12 bg-slate-100" />
                  </div>
              </div>
          )}
        </>
      )}


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
                            <span className="text-xs font-bold uppercase tracking-widest">{selectedInfluencer.brand_name || 'No Brand'}</span>
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
                        <span className="text-[9px] font-black text-slate-400 block">Brand Type</span>
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
                    Go To Brand Page
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
