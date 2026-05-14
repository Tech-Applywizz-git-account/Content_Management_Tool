import React, { useState, useEffect } from 'react';
import { User, Role } from '../../types';
import { ArrowLeft, Plus, Calendar, Link as LinkIcon, Trash2, CheckCircle2, DollarSign, CreditCard, ExternalLink, Loader2, Save, User as UserIcon, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';

interface Story {
    id?: string;
    story_date: string;
    story_link: string;
    story_caption?: string;
}

interface Props {
    influencerId: string;
    brandName: string;
    influencerName?: string;
    user: User;
    onBack: () => void;
    onComplete: () => void;
    initialInfluencer?: any;
}

const PAStoryInfluencerDetails: React.FC<Props> = ({ influencerId, brandName, influencerName, user, onBack, onComplete, initialInfluencer }) => {
    const [influencer, setInfluencer] = useState<any>(initialInfluencer || null);
    const [stories, setStories] = useState<Story[]>(initialInfluencer?.stories || []);
    const [loading, setLoading] = useState(!initialInfluencer);
    const [saving, setSaving] = useState(false);
    const [actualInfluencerId, setActualInfluencerId] = useState<string | null>(initialInfluencer?.id || null);
    const [isEditingInfluencer, setIsEditingInfluencer] = useState(false);
    const [editForm, setEditForm] = useState<any>({});

    useEffect(() => {
        if (influencer) {
            setEditForm({
                influencer_name: influencer.influencer_name,
                instagram_profile: influencer.instagram_profile,
                budget: influencer.budget,
                raw_video: influencer.raw_video || '',
                edited_video: influencer.edited_video || '',
                proof_link: influencer.proof_link || '',
                commercials: influencer.commercials || 'Paid',
                product_received: influencer.product_received || 'no',
                payment: influencer.payment || 'no',
                platform_type: influencer.platform_type || '',
                payment_date: influencer.payment_date || ''
            });
        }
    }, [influencer]);

    const handleUpdateInfluencer = async () => {
        if (!actualInfluencerId) return;
        try {
            setSaving(true);
            const updates = {
                influencer_name: editForm.influencer_name,
                instagram_profile: editForm.instagram_profile,
                budget: editForm.budget,
                commercials: editForm.commercials,
                product_received: editForm.product_received,
                payment: editForm.payment,
                platform_type: editForm.platform_type,
                payment_date: editForm.payment_date
            };
            await db.influencers.update(actualInfluencerId, updates);
            toast.success('Influencer details updated');
            setIsEditingInfluencer(false);
            fetchInfluencerData();
        } catch (error) {
            console.error('Error updating influencer:', error);
            toast.error('Failed to update details');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        fetchInfluencerData();
    }, [influencerId, influencerName]);

    const fetchInfluencerData = async () => {
        try {
            setLoading(true);
            let data: any = null;

            // 1. Try to fetch by ID first (most reliable)
            if (influencerId && influencerId.length > 30 && !influencerId.startsWith('temp-')) {
                console.log('🔍 Fetching influencer by ID:', influencerId);
                const res = await supabase.from('influencers').select('*').eq('id', influencerId).single();
                data = res.data;
            } 
            
            // 2. If no data yet, try to fetch by Name + Brand (very reliable for STORY brands)
            if (!data && (influencerName || influencerId)) {
                const nameToSearch = influencerName || influencerId;
                console.log('🔍 Fetching influencer by Name and Brand:', nameToSearch, brandName);
                const { data: searchResults, error: searchError } = await supabase
                    .from('influencers')
                    .select('*')
                    .ilike('influencer_name', nameToSearch)
                    .eq('brand_name', brandName);
                
                if (searchResults && searchResults.length > 0) {
                    data = searchResults[0];
                }
            }

            if (data) {
                console.log('✅ Successfully fetched Influencer Data:', data);
                setInfluencer(data);
                setActualInfluencerId(data.id);
                // Fetch stories from separate table
                const storyData = await db.influencerStories.getByInfluencer(data.id);
                setStories(storyData || []);
            } else {
                console.warn('⚠️ No influencer record found for:', influencerId, influencerName);
            }
        } catch (error: any) {
            console.error('Error in fetchInfluencerData:', error);
            toast.error('Failed to load influencer details');
        } finally {
            setLoading(false);
        }
    };

    const handleAddStory = () => {
        setStories([...stories, { story_date: new Date().toISOString().split('T')[0], story_link: '', story_caption: '' }]);
        toast.info('New story instance added');
    };

    const handleRemoveStory = async (index: number) => {
        const storyToRemove = stories[index];
        if (storyToRemove.id) {
            try {
                await db.influencerStories.delete(storyToRemove.id);
                toast.success('story deleted');
                fetchInfluencerData(); // Refresh list
            } catch (err) {
                console.error('Failed to delete story:', err);
                toast.error('Failed to remove story');
            }
        } else {
            const newStories = stories.filter((_, i) => i !== index);
            setStories(newStories);
        }
    };

    const handleStoryChange = (index: number, field: keyof Story, value: string) => {
        const newStories = [...stories];
        newStories[index] = { ...newStories[index], [field]: value };
        setStories(newStories);
    };

    const handleSaveSingle = async (index: number) => {
        const story = stories[index];
        if (!actualInfluencerId) {
            toast.error("Influencer record not found.");
            return;
        }
        if (!story.story_link) {
            toast.error("Please provide a story link first.");
            return;
        }

        try {
            setSaving(true);
            if (story.id) {
                // Update existing
                await (db as any).influencerStories.update(story.id, {
                    story_date: story.story_date,
                    story_link: story.story_link,
                    story_caption: story.story_caption
                });
                toast.success('saves updated');
            } else {
                // Add new
                await (db as any).influencerStories.add({
                    influencer_id: actualInfluencerId,
                    story_date: story.story_date,
                    story_link: story.story_link,
                    story_caption: story.story_caption,
                    created_by_user_id: user.id
                });
                toast.success('story added');
            }
            
            fetchInfluencerData(); // Refresh to get IDs
        } catch (error: any) {
            console.error('Error saving story:', error);
            toast.error('Failed to save story');
        } finally {
            setSaving(false);
        }
    };

    // Improved Budget Parsing
    const rawBudget = influencer?.budget || '0';
    const totalAmount = parseFloat(rawBudget.toString().replace(/[^0-9.]/g, '')) || 0;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#D946EF] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col animate-fade-in pb-16 overflow-x-hidden">
            {/* Premium Header - Reduced Height */}
            <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={onBack} 
                        className="group relative p-2 bg-white hover:bg-slate-50 border border-black rounded-lg shadow-sm hover:shadow-md transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-slate-900 uppercase tracking-tighter leading-none">
                                {influencer?.influencer_name || influencerName}
                            </h1>
                            <div className="px-1.5 py-0.5 bg-pink-500 text-white text-[8px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1 shadow-md shadow-pink-100 border border-black">
                                <LinkIcon className="w-2.5 h-2.5" /> {stories.filter(s => !!s.story_link).length} STORIES
                            </div>
                            {influencer?.commercials === 'Barter' && (
                                <div className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-full border border-black shadow-sm flex items-center gap-1 ${influencer?.product_received === 'yes' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-black'}`}>
                                    <Sparkles className="w-2.5 h-2.5" /> {influencer?.product_received === 'yes' ? 'Received' : 'Pending'}
                                </div>
                            )}
                            {user.role !== Role.CMO && (
                                <button 
                                    onClick={() => setIsEditingInfluencer(true)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-900"
                                    title="Edit Details"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Modal - Reduced Padding */}
            {isEditingInfluencer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white border-2 border-black w-full max-w-lg rounded-[1.5rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden animate-scale-in">
                        <div className="p-5 border-b-2 border-black bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white border border-black rounded-lg flex items-center justify-center shadow-sm">
                                    <UserIcon className="w-5 h-5 text-indigo-600" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Edit Influencer</h3>
                            </div>
                            <button onClick={() => setIsEditingInfluencer(false)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-all"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-2">Influencer Name</label>
                                    <input 
                                        type="text" 
                                        value={editForm.influencer_name}
                                        onChange={(e) => setEditForm({...editForm, influencer_name: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-xs focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-2">Instagram Profile</label>
                                    <input 
                                        type="text" 
                                        value={editForm.instagram_profile}
                                        onChange={(e) => setEditForm({...editForm, instagram_profile: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-xs focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-2">Collab Type</label>
                                    <select 
                                        value={editForm.commercials}
                                        onChange={(e) => setEditForm({...editForm, commercials: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-xs focus:border-indigo-500 outline-none"
                                    >
                                        <option value="Paid">Paid</option>
                                        <option value="Barter">Barter</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-2">Budget</label>
                                    <input 
                                        type="text" 
                                        value={editForm.budget}
                                        onChange={(e) => setEditForm({...editForm, budget: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-xs focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-2">Payment Status</label>
                                    <select 
                                        value={editForm.payment}
                                        onChange={(e) => setEditForm({...editForm, payment: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-xs focus:border-indigo-500 outline-none"
                                    >
                                        <option value="no">Pending</option>
                                        <option value="yes">Cleared</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-2">Platform</label>
                                    <input 
                                        type="text" 
                                        value={editForm.platform_type}
                                        onChange={(e) => setEditForm({...editForm, platform_type: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-xs focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-2">Payment Date</label>
                                <input 
                                    type="date" 
                                    value={editForm.payment_date}
                                    onChange={(e) => setEditForm({...editForm, payment_date: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-xs focus:border-indigo-500 outline-none"
                                />
                            </div>

                            {editForm.commercials === 'Barter' && (
                                <div className="p-4 bg-amber-50 border-2 border-black rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-white border border-black rounded-lg flex items-center justify-center">
                                                <Sparkles className="w-4 h-4 text-amber-500" />
                                            </div>
                                            <div>
                                                <p className="text-[7px] font-black uppercase text-slate-400 tracking-widest">Logistics</p>
                                                <p className="text-[10px] font-black text-slate-900 uppercase">Received?</p>
                                            </div>
                                        </div>
                                        <div className="flex bg-white border border-black rounded-lg p-0.5">
                                            <button 
                                                onClick={() => setEditForm({...editForm, product_received: 'yes'})}
                                                className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${editForm.product_received === 'yes' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
                                            >
                                                Yes
                                            </button>
                                            <button 
                                                onClick={() => setEditForm({...editForm, product_received: 'no'})}
                                                className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${editForm.product_received === 'no' ? 'bg-red-500 text-white' : 'text-slate-400'}`}
                                            >
                                                No
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={handleUpdateInfluencer}
                                disabled={saving}
                                className="w-full py-4 bg-slate-900 text-white font-black uppercase text-[10px] rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center gap-2 mt-2"
                            >
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Save Profile</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
                {/* Visual KPI Section - Tightened */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Stories Count */}
                    <div className="group p-3 bg-white border-2 border-black rounded-xl hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-0.5px] transition-all relative overflow-hidden">
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                <LinkIcon className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Live Stories</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-slate-900 tracking-tighter">
                                        {stories.filter(s => !!s.story_link).length}
                                    </span>
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Posted</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Total Budget */}
                    <div className="group p-3 bg-white border-2 border-black rounded-xl hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-0.5px] transition-all relative overflow-hidden">
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                <DollarSign className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Budget</p>
                                <span className="text-xl font-black text-slate-900 tracking-tighter">
                                    {totalAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Hub */}
                    <div className="group p-3 bg-white border-2 border-black rounded-xl hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-0.5px] transition-all relative overflow-hidden">
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                <CreditCard className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status</p>
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <span className={`text-xl font-black uppercase tracking-tight truncate ${influencer?.payment === 'yes' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                        {influencer?.payment === 'yes' ? 'Cleared' : 'Pending'}
                                    </span>
                                    {influencer?.payment === 'yes' && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Management Hub - Compact Header */}
                <div className="bg-white border-2 border-black rounded-[1.5rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="p-4 border-b-2 border-black bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white border border-black shadow-sm rounded-xl flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-[#D946EF]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">Inventory</h3>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Story Registry</p>
                            </div>
                        </div>
                        {user.role !== Role.CMO && (
                            <button 
                                onClick={handleAddStory} 
                                className="px-5 py-2 bg-slate-900 text-white border border-black rounded-xl font-black uppercase text-[9px] shadow-md hover:bg-black hover:scale-102 active:scale-98 transition-all flex items-center gap-2 group/btn"
                            >
                                <div className="w-5 h-5 bg-[#D946EF] rounded-md flex items-center justify-center group-hover/btn:rotate-90 transition-transform">
                                    <Plus className="w-3 h-3 text-white" />
                                </div>
                                Add Story
                            </button>
                        )}
                    </div>

                    <div className="p-4 space-y-3 bg-white">
                        {stories.length === 0 ? (
                            <div className="py-10 text-center space-y-3">
                                <div className="w-16 h-16 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
                                    <LinkIcon className="w-6 h-6 text-slate-200" />
                                </div>
                                <p className="text-[10px] font-black uppercase text-slate-300">Inventory Empty</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {stories.slice().reverse().map((story, reversedIndex) => {
                                    const originalIndex = (stories.length - 1) - reversedIndex;
                                    const chronologicalIndex = originalIndex + 1;
                                    return (
                                        <div 
                                            key={story.id || originalIndex} 
                                            className="group p-3 bg-white border border-black rounded-xl relative hover:shadow-md transition-all"
                                        >
                                            <div className="absolute -top-2 left-4 px-2 py-0.5 bg-[#D946EF] text-white font-bold text-[7px] uppercase tracking-widest rounded-full shadow-md shadow-pink-200">
                                                Story-{chronologicalIndex}
                                            </div>
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-1">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 pl-1 flex items-center gap-1.5">
                                                    <Calendar className="w-3 h-3 text-[#D946EF]" /> Date
                                                </label>
                                                <input 
                                                    type="date" 
                                                    value={story.story_date}
                                                    onChange={(e) => handleStoryChange(originalIndex, 'story_date', e.target.value)}
                                                    disabled={user.role === Role.CMO}
                                                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg font-bold text-[11px] focus:bg-white outline-none transition-all disabled:opacity-75"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 pl-1 flex items-center gap-1.5">
                                                    <LinkIcon className="w-3 h-3 text-blue-500" /> Link
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        type="url" 
                                                        value={story.story_link}
                                                        onChange={(e) => handleStoryChange(originalIndex, 'story_link', e.target.value)}
                                                        disabled={user.role === Role.CMO}
                                                        placeholder="Paste Instagram link..."
                                                        className="w-full bg-slate-50 border border-slate-200 p-2 pr-10 rounded-lg font-bold text-[11px] outline-none transition-all disabled:opacity-75"
                                                    />
                                                        {story.story_link && (
                                                            <a 
                                                                href={story.story_link} 
                                                                target="_blank" 
                                                                rel="noreferrer" 
                                                                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 hover:text-black transition-all flex items-center justify-center"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                </div>
                                            </div>
                                            <div className="space-y-1 lg:col-span-2">
                                                <label className="text-[9px] font-black uppercase text-slate-400 pl-1 flex items-center gap-1.5">
                                                    <Sparkles className="w-3 h-3 text-yellow-500" /> Caption
                                                </label>
                                                <textarea 
                                                    value={story.story_caption || ''}
                                                    onChange={(e) => handleStoryChange(originalIndex, 'story_caption', e.target.value)}
                                                    disabled={user.role === Role.CMO}
                                                    placeholder="Enter story caption..."
                                                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg font-bold text-[11px] focus:bg-white outline-none transition-all resize-none h-12 disabled:opacity-75"
                                                />
                                            </div>
                                        </div>

                                        {user.role !== Role.CMO && (
                                            <div className="flex justify-end gap-1.5 mt-3">
                                                <button 
                                                    onClick={() => handleRemoveStory(originalIndex)} 
                                                    className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 border border-slate-200 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleSaveSingle(originalIndex)} 
                                                    className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 border border-slate-200 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"
                                                >
                                                    <Save className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PAStoryInfluencerDetails;
