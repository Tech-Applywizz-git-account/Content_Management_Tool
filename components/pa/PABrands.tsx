import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { db, SYSTEM_BRANDS } from '../../services/supabaseDb';
import { CheckCircle2, AlertCircle, Building2, Trash2, Plus, ArrowLeft, UserPlus, Users, Instagram, Mail, X, Shirt, Smartphone, Coffee, Clapperboard, Zap, ShoppingBag, Crown, Palette, Globe, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface PABrandsProps {
  user: User;
}


const PABrands: React.FC<PABrandsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [brandToDelete, setBrandToDelete] = useState<{ id: string, name: string } | null>(null);
  

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

  const handleBrandClick = (brand: any) => {
    navigate(`/partner_associate/brand-details/${encodeURIComponent(brand.brand_name)}`);
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
    const iconClass = "w-6 h-6 text-slate-900 group-hover:text-black transition-colors";
    
    if (n.includes('cloth') || n.includes('fashion') || n.includes('wear') || n.includes('style')) return <Shirt className={iconClass} />;
    if (n.includes('tech') || n.includes('gadget') || n.includes('phone') || n.includes('app')) return <Smartphone className={iconClass} />;
    if (n.includes('food') || n.includes('drink') || n.includes('cafe') || n.includes('eat')) return <Coffee className={iconClass} />;
    if (n.includes('video') || n.includes('media') || n.includes('film') || n.includes('studio')) return <Clapperboard className={iconClass} />;
    if (n.includes('energy') || n.includes('power') || n.includes('fast')) return <Zap className={iconClass} />;
    if (n.includes('store') || n.includes('shop') || n.includes('market') || n.includes('buy')) return <ShoppingBag className={iconClass} />;
    if (n.includes('premium') || n.includes('luxur') || n.includes('royal')) return <Crown className={iconClass} />;
    if (n.includes('art') || n.includes('design') || n.includes('creative')) return <Palette className={iconClass} />;
    if (n.includes('global') || n.includes('world') || n.includes('inter')) return <Globe className={iconClass} />;
    if (n.includes('win') || n.includes('sport') || n.includes('top')) return <Trophy className={iconClass} />;
    
    // Default fallback - rotate through a set of icons based on name length
    const icons = [
        <Building2 className={iconClass} />, 
        <Crown className={iconClass} />, 
        <Palette className={iconClass} />, 
        <Globe className={iconClass} />, 
        <Trophy className={iconClass} />
    ];
    return icons[name.length % icons.length];
  };

  return (
    <div className="animate-fade-in w-full max-w-7xl mx-auto py-8 px-4 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter mb-2">Brands Dashboard</h2>
          <p className="text-slate-600 font-bold text-lg">Browse and manage all registered partner brands.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => navigate('/partner_associate/create-brand')}
            className="flex items-center gap-2 px-6 py-4 bg-yellow-400 text-black border-4 border-black font-black uppercase shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Brand</span>
          </button>
          <button
            onClick={() => navigate('/partner_associate/add-influencer')}
            className="flex items-center gap-2 px-6 py-4 bg-[#D946EF] text-white border-4 border-black font-black uppercase shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <UserPlus className="w-5 h-5" />
            <span>Add Influencer</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 text-green-700 p-4 border-2 border-green-400 font-bold shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] flex items-center gap-3 mb-8">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          {successMessage}
        </div>
      )}

      {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-[#D946EF] rounded-full animate-spin mb-4" />
              <p className="text-slate-400 font-black uppercase tracking-widest">Loading Brands...</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {brands.map((brand: any) => (
            <div 
              key={brand.id} 
              onClick={() => handleBrandClick(brand)}
              className={`bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col h-full cursor-pointer group ${brand.isSystem ? 'bg-slate-50/50' : ''}`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] group-hover:bg-yellow-400 transition-colors">
                  {getBrandIcon(brand.brand_name)}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 border-2 border-black text-[10px] font-black uppercase ${brand.isSystem ? 'bg-[#0085FF] text-white' : 'bg-[#4ADE80] text-green-900'}`}>
                    {brand.isSystem ? 'System' : 'Active'}
                  </span>
                  {!brand.isSystem && (
                    <button 
                      onClick={(e) => handleDeleteBrand(e, brand.id, brand.brand_name)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors border-2 border-transparent hover:border-black"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 uppercase mb-4 line-clamp-2 leading-tight group-hover:text-[#D946EF] transition-colors">{brand.brand_name}</h3>
              
              <div className="space-y-4 mt-auto pt-6 border-t-2 border-slate-100">
                {brand.campaign_objective && (
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Objective</span>
                    <p className="text-sm font-bold text-slate-600 line-clamp-2">{brand.campaign_objective}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Users className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-tight">View Details</span>
                    </div>
                    <div className="w-6 h-6 border-2 border-black rounded-full flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
                        <ArrowLeft className="w-3 h-3 rotate-180" />
                    </div>
                </div>
              </div>
            </div>
          ))}
        </div>
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
    </div>
  );
};

export default PABrands;
