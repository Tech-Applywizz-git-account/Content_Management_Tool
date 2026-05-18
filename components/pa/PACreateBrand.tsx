import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User } from '../../types';
import { db, SYSTEM_BRANDS } from '../../services/supabaseDb';
import { ArrowLeft, Building2, Trash2, Plus, Video, DollarSign, Search, X, Check } from 'lucide-react';
import { toast } from 'sonner';

interface PACreateBrandProps {
  user: User;
}


const PACreateBrand: React.FC<PACreateBrandProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const editBrand = location.state?.editBrand;
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<{ id: string, name: string } | null>(null);

  const [formData, setFormData] = useState({
    brand_name: editBrand?.brand_name || '',
    campaign_objective: editBrand?.campaign_objective || '',
    target_audience: editBrand?.target_audience || '',
    brand_type: editBrand?.brand_type || 'REEL' as 'REEL' | 'STORY',
    revenue: editBrand?.revenue?.toString() || '',
    has_leads: editBrand?.has_leads || false,
    lead_sources: editBrand?.lead_sources || [] as string[]
  });

  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [sourceSearchTerm, setSourceSearchTerm] = useState('');
  const [isFetchingSources, setIsFetchingSources] = useState(false);

  const fetchBrands = async () => {
    setIsLoading(true);
    try {
      const data = await db.brands.getAll();
      setBrands([...SYSTEM_BRANDS, ...data]);
    } catch (err) {
      console.error("Failed to load brands:", err);
      setBrands(SYSTEM_BRANDS);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeadSources = async () => {
    setIsFetchingSources(true);
    try {
      const today = new Date();
      const rawUrl = import.meta.env.VITE_LEADS_API_URL || 'http://localhost:3000/api/leads';
      const urlObj = new URL(rawUrl);
      urlObj.searchParams.set('startDate', '2024-01-01');
      urlObj.searchParams.set('endDate', today.toISOString().split('T')[0]);
      urlObj.searchParams.set('limit', '20000');

      const response = await fetch(urlObj.toString());
      if (response.ok) {
        const result = await response.json();
        const rawLeads = result.data || (Array.isArray(result) ? result : []);
        const sources = Array.from(new Set(rawLeads.map((l: any) => l.source))).filter(Boolean).sort() as string[];
        setAvailableSources(sources);
      }
    } catch (err) {
      console.error('Failed to fetch lead sources:', err);
    } finally {
      setIsFetchingSources(false);
    }
  };

  useEffect(() => {
    fetchBrands();
    fetchLeadSources();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brand_name.trim()) {
        toast.error('Brand name is required');
        return;
    }

    setIsSubmitting(true);
    try {
      if (editBrand) {
        await db.brands.update(editBrand.id, {
          ...formData,
          brand_name: formData.brand_name.toUpperCase(),
          revenue: formData.revenue ? parseFloat(formData.revenue) : 0,
          has_leads: formData.has_leads,
          lead_sources: formData.lead_sources
        });
        toast.success('Brand updated successfully!');
      } else {
        await db.brands.create({
          ...formData,
          brand_name: formData.brand_name.toUpperCase(),
          revenue: formData.revenue ? parseFloat(formData.revenue) : 0,
          created_by_user_id: user.id,
          has_leads: formData.has_leads,
          lead_sources: formData.lead_sources
        });
        toast.success('Brand created successfully!');
      }
      
      setTimeout(() => {
        const typePath = formData.brand_type === 'REEL' ? 'reels' : 'stories';
        navigate(`/partner_associate/brands/${typePath}`);
      }, 1000);
    } catch (error: any) {
      console.error('Error saving brand:', error);
      toast.error(error.message || 'Failed to save brand.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBrand = (brandId: string, brandName: string) => {
    setBrandToDelete({ id: brandId, name: brandName });
  };

  const confirmDeleteBrand = async () => {
    if (!brandToDelete) return;
    setIsSubmitting(true);
    try {
      await db.brands.delete(brandToDelete.id);
      setBrands(prev => prev.filter(b => b.id !== brandToDelete.id));
      toast.success(`Brand "${brandToDelete.name}" deleted`);
      setBrandToDelete(null);
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      toast.error(error.message || 'Failed to delete brand');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in w-full max-w-7xl mx-auto py-6 px-4">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 uppercase tracking-tighter mb-4">
          {editBrand ? 'Edit Brand' : 'Create New Brand'}
        </h1>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-500">
              Register a new influencer brand to the system so creators can reference them in scripts.
          </h2>
          <button 
            onClick={() => {
              const typePath = formData.brand_type === 'REEL' ? 'reels' : 'stories';
              navigate(`/partner_associate/brands/${typePath}`);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Form */}
        <div className="lg:col-span-8 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8">
            <form onSubmit={handleBrandSubmit} className="space-y-8">
                <div className="space-y-4">
                    <label className="block text-sm font-black text-slate-900 tracking-wide">
                        Content Format <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, brand_type: 'REEL' }))}
                            className={`group py-3 px-6 border-2 border-black font-black uppercase transition-all flex items-center justify-center gap-3 ${
                                formData.brand_type === 'REEL' 
                                ? 'bg-[#8B5CF6] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' 
                                : 'bg-white text-slate-400 hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'
                            }`}
                        >
                            <Video className={`w-5 h-5 ${formData.brand_type === 'REEL' ? 'text-white' : 'text-slate-300 group-hover:text-[#8B5CF6]'}`} />
                            <span className="text-sm tracking-tight">Reel</span>
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, brand_type: 'STORY' }))}
                            className={`group py-3 px-6 border-2 border-black font-black uppercase transition-all flex items-center justify-center gap-3 ${
                                formData.brand_type === 'STORY' 
                                ? 'bg-[#F59E0B] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-y-[-2px]' 
                                : 'bg-white text-slate-400 hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px]'
                            }`}
                        >
                            <Building2 className={`w-5 h-5 ${formData.brand_type === 'STORY' ? 'text-white' : 'text-slate-300 group-hover:text-[#F59E0B]'}`} />
                            <span className="text-sm tracking-tight">Story</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    <label htmlFor="brand_name" className="block text-sm font-black text-slate-900 tracking-wide">
                        Brand Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="brand_name"
                        name="brand_name"
                        value={formData.brand_name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-4 bg-white border-2 border-black font-bold placeholder:text-slate-300 focus:outline-none transition-all"
                        placeholder="e.g., TechGrow Solutions"
                    />
                </div>

                <div className="space-y-3">
                    <label htmlFor="revenue" className="block text-sm font-black text-slate-900 tracking-wide">
                        Revenue (USD)
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <DollarSign className="w-5 h-5 text-slate-400" />
                        </div>
                        <input
                            type="number"
                            id="revenue"
                            name="revenue"
                            value={formData.revenue}
                            onChange={handleChange}
                            step="0.01"
                            min="0"
                            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-black font-bold placeholder:text-slate-300 focus:outline-none transition-all"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label htmlFor="campaign_objective" className="block text-sm font-black text-slate-900 tracking-wide">
                        Campaign Objective
                    </label>
                    <textarea
                        id="campaign_objective"
                        name="campaign_objective"
                        value={formData.campaign_objective}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-4 py-4 bg-white border-2 border-black font-bold placeholder:text-slate-300 focus:outline-none transition-all resize-none"
                        placeholder="What is the main goal of this brand's campaign?"
                    />
                </div>

                <div className="space-y-3">
                    <label htmlFor="target_audience" className="block text-sm font-black text-slate-900 tracking-wide">
                        Target Audience
                    </label>
                    <textarea
                        id="target_audience"
                        name="target_audience"
                        value={formData.target_audience}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-4 py-4 bg-white border-2 border-black font-bold placeholder:text-slate-300 focus:outline-none transition-all resize-none"
                        placeholder="Who are we trying to reach?"
                    />
                </div>

                <div className="space-y-3">
                    <label htmlFor="deliverables" className="block text-sm font-black text-slate-900 tracking-wide">
                        Deliverables
                    </label>
                    <textarea
                        id="deliverables"
                        name="deliverables"
                        value={formData.deliverables}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-4 py-4 bg-white border-2 border-black font-bold placeholder:text-slate-300 focus:outline-none transition-all resize-none"
                        placeholder="What specific content pieces are required?"
                    />
                </div>

                <div className="space-y-4">
                    <label className="block text-sm font-black text-slate-900 tracking-wide">
                        Track Leads?
                    </label>
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, has_leads: true }))}
                            className={`px-6 py-2 border-2 border-black font-black uppercase transition-all ${
                                formData.has_leads
                                ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(217,70,239,1)]'
                                : 'bg-white text-slate-400 hover:bg-slate-50 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                            }`}
                        >
                            Yes
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, has_leads: false, lead_sources: [] }))}
                            className={`px-6 py-2 border-2 border-black font-black uppercase transition-all ${
                                !formData.has_leads
                                ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(217,70,239,1)]'
                                : 'bg-white text-slate-400 hover:bg-slate-50 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                            }`}
                        >
                            No
                        </button>
                    </div>
                </div>

                {formData.has_leads && (
                    <div className="space-y-4 p-6 bg-purple-50 border-2 border-purple-200">
                        <div>
                            <label className="block text-sm font-black text-slate-900 tracking-wide mb-1">
                                Configure Lead Sources <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-slate-500 font-bold mb-3">
                                Select the API sources that should be attributed to this brand. You can select multiple.
                            </p>
                            
                            <div className="bg-white border-2 border-black p-4 space-y-4">
                                <div className="relative">
                                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search sources..."
                                        value={sourceSearchTerm}
                                        onChange={(e) => setSourceSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-2 border-slate-100 font-bold text-sm focus:border-purple-500 focus:outline-none transition-all rounded-xl"
                                    />
                                </div>
                                
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {isFetchingSources ? (
                                        <div className="text-center py-4 text-xs font-bold text-slate-400 uppercase">Loading Sources...</div>
                                    ) : availableSources.length === 0 ? (
                                        <div className="text-center py-4 text-xs font-bold text-slate-400 uppercase">No sources found</div>
                                    ) : (
                                        availableSources
                                            .filter(s => s.toLowerCase().includes(sourceSearchTerm.toLowerCase()))
                                            .map(source => {
                                                const isSelected = formData.lead_sources.includes(source);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={source}
                                                        onClick={() => {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                lead_sources: isSelected 
                                                                    ? prev.lead_sources.filter(s => s !== source)
                                                                    : [...prev.lead_sources, source]
                                                            }))
                                                        }}
                                                        className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                                                            isSelected 
                                                                ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm' 
                                                                : 'border-slate-100 bg-white hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <span className="text-sm font-bold truncate">{source}</span>
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                                                            isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'
                                                        }`}>
                                                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                    )}
                                </div>
                            </div>
                        </div>

                        {formData.lead_sources.length > 0 && (
                            <div className="pt-4 border-t-2 border-purple-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Selected Sources ({formData.lead_sources.length})</p>
                                <div className="flex flex-wrap gap-2">
                                    {formData.lead_sources.map(source => (
                                        <div key={source} className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg shadow-sm border border-black">
                                            <span className="text-xs font-bold">{source}</span>
                                            <button 
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, lead_sources: prev.lead_sources.filter(s => s !== source) }))}
                                                className="hover:text-red-400 transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}



                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-10 py-4 bg-[#D946EF] text-white border-2 border-black font-black uppercase text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50"
                >
                    {isSubmitting ? 'Saving...' : (editBrand ? 'Update Brand' : 'Save Brand')}
                </button>
            </form>
        </div>

        {/* Right Side: Compact List */}
        <div className="lg:col-span-4 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col">
            <div className="p-6 border-b-2 border-slate-50 flex items-center gap-3">
                <Building2 className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                    Available ({brands.length})
                </h3>
            </div>
            
            <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto scrollbar-thin">
                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <div className="w-8 h-8 border-4 border-slate-100 border-t-[#D946EF] rounded-full animate-spin" />
                    </div>
                ) : brands.map((brand: any) => (
                    <div key={brand.id} className="flex items-center justify-between p-3 border-2 border-black bg-white group">
                        <div className="flex-1 min-w-0 mr-2">
                            <span className="font-black text-sm text-slate-900 truncate block uppercase">
                                {brand.brand_name}
                            </span>
                            {brand.brand_type && (
                                <span className={`text-[8px] font-black px-1.5 py-0.5 border border-black inline-block mt-1 ${brand.brand_type === 'REEL' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {brand.brand_type}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-2 py-0.5 border-2 border-black text-[9px] font-black uppercase ${brand.isSystem ? 'bg-[#0085FF] text-white' : 'bg-[#4ADE80] text-green-900'}`}>
                                {brand.isSystem ? 'SYSTEM' : 'ACTIVE'}
                            </span>
                            {!brand.isSystem && (
                                <button 
                                    onClick={() => handleDeleteBrand(brand.id, brand.brand_name)}
                                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {brandToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-4 border-black p-8 max-w-md w-full shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">Confirm Delete</h3>
            <p className="font-bold text-slate-600 mb-8 leading-relaxed">
              Are you sure you want to delete <span className="text-black font-black underline decoration-red-500 decoration-2 italic">"{brandToDelete.name}"</span>?
            </p>
            <div className="flex gap-4">
              <button onClick={() => setBrandToDelete(null)} className="flex-1 px-6 py-3 border-2 border-black font-black uppercase hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={confirmDeleteBrand} disabled={isSubmitting} className="flex-1 px-6 py-3 bg-red-500 text-white border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] transition-all disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PACreateBrand;
