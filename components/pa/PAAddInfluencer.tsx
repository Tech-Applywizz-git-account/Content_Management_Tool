import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { db, SYSTEM_BRANDS } from '../../services/supabaseDb';
import { ArrowLeft, UserPlus, Instagram, Mail, Target, Tag, DollarSign, MapPin, Briefcase, Building2, Trash2, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';

interface PAAddInfluencerProps {
  user: User;
}


const PAAddInfluencer: React.FC<PAAddInfluencerProps> = ({ user }) => {
  const navigate = useNavigate();
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpenBrandDropdown, setIsOpenBrandDropdown] = useState(false);
  const [influencerToDelete, setInfluencerToDelete] = useState<{ id: string, name: string } | null>(null);

  const [formData, setFormData] = useState({
    influencer_name: '',
    influencer_email: '',
    contact_details: '',
    instagram_profile: '',
    campaign_type: '',
    niche: '',
    commercials: '',
    location: '',
    budget: '',
    brand_name: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [influencerData, brandData] = await Promise.all([
        db.influencers.getAll(),
        db.brands.getAll()
      ]);
      setInfluencers(influencerData);
      const allBrands = [
        ...brandData.map(b => ({ ...b, isSystem: false })),
        ...SYSTEM_BRANDS
      ];
      // Force custom brands to the top, system brands to the bottom
      setBrands(allBrands.sort((a, b) => {
        if (a.isSystem && !b.isSystem) return 1;
        if (!a.isSystem && b.isSystem) return -1;
        return 0;
      }));
    } catch (err) {
      console.error("Failed to load data:", err);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.influencer_name.trim()) {
        toast.error('Influencer name is required');
        return;
    }

    setIsSubmitting(true);
    try {
      await db.influencers.create({
        ...formData,
        created_by_user_id: user.id
      });
      
      toast.success('Influencer added successfully!');
      setFormData({
        influencer_name: '',
        influencer_email: '',
        contact_details: '',
        instagram_profile: '',
        campaign_type: '',
        niche: '',
        commercials: '',
        location: '',
        budget: '',
        brand_name: ''
      });
      fetchData();
    } catch (error: any) {
      console.error('Error adding influencer:', error);
      toast.error(error.message || 'Failed to add influencer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInfluencer = (id: string, name: string) => {
    setInfluencerToDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!influencerToDelete) return;
    setIsSubmitting(true);
    try {
      await db.influencers.delete(influencerToDelete.id);
      setInfluencers(prev => prev.filter(i => i.id !== influencerToDelete.id));
      toast.success('Influencer removed');
      setInfluencerToDelete(null);
    } catch (error: any) {
      toast.error('Failed to remove influencer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in w-full max-w-7xl mx-auto py-6 px-4 font-sans">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 uppercase tracking-tighter mb-4">
          Add Influencer
        </h1>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-500">
              Onboard new influencers and associate them with client campaigns.
          </h2>
          <button 
            onClick={() => navigate('/partner_associate/brands')}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Brands
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Form */}
        <div className="lg:col-span-8 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 md:col-span-2">
                    <label className="block text-sm font-black text-slate-900 uppercase">Name *</label>
                    <input type="text" name="influencer_name" value={formData.influencer_name} onChange={handleChange} required className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="Influencer Name" />
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <Instagram className="w-4 h-4 text-pink-500" /> Instagram Profile
                    </label>
                    <input type="text" name="instagram_profile" value={formData.instagram_profile} onChange={handleChange} className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="@username" />
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-500" /> Email
                    </label>
                    <input type="email" name="influencer_email" value={formData.influencer_email} onChange={handleChange} className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="email@example.com" />
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-slate-600" /> Contact Details
                    </label>
                    <input type="text" name="contact_details" value={formData.contact_details} onChange={handleChange} className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="Phone / WhatsApp / Other" />
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <Target className="w-4 h-4 text-orange-500" /> Type of Campaign
                    </label>
                    <input type="text" name="campaign_type" value={formData.campaign_type} onChange={handleChange} className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="e.g., Reel, Post, Story" />
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <Tag className="w-4 h-4 text-purple-500" /> Niche
                    </label>
                    <input type="text" name="niche" value={formData.niche} onChange={handleChange} className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="e.g., Tech, Fashion, Travel" />
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-green-600" /> Commercials
                    </label>
                    <input type="text" name="commercials" value={formData.commercials} onChange={handleChange} className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="e.g., Paid, Barter" />
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-red-500" /> Location
                    </label>
                    <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="City, Country" />
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-500" /> Budget
                    </label>
                    <input type="text" name="budget" value={formData.budget} onChange={handleChange} className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="e.g., $500" />
                </div>


                <div className="space-y-3 relative">
                    <label className="block text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-600" /> Brand Name
                    </label>
                    
                    {/* Custom Dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsOpenBrandDropdown(!isOpenBrandDropdown)}
                            className="w-full px-4 py-4 border-2 border-black font-bold bg-white flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            <span className={formData.brand_name ? 'text-black' : 'text-slate-400'}>
                                {formData.brand_name || 'Select Brand'}
                            </span>
                            <ChevronDown className={`w-5 h-5 transition-transform ${isOpenBrandDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {isOpenBrandDropdown && (
                            <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] z-[50] max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                <div 
                                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer font-bold border-b-2 border-slate-100 uppercase text-xs text-slate-400"
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, brand_name: '' }));
                                        setIsOpenBrandDropdown(false);
                                    }}
                                >
                                    Clear Selection
                                </div>
                                {brands.map((b) => (
                                    <div
                                        key={b.id}
                                        onClick={() => {
                                            setFormData(prev => ({ ...prev, brand_name: b.brand_name }));
                                            setIsOpenBrandDropdown(false);
                                        }}
                                        className={`px-4 py-4 hover:bg-slate-50 cursor-pointer font-bold flex items-center justify-between transition-colors border-b-2 border-slate-50 last:border-0 ${
                                            formData.brand_name === b.brand_name ? 'bg-slate-50' : ''
                                        }`}
                                    >
                                        <span className="uppercase text-sm">{b.brand_name}</span>
                                        {formData.brand_name === b.brand_name && <Check className="w-4 h-4 text-green-600" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2 pt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full md:w-auto px-12 py-4 bg-[#D946EF] text-white border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving...' : 'Save Influencer'}
                    </button>
                </div>
            </form>
        </div>

        {/* Right Side: Influencer List */}
        <div className="lg:col-span-4 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col">
            <div className="p-6 border-b-2 border-slate-50 flex items-center gap-3 bg-slate-50">
                <UserPlus className="w-5 h-5 text-[#D946EF]" />
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                    Onboarded ({influencers.length})
                </h3>
            </div>
            
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin">
                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <div className="w-8 h-8 border-4 border-slate-100 border-t-[#D946EF] rounded-full animate-spin" />
                    </div>
                ) : influencers.map((inf: any) => (
                    <div key={inf.id} className="p-3 border-2 border-black bg-white group hover:bg-slate-50 transition-all">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-sm text-slate-900 truncate uppercase">{inf.influencer_name}</span>
                            <button onClick={() => handleDeleteInfluencer(inf.id, inf.influencer_name)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        {(inf.influencer_email || inf.contact_details) && (
                            <div className="text-[10px] font-bold text-slate-500 truncate mb-1">
                                {inf.influencer_email || inf.contact_details}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                            {inf.brand_name && <span className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 border border-black uppercase">{inf.brand_name}</span>}
                            {inf.niche && <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 border border-blue-200 uppercase">{inf.niche}</span>}
                            {inf.campaign_type && <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 border border-purple-200 uppercase">{inf.campaign_type}</span>}
                            {inf.location && <span className="text-[10px] font-bold bg-red-50 text-red-700 px-1.5 py-0.5 border border-red-200 uppercase">{inf.location}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {influencerToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-4 border-black p-8 max-w-md w-full shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-2xl font-black uppercase mb-4">Remove Influencer?</h3>
            <p className="font-bold text-slate-600 mb-8">Are you sure you want to remove {influencerToDelete.name}?</p>
            <div className="flex gap-4">
              <button onClick={() => setInfluencerToDelete(null)} className="flex-1 px-6 py-3 border-2 border-black font-black uppercase hover:bg-slate-50">Cancel</button>
              <button onClick={confirmDelete} disabled={isSubmitting} className="flex-1 px-6 py-3 bg-red-500 text-white border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px]">Remove</button>
            </div>
          </div>
        </div>
      )}
      <div className="h-64"></div>
    </div>
  );
};

export default PAAddInfluencer;
