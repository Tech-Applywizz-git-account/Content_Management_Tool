import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { ArrowLeft, Plus, Calendar, Link as LinkIcon, Trash2, CheckCircle2, DollarSign, CreditCard, ExternalLink, Loader2, Save, User as UserIcon, Sparkles } from 'lucide-react';
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
                product_received: influencer.product_received || 'no'
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
                product_received: editForm.product_received
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
                toast.success('Story removed successfully');
                fetchInfluencerData(); // Refresh list
            } catch (err) {
                console.error('Failed to delete story:', err);
                toast.error('Failed to remove story');
            }
        }
        const newStories = stories.filter((_, i) => i !== index);
        setStories(newStories);
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
                toast.success('Story updated successfully');
            } else {
                // Add new
                await (db as any).influencerStories.add({
                    influencer_id: actualInfluencerId,
                    story_date: story.story_date,
                    story_link: story.story_link,
                    story_caption: story.story_caption,
                    created_by_user_id: user.id
                });
                toast.success('Story saved successfully');
            }
            
            // Skip updating influencers table with missing columns for now
            // await db.influencers.update(actualInfluencerId, {
            //     is_posted: true,
            //     last_story_added_at: new Date().toISOString()
            // });

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

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col animate-fade-in pb-32 overflow-x-hidden">
            {/* Premium Header */}
            <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-10 sticky top-0 z-50">
                <div className="flex items-center gap-8">
                    <button 
                        onClick={onBack} 
                        className="group relative p-3 bg-white hover:bg-slate-50 border border-black rounded-xl shadow-sm hover:shadow-md transition-all"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                                {influencer?.influencer_name || influencerName}
                            </h1>
                            <div className="px-3 py-1 bg-pink-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg shadow-pink-100 border border-black">
                                <LinkIcon className="w-3 h-3" /> {stories.filter(s => !!s.story_link).length} STORIES
                            </div>
                            {influencer?.commercials === 'Barter' && (
                                <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border border-black shadow-sm flex items-center gap-1.5 ${influencer?.product_received === 'yes' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-black'}`}>
                                    <Sparkles className="w-3 h-3" /> {influencer?.product_received === 'yes' ? 'Product Received' : 'Product Pending'}
                                </div>
                            )}
                            <button 
                                onClick={() => setIsEditingInfluencer(true)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-900"
                                title="Edit Details"
                            >
                                <Save className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {isEditingInfluencer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white border-4 border-black w-full max-w-lg rounded-[2.5rem] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden animate-scale-in">
                        <div className="p-8 border-b-4 border-black bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white border-2 border-black rounded-xl flex items-center justify-center shadow-sm">
                                    <UserIcon className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Edit Influencer</h3>
                            </div>
                            <button onClick={() => setIsEditingInfluencer(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-all"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Influencer Name</label>
                                    <input 
                                        type="text" 
                                        value={editForm.influencer_name}
                                        onChange={(e) => setEditForm({...editForm, influencer_name: e.target.value})}
                                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Instagram Profile</label>
                                    <input 
                                        type="text" 
                                        value={editForm.instagram_profile}
                                        onChange={(e) => setEditForm({...editForm, instagram_profile: e.target.value})}
                                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Collab Type</label>
                                    <select 
                                        value={editForm.commercials}
                                        onChange={(e) => setEditForm({...editForm, commercials: e.target.value})}
                                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm focus:border-indigo-500 outline-none"
                                    >
                                        <option value="Paid">Paid</option>
                                        <option value="Barter">Barter</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Budget</label>
                                    <input 
                                        type="text" 
                                        value={editForm.budget}
                                        onChange={(e) => setEditForm({...editForm, budget: e.target.value})}
                                        className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            {editForm.commercials === 'Barter' && (
                                <div className="p-6 bg-amber-50 border-4 border-black rounded-3xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white border-2 border-black rounded-xl flex items-center justify-center">
                                                <Sparkles className="w-5 h-5 text-amber-500" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Barter Logistics</p>
                                                <p className="text-sm font-black text-slate-900 uppercase">Product Received?</p>
                                            </div>
                                        </div>
                                        <div className="flex bg-white border-2 border-black rounded-xl p-1">
                                            <button 
                                                onClick={() => setEditForm({...editForm, product_received: 'yes'})}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${editForm.product_received === 'yes' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Yes
                                            </button>
                                            <button 
                                                onClick={() => setEditForm({...editForm, product_received: 'no'})}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${editForm.product_received === 'no' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
                                className="w-full py-5 bg-slate-900 text-white font-black uppercase text-xs rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-3 mt-4"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Influencer Profile</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto w-full p-6 space-y-6">
                {/* Visual KPI Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Stories Count */}
                    <div className="group p-5 bg-white border-4 border-black rounded-2xl hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
                        <div className="relative z-10 space-y-2">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                <LinkIcon className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Live Stories Posted</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900 tracking-tighter">
                                        {stories.filter(s => !!s.story_link).length}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Stories</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Total Budget */}
                    <div className="group p-5 bg-white border-4 border-black rounded-2xl hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
                        <div className="relative z-10 space-y-2">
                            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Budget</p>
                                    <span className="text-3xl font-black text-slate-900 tracking-tighter">
                                        {totalAmount.toLocaleString()}
                                    </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Hub */}
                    <div className="group p-5 bg-white border-4 border-black rounded-2xl hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
                        <div className="relative z-10 space-y-2">
                            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                                <CreditCard className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Payout Status</p>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-3xl font-black uppercase tracking-tight ${influencer?.payment === 'yes' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            {influencer?.payment === 'yes' ? 'Cleared' : 'Pending'}
                                        </span>
                                        {influencer?.payment === 'yes' && (
                                            <div className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold rounded-lg uppercase tracking-widest">
                                                Verified
                                            </div>
                                        )}
                                    </div>
                                    {influencer?.payment === 'yes' && influencer?.platform_type && (
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            Via <span className="text-slate-900 font-bold">{influencer.platform_type}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Management Hub */}
                <div className="bg-white border-4 border-black rounded-[2.5rem] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="p-6 border-b-4 border-black bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-white border border-black shadow-sm rounded-2xl flex items-center justify-center">
                                <Sparkles className="w-7 h-7 text-[#D946EF]" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Content Inventory</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Live Story Link Registry</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleAddStory} 
                            className="px-8 py-3.5 bg-slate-900 text-white border border-black rounded-2xl font-black uppercase text-xs shadow-lg shadow-slate-200 hover:bg-black hover:scale-105 active:scale-95 transition-all flex items-center gap-3 group/btn"
                        >
                            <div className="w-6 h-6 bg-[#D946EF] rounded-lg flex items-center justify-center group-hover/btn:rotate-90 transition-transform">
                                <Plus className="w-4 h-4 text-white" />
                            </div>
                            Add New Story
                        </button>
                    </div>

                    <div className="p-6 space-y-4 bg-white">
                        {stories.length === 0 ? (
                            <div className="py-16 text-center space-y-4">
                                <div className="w-24 h-24 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center mx-auto animate-pulse">
                                    <LinkIcon className="w-10 h-10 text-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-2xl font-black uppercase text-slate-300">Inventory Empty</p>
                                    <p className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">Deploy your first story link to start tracking</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {stories.slice().reverse().map((story, reversedIndex) => {
                                    const originalIndex = (stories.length - 1) - reversedIndex;
                                    const chronologicalIndex = originalIndex + 1;
                                    return (
                                        <div 
                                            key={story.id || originalIndex} 
                                            className="group p-4 bg-white border border-black rounded-2xl relative hover:shadow-lg hover:bg-slate-50 transition-all"
                                        >
                                            <div className="absolute -top-3 left-6 px-4 py-1 bg-[#D946EF] text-white font-bold text-[10px] uppercase tracking-widest rounded-full shadow-lg shadow-pink-200">
                                                Story-{chronologicalIndex}
                                            </div>
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-1">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase text-slate-400 pl-2 flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-[#D946EF]" /> Story Date
                                                </label>
                                                <input 
                                                    type="date" 
                                                    value={story.story_date}
                                                    onChange={(e) => handleStoryChange(originalIndex, 'story_date', e.target.value)}
                                                    className="w-full bg-slate-50 border border-black p-3 rounded-xl font-bold text-sm focus:bg-white outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase text-slate-400 pl-2 flex items-center gap-2">
                                                    <LinkIcon className="w-4 h-4 text-blue-500" /> Story Link
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        type="url" 
                                                        value={story.story_link}
                                                        onChange={(e) => handleStoryChange(originalIndex, 'story_link', e.target.value)}
                                                        placeholder="https://instagram.com/stories/..."
                                                        className="w-full bg-slate-50 border border-black p-3 pr-16 rounded-xl font-bold text-sm outline-none transition-all"
                                                    />
                                                        {story.story_link && (
                                                            <a 
                                                                href={story.story_link} 
                                                                target="_blank" 
                                                                rel="noreferrer" 
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 text-slate-400 hover:text-black transition-all flex items-center justify-center"
                                                                title="Open Link"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </a>
                                                        )}
                                                </div>
                                            </div>
                                            <div className="space-y-3 lg:col-span-2">
                                                <label className="text-[11px] font-black uppercase text-slate-400 pl-2 flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4 text-yellow-500" /> Story Caption
                                                </label>
                                                <textarea 
                                                    value={story.story_caption || ''}
                                                    onChange={(e) => handleStoryChange(originalIndex, 'story_caption', e.target.value)}
                                                    placeholder="Enter story caption here..."
                                                    className="w-full bg-slate-50 border border-black p-3 rounded-xl font-bold text-sm focus:bg-white outline-none transition-all resize-none h-16"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 mt-4">
                                            <button 
                                                onClick={() => handleRemoveStory(originalIndex)} 
                                                className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 border border-black rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                title="Remove Story"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleSaveSingle(originalIndex)} 
                                                className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 border border-black rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                title={story.id ? 'Update Story' : 'Save Story'}
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                        </div>
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


