import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { db, SYSTEM_BRANDS } from '../../services/supabaseDb';
import { ArrowLeft, Building2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface PACreateBrandProps {
  user: User;
}


const PACreateBrand: React.FC<PACreateBrandProps> = ({ user }) => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<{ id: string, name: string } | null>(null);

  const [formData, setFormData] = useState({
    brand_name: '',
    campaign_objective: '',
    target_audience: '',
    deliverables: ''
  });

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

  useEffect(() => {
    fetchBrands();
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
      await db.brands.create({
        ...formData,
        brand_name: formData.brand_name.toUpperCase(),
        created_by_user_id: user.id
      });
      
      toast.success('Brand created successfully!');
      setFormData({
        brand_name: '',
        campaign_objective: '',
        target_audience: '',
        deliverables: ''
      });
      fetchBrands();
    } catch (error: any) {
      console.error('Error creating brand:', error);
      toast.error(error.message || 'Failed to create brand.');
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
          Create New Brand
        </h1>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-500">
              Register a new client brand to the system so creators can reference them in scripts.
          </h2>
          <button 
            onClick={() => navigate('/partner_associate/brands')}
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
                <div className="space-y-3">
                    <label htmlFor="brand_name" className="block text-sm font-black text-slate-900 uppercase tracking-wide">
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
                    <label htmlFor="campaign_objective" className="block text-sm font-black text-slate-900 uppercase tracking-wide">
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
                    <label htmlFor="target_audience" className="block text-sm font-black text-slate-900 uppercase tracking-wide">
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
                    <label htmlFor="deliverables" className="block text-sm font-black text-slate-900 uppercase tracking-wide">
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

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-10 py-4 bg-[#D946EF] text-white border-2 border-black font-black uppercase text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50"
                >
                    {isSubmitting ? 'Saving...' : 'Save Brand'}
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
                        <span className="font-black text-sm text-slate-900 truncate flex-1 uppercase">
                            {brand.brand_name}
                        </span>
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
