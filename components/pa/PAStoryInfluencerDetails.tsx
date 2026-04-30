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
}

interface Props {
    influencerId: string;
    brandName: string;
    influencerName?: string;
    user: User;
    onBack: () => void;
    onComplete: () => void;
}

const PAStoryInfluencerDetails: React.FC<Props> = ({ influencerId, brandName, influencerName, user, onBack, onComplete }) => {
    const [influencer, setInfluencer] = useState<any>(null);
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actualInfluencerId, setActualInfluencerId] = useState<string | null>(null);

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
        setStories([...stories, { story_date: new Date().toISOString().split('T')[0], story_link: '' }]);
    };

    const handleRemoveStory = async (index: number) => {
        const storyToRemove = stories[index];
        if (storyToRemove.id) {
            try {
                await db.influencerStories.delete(storyToRemove.id);
            } catch (err) {
                console.error('Failed to delete story:', err);
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
            await db.influencerStories.add({
                influencer_id: actualInfluencerId,
                story_date: story.story_date,
                story_link: story.story_link,
                created_by_user_id: user.id
            });
            
            // Update influencer posting status
            await db.influencers.update(actualInfluencerId, {
                is_posted: true
            });

            toast.success('Story saved successfully');
            fetchInfluencerData(); // Refresh to get IDs
        } catch (error: any) {
            console.error('Error saving story:', error);
            toast.error('Failed to save story');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!actualInfluencerId) {
            toast.error("Influencer record not found. Please add the influencer first.");
            return;
        }

        try {
            setSaving(true);
            
            // Save each story that doesn't have an ID
            const savePromises = stories.map(async (story) => {
                if (!story.id && story.story_link) {
                    return db.influencerStories.add({
                        influencer_id: actualInfluencerId,
                        story_date: story.story_date,
                        story_link: story.story_link,
                        created_by_user_id: user.id
                    });
                }
                return null;
            });

            await Promise.all(savePromises);
            
            // Update influencer posting status if needed
            await db.influencers.update(actualInfluencerId, {
                is_posted: stories.length > 0
            });

            toast.success('Stories updated successfully');
            fetchInfluencerData(); // Refresh to get IDs
        } catch (error: any) {
            console.error('Error saving stories:', error);
            toast.error('Failed to save stories');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-slate-100 border-t-[#D946EF] rounded-full animate-spin"></div>
                        <Sparkles className="w-6 h-6 text-[#D946EF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="font-black uppercase text-slate-400 tracking-widest text-[10px]">Polishing Dashboard...</p>
                </div>
            </div>
        );
    }

    // Improved Budget Parsing
    const rawBudget = influencer?.budget || '0';
    const totalAmount = parseFloat(rawBudget.toString().replace(/[^0-9.]/g, '')) || 0;

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col animate-fade-in pb-32 overflow-x-hidden">
            {/* Premium Header */}
            <header className="h-24 bg-white/80 backdrop-blur-md border-b-4 border-black flex items-center justify-between px-10 sticky top-0 z-50">
                <div className="flex items-center gap-8">
                    <button 
                        onClick={onBack} 
                        className="group relative p-4 bg-yellow-400 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-none transition-all"
                    >
                        <ArrowLeft className="w-6 h-6 text-black group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                                {influencer?.influencer_name || influencerName}
                            </h1>
                            <div className="px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                                LIVE CAMPAIGN
                            </div>
                        </div>
                        <p className="text-xs font-bold text-[#D946EF] uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                            <Sparkles className="w-3 h-3" /> {brandName} Partnership Hub
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleSave} 
                        disabled={saving} 
                        className="px-10 py-4 bg-black text-white border-4 border-black font-black uppercase text-sm shadow-[6px_6px_0px_0px_rgba(217,70,239,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(217,70,239,1)] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Save Live Stories
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto w-full p-10 space-y-12">
                {/* Visual KPI Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Stories Count */}
                    <div className="group p-8 bg-white border-4 border-black rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
                        <div className="relative z-10 space-y-4">
                            <div className="w-14 h-14 bg-blue-600 border-2 border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <LinkIcon className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Live Stories Posted</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-6xl font-black text-slate-900 tracking-tighter">
                                        {stories.filter(s => !!s.story_link).length}
                                    </span>
                                    <span className="text-lg font-black text-slate-300 uppercase">Stories</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Total Budget */}
                    <div className="group p-8 bg-white border-4 border-black rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
                        <div className="relative z-10 space-y-4">
                            <div className="w-14 h-14 bg-emerald-500 border-2 border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <DollarSign className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Commercials</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-emerald-600">₹</span>
                                    <span className="text-6xl font-black text-slate-900 tracking-tighter">
                                        {totalAmount.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Hub */}
                    <div className="group p-8 bg-white border-4 border-black rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
                        <div className="relative z-10 space-y-4">
                            <div className="w-14 h-14 bg-purple-600 border-2 border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <CreditCard className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Payout Status</p>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-4xl font-black uppercase tracking-tight ${influencer?.payment === 'yes' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            {influencer?.payment === 'yes' ? 'Cleared' : 'Pending'}
                                        </span>
                                        {influencer?.payment === 'yes' && (
                                            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 border-2 border-emerald-600 text-[10px] font-black rounded-lg">
                                                VERIFIED
                                            </div>
                                        )}
                                    </div>
                                    {influencer?.payment === 'yes' && influencer?.platform_type && (
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            Via <span className="text-black font-black">{influencer.platform_type}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Management Hub */}
                <div className="bg-white border-8 border-black rounded-[3rem] shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="p-10 border-b-8 border-black bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-[#D946EF] border-4 border-black rounded-[1.5rem] flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform">
                                <Sparkles className="w-8 h-8 text-black" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black uppercase tracking-tight">Content Inventory</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Live Story Link Registry</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleAddStory} 
                            className="px-8 py-4 bg-yellow-400 text-black border-4 border-black font-black uppercase text-sm shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[-4px] hover:shadow-[10px_10px_0px_0px_rgba(255,255,255,1)] active:translate-y-[2px] transition-all flex items-center gap-3"
                        >
                            <Plus className="w-5 h-5" /> Add New Story
                        </button>
                    </div>

                    <div className="p-10 space-y-8 bg-white">
                        {stories.length === 0 ? (
                            <div className="py-32 text-center space-y-6">
                                <div className="w-24 h-24 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center mx-auto animate-pulse">
                                    <LinkIcon className="w-10 h-10 text-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-2xl font-black uppercase text-slate-300">Inventory Empty</p>
                                    <p className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">Deploy your first story link to start tracking</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-8">
                                {stories.map((story, index) => (
                                    <div 
                                        key={index} 
                                        className="group p-8 bg-slate-50 border-4 border-black rounded-[2rem] relative hover:bg-white hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all animate-slide-up"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className="absolute -top-4 -left-4 px-6 py-2 bg-black text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(217,70,239,1)]">
                                            Story-{index + 1}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                                            <div className="space-y-3">
                                                <label className="text-[11px] font-black uppercase text-slate-400 pl-2 flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-[#D946EF]" /> Story Date
                                                </label>
                                                <input 
                                                    type="date" 
                                                    value={story.story_date}
                                                    onChange={(e) => handleStoryChange(index, 'story_date', e.target.value)}
                                                    className="w-full bg-white border-4 border-black p-5 rounded-2xl font-black text-sm focus:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[11px] font-black uppercase text-slate-400 pl-2 flex items-center gap-2">
                                                    <LinkIcon className="w-4 h-4 text-blue-500" /> Story Link
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        type="url" 
                                                        value={story.story_link}
                                                        onChange={(e) => handleStoryChange(index, 'story_link', e.target.value)}
                                                        placeholder="https://instagram.com/stories/..."
                                                        className="w-full bg-white border-4 border-black p-5 pr-16 rounded-2xl font-black text-sm focus:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] outline-none transition-all"
                                                    />
                                                    {story.story_link && (
                                                        <a 
                                                            href={story.story_link} 
                                                            target="_blank" 
                                                            rel="noreferrer" 
                                                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 border-2 border-black text-white rounded-xl flex items-center justify-center hover:bg-black hover:scale-110 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                        >
                                                            <ExternalLink className="w-5 h-5" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-4 mt-6">
                                            <button 
                                                onClick={() => handleRemoveStory(index)} 
                                                className="px-6 py-3 bg-red-100 text-red-600 border-2 border-black font-black uppercase text-[10px] rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                                            >
                                                <Trash2 className="w-4 h-4" /> Remove
                                            </button>
                                            {!story.id && (
                                                <button 
                                                    onClick={() => handleSaveSingle(index)} 
                                                    className="px-8 py-3 bg-emerald-500 text-white border-2 border-black font-black uppercase text-[10px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-2"
                                                >
                                                    <Save className="w-4 h-4" /> Save Instance
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PAStoryInfluencerDetails;


