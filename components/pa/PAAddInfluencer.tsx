import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User } from '../../types';
import { db, SYSTEM_BRANDS } from '../../services/supabaseDb';
import { ArrowLeft, Instagram, Mail, Target, Tag, DollarSign, MapPin, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

interface PAAddInfluencerProps {
  user: User;
}


const PAAddInfluencer: React.FC<PAAddInfluencerProps> = ({ user }) => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const initialBrand = searchParams.get('brand');
  const initialTab = searchParams.get('tab');

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
    brand_name: '',
    payment: 'no',
    platform_type: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const brandData = await db.brands.getAll();
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

  useEffect(() => {
    if (initialBrand) {
      setFormData(prev => ({ ...prev, brand_name: initialBrand }));
    }
  }, [initialBrand]);

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

    if (!formData.instagram_profile.trim()) {
        toast.error('Instagram profile is required');
        return;
    }

    setIsSubmitting(true);
    try {
      // Determine brand_type from selection or tab
      const selectedBrand = brands.find(b => b.brand_name === formData.brand_name);
      const brand_type = initialTab || selectedBrand?.brand_type || 'REEL';

      await db.influencers.create({
        ...formData,
        brand_type,
        created_by_user_id: user.id
      });
      
      toast.success('Influencer added successfully!');
      setTimeout(() => {
        navigate(`/partner_associate/brand-details/${encodeURIComponent(formData.brand_name)}`);
      }, 500);
    } catch (error: any) {
      console.error('Detailed Error adding influencer:', error);
      const errorMessage = error.message || (typeof error === 'object' ? JSON.stringify(error) : 'Failed to add influencer');
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in w-full max-w-7xl mx-auto py-6 px-4 font-sans">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 uppercase tracking-tighter mb-4">
          Add Influencer {initialBrand ? `to ${initialBrand}` : ''}
        </h1>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-500">
              Onboard new influencers and associate them with campaign requirements.
          </h2>
          <button 
            onClick={() => navigate(initialBrand ? `/partner_associate/brand-details/${encodeURIComponent(initialBrand)}` : '/partner_associate/brands')}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto items-start">
        {/* Left Side: Form */}
        <div className="bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 md:col-span-2">
                    <label className="block text-sm font-black text-slate-900 uppercase">Associate Brand *</label>
                    <select 
                        name="brand_name" 
                        value={formData.brand_name} 
                        onChange={handleChange} 
                        required 
                        className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none bg-white"
                    >
                        <option value="">Select a Brand</option>
                        {brands.map(brand => (
                            <option key={brand.id || brand.brand_name} value={brand.brand_name}>
                                {brand.brand_name} {brand.brand_type ? `(${brand.brand_type})` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-3 md:col-span-2">
                    <label className="block text-sm font-black text-slate-900 uppercase">Name *</label>
                    <input type="text" name="influencer_name" value={formData.influencer_name} onChange={handleChange} required className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="Influencer Name" />
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                        <Instagram className="w-4 h-4 text-pink-500" /> Instagram Profile *
                    </label>
                    <input type="text" name="instagram_profile" value={formData.instagram_profile} onChange={handleChange} required className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" placeholder="@username" />
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



                {(brands.find(b => b.brand_name === formData.brand_name)?.brand_type === 'STORY' || initialTab === 'STORY') && (
                    <>
                        <div className="space-y-3">
                            <label className="block text-sm font-black text-slate-900 uppercase">Payment *</label>
                            <select 
                                name="payment" 
                                value={formData.payment} 
                                onChange={handleChange}
                                className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none bg-white"
                            >
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                            </select>
                        </div>

                        {formData.payment === 'yes' && (
                            <div className="space-y-3">
                                <label className="block text-sm font-black text-slate-900 uppercase">Type of Platform *</label>
                                <input 
                                    type="text" 
                                    name="platform_type" 
                                    value={formData.platform_type} 
                                    onChange={handleChange} 
                                    required={formData.payment === 'yes'}
                                    className="w-full px-4 py-3 border-2 border-black font-bold focus:outline-none" 
                                    placeholder="e.g., PayPal, Razorpay" 
                                />
                            </div>
                        )}
                    </>
                )}

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
      </div>
      <div className="h-64"></div>
    </div>
  );
};

export default PAAddInfluencer;
