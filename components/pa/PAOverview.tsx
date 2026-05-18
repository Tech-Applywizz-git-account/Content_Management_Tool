import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, SYSTEM_BRANDS, normalizePABrandName, getDynamicSourceFilterForBrand } from '../../services/supabaseDb';
import { 
    BarChart3, 
    TrendingUp, 
    Building2, 
    Calendar as CalendarIcon, 
    FileText, 
    AlertCircle, 
    CheckCircle2,
    Clock,
    Search,
    Filter,
    ChevronRight,
    ArrowLeft,
    ExternalLink,
    PlayCircle,
    User as UserIcon,
    Briefcase,
    Tag,
    Upload,
    RefreshCw,
    Users,
    Instagram,
    Youtube,
    Video,
    LineChart,
    LayoutDashboard,
    Layers,
    Activity,
    History,
    MessageSquare,
    MapPin,
    X,
    DollarSign,
    Image as ImageIcon,
    FileCheck,
    Link as LinkIcon
} from 'lucide-react';
import { Project, WorkflowStage, TaskStatus, STAGE_LABELS, Channel, Role } from '../../types';
import { format } from 'date-fns';
import { supabase } from '../../src/integrations/supabase/client';
import { toast } from 'sonner';
interface PAOverviewProps {
    user: any;
    allProjects: Project[];
    onSelectProject: (project: Project) => void;
}

interface WorkflowHistoryEntry {
    action: string;
    comment: string;
    actor_name: string;
    actor_id?: string;
    timestamp: string;
    stage: string;
}

const fetchOverallLeads = async () => {
    const today = new Date();
    const url = new URL(import.meta.env.VITE_LEADS_API_URL || 'http://localhost:3000/api/leads');
    url.searchParams.set('startDate', '2024-01-01');
    url.searchParams.set('endDate', today.toISOString().split('T')[0]);
    url.searchParams.set('limit', '20000');

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Leads API Error: ${response.status}`);

    const result = await response.json();
    return result.data || (Array.isArray(result) ? result : []);
};

const PAOverview: React.FC<PAOverviewProps> = ({ user, allProjects, onSelectProject }) => {
    const navigate = useNavigate();
    const [brands, setBrands] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [brandFilter, setBrandFilter] = useState('ALL');
    const [stageFilter, setStageFilter] = useState('ALL');
    const [workTypeFilter, setWorkTypeFilter] = useState<'ALL' | 'INFLUENCER' | 'PERSONAL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'REEL' | 'STORY' | null>(null);
    const [brandInfluencers, setBrandInfluencers] = useState<any[]>([]);
    const [allInfluencers, setAllInfluencers] = useState<any[]>([]);
    const [brandLeads, setBrandLeads] = useState<any[]>([]);
    const [allLeads, setAllLeads] = useState<any[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [activeKpi, setActiveKpi] = useState<string | null>(null);
    const influencerTableRef = useRef<HTMLDivElement>(null);

    // View Mode State (Like CMO Dashboard)
    const [viewMode, setViewMode] = useState<'OVERVIEW' | 'DETAILS'>('OVERVIEW');
    const [selectedProjectInternal, setSelectedProjectInternal] = useState<Project | null>(null);
    const [comments, setComments] = useState<WorkflowHistoryEntry[]>([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const topRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const [brandData, infData, leadsData] = await Promise.all([
                    db.brands.getAll(),
                    db.influencers.getAll(),
                    fetchOverallLeads().catch(() => [])
                ]);
                setBrands([...SYSTEM_BRANDS, ...brandData]);
                setAllInfluencers(infData);
                setAllLeads(leadsData);
            } catch (err) {
                console.error("Failed to load initial data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchBrands();
    }, []);

    // Fetch comments when a project is selected
    useEffect(() => {
        const fetchComments = async () => {
            if (!selectedProjectInternal?.id) return;
            setIsLoadingComments(true);
            try {
                const { data, error } = await supabase
                    .from('workflow_history')
                    .select('action, comment, actor_name, actor_id, timestamp, stage')
                    .eq('project_id', selectedProjectInternal.id)
                    .order('timestamp', { ascending: false });

                if (error) throw error;
                setComments(data || []);
            } catch (err) {
                console.error('Error fetching history:', err);
                setComments([]);
            } finally {
                setIsLoadingComments(false);
            }
        };

        if (viewMode === 'DETAILS') {
            fetchComments();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [selectedProjectInternal, viewMode]);

    // Helper to identify influencer projects
    const isInfluencerProject = (p: any) => {
        const data = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
        const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
        
        return (
            data?.influencer_instance === true ||
            metadata?.influencer_instance === true ||
            data?.is_influencer === true ||
            metadata?.is_influencer === true ||
            !!data?.influencer_name ||
            !!metadata?.influencer_name ||
            !!data?.parent_script_id ||
            !!metadata?.parent_script_id
        );
    };

    const isInfluencerInstance = (p: any) => {
        const data = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
        const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
        return data?.influencer_instance === true || metadata?.influencer_instance === true;
    };

    const isPaBrand = (p: any) => {
        const data = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
        const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
        return data?.is_pa_brand === true || metadata?.is_pa_brand === true;
    };

    // Filter data to only show user's owned brands and projects
    const myBrands = useMemo(() => (brands || []).filter(b => b.created_by_user_id === user?.id), [brands, user?.id]);
    const myBrandNames = useMemo(() => myBrands.map(b => b.brand_name.toLowerCase()), [myBrands]);

    // Logic from PABrandDetails for lead source filtering


    // Fetch brand-specific data when brand filter changes
    useEffect(() => {
        if (brandFilter === 'ALL' || brandFilter === 'UNBRANDED') {
            setBrandInfluencers([]);
            setBrandLeads([]);
            return;
        }

        const fetchBrandSpecificData = async () => {
            // Don't set global loading true to avoid blank screens
            try {
                // 1. Fetch Influencers and Leads
                const [infData, allLeadsData] = await Promise.all([
                    db.influencers.getByBrand(brandFilter),
                    fetchOverallLeads().catch(() => [])
                ]);

                // 2. Fetch stories only for the influencers we found (more efficient)
                const influencerIds = infData.map(i => i.id);
                const storiesData = influencerIds.length > 0 
                    ? await supabase.from('influencer_stories').select('*').in('influencer_id', influencerIds)
                    : { data: [] };

                // Enrich influencers with stories
                const enriched = infData.map(inf => ({
                    ...inf,
                    stories: (storiesData.data || []).filter(s => s.influencer_id === inf.id)
                }));
                setBrandInfluencers(enriched);

                // 2. Filter Leads
                const rawLeads = allLeadsData;
                const sourceFilter = getDynamicSourceFilterForBrand(brandFilter, brands);
                const filteredLeads = sourceFilter ? rawLeads.filter(l => sourceFilter(l.source || '')) : rawLeads;
                setBrandLeads(filteredLeads);

            } catch (err) {
                console.warn('Failed to fetch brand-specific data:', err);
            } finally {
                setIsDataLoading(false);
            }
        };

        fetchBrandSpecificData();
    }, [brandFilter]);
    
    const myProjects = useMemo(() => {
        return (allProjects || []).filter(p => {
            const isAssignedToUser = p.assigned_to_user_id === user?.id;
            const belongsToMyBrand = p.brand && myBrandNames.includes(p.brand.toLowerCase());
            const isCreatedByMe = p.created_by_user_id === user?.id;
            return isAssignedToUser || belongsToMyBrand || isCreatedByMe;
        });
    }, [allProjects, user?.id, myBrandNames]);

    // Get all unique brand names from all possible sources
    const allBrandNames = useMemo(() => {
        // Map of brand name (Normalized) to category
        const brandCategoryMap = new Map<string, 'REEL' | 'STORY'>();
        
        // 1. Process all fetched brands (system + user)
        brands.forEach(b => {
            const name = normalizePABrandName(b.brand_name);
            if (!name) return;
            brandCategoryMap.set(name, (b.brand_type || 'REEL').toUpperCase() as 'REEL' | 'STORY');
        });

        // 2. Process project brands (for those not in the brands list)
        allProjects.forEach(p => {
            if (!p.brand) return;
            const name = normalizePABrandName(p.brand);
            if (!name || brandCategoryMap.has(name)) return;
            
            // Heuristic: if name contains 'STORY' or 'STORIES', it's a STORY brand
            const isStory = name.includes('STORY') || name.includes('STORIES');
            brandCategoryMap.set(name, isStory ? 'STORY' : 'REEL');
        });

        // 3. Filter by current category (or return all if none selected)
        const filtered = Array.from(brandCategoryMap.entries())
            .filter(([_, cat]) => !categoryFilter || cat === categoryFilter)
            .map(([name]) => name);

        return filtered.sort();
    }, [brands, allProjects, categoryFilter]);

    const brandDashboardMetrics = useMemo(() => {
        const isAll = brandFilter === 'ALL';
        const currentBrand = !isAll ? brands.find(b => b.brand_name.toUpperCase() === brandFilter) : null;
        const isStoryBrand = !isAll && (currentBrand?.brand_type === 'STORY' || brandFilter.includes('STORY') || brandFilter.includes('STORIES'));

        const brandProjects = isAll 
            ? myProjects 
            : myProjects.filter(p => (p.brand && p.brand.toUpperCase() === brandFilter) || (!p.brand && brandFilter === 'UNBRANDED'));
        
        const currentLeads = isAll ? allLeads : brandLeads;
        const totalLeads = currentLeads.length;
        let displayedLeads = currentLeads;
        let currentInfluencers = brandFilter === 'ALL' ? allInfluencers : brandInfluencers;
        let currentProjects = brandProjects;

        // Apply Search to everything for "Super Search" logic
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            
            // Filter Leads for displayed lead list only, keep KPI total unchanged
            displayedLeads = displayedLeads.filter((lead: any) => 
                (lead.full_name || lead.name || '').toLowerCase().includes(lowSearch) ||
                (lead.email || '').toLowerCase().includes(lowSearch) ||
                (lead.phone || '').toLowerCase().includes(lowSearch) ||
                (lead.source || '').toLowerCase().includes(lowSearch) ||
                (lead.status || lead.stage || '').toLowerCase().includes(lowSearch)
            );

            // Filter Influencers
            currentInfluencers = currentInfluencers.filter((inf: any) => {
                const budgetStr = String(inf.budget || '').toLowerCase();
                const isFreeSearch = lowSearch === 'free' && (budgetStr === '0' || budgetStr.includes('free'));
                return (inf.influencer_name || '').toLowerCase().includes(lowSearch) || 
                       (inf.niche || '').toLowerCase().includes(lowSearch) ||
                       (inf.influencer_email || '').toLowerCase().includes(lowSearch) ||
                       (inf.contact_details || '').toLowerCase().includes(lowSearch) ||
                       (inf.location || '').toLowerCase().includes(lowSearch) ||
                       budgetStr.includes(lowSearch) ||
                       isFreeSearch;
            });

            // Filter Projects
            currentProjects = currentProjects.filter((p: any) => 
                p.title.toLowerCase().includes(lowSearch) || 
                (p.brand || '').toLowerCase().includes(lowSearch) ||
                (p.data?.influencer_name || '').toLowerCase().includes(lowSearch) ||
                (p.data?.script_content || '').toLowerCase().includes(lowSearch)
            );
        }

        const influencersToUse = currentInfluencers;
        const totalScripts = currentProjects.filter(p => (isPaBrand(p) || isInfluencerProject(p)) && !isInfluencerInstance(p)).length;
        const totalInfluencerTasks = currentProjects.filter(p => isInfluencerInstance(p)).length;
        const totalProof = currentProjects.filter(p => !!p.pa_posting_proof_added_at).length;

        const totalBudget = influencersToUse.reduce((sum, inf) => {
            const budgetVal = typeof inf.budget === 'string' 
                ? parseFloat(inf.budget.replace(/[^0-9.]/g, '')) 
                : (typeof inf.budget === 'number' ? inf.budget : 0);
            return sum + (isNaN(budgetVal) ? 0 : budgetVal);
        }, 0);

        // Detailed influencer stats combining table data and projects
        const influencerStats: Record<string, any> = {};
        
        // Seed with table data
        influencersToUse.forEach(inf => {
            const name = inf.influencer_name;
            if (!name) return;
            influencerStats[name] = {
                name,
                tasks: 0,
                completed: 0,
                rawUploaded: !!inf.video_link || !!inf.script_content ? 1 : 0,
                latestStatus: 'No active project'
            };
        });

        // Add/Update with project data
        currentProjects.forEach(p => {
            if (isInfluencerInstance(p)) {
                const name = p.data?.influencer_name || p.metadata?.influencer_name;
                if (!name) return;
                
                if (!influencerStats[name]) {
                    influencerStats[name] = {
                        name,
                        tasks: 0,
                        completed: 0,
                        rawUploaded: 0,
                        latestStatus: p.current_stage
                    };
                }
                
                influencerStats[name].tasks++;
                if (p.current_stage === WorkflowStage.POSTED) influencerStats[name].completed++;
                if (p.video_link || p.pa_raw_footage_uploaded_at) influencerStats[name].rawUploaded = Math.max(influencerStats[name].rawUploaded, 1);
                influencerStats[name].latestStatus = p.current_stage;
            }
        });

        let influencerList = Object.values(influencerStats).sort((a: any, b: any) => b.tasks - a.tasks);
        let scriptList = currentProjects.filter(p => (isPaBrand(p) || isInfluencerProject(p)) && !isInfluencerInstance(p))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const rawVideos = influencersToUse.filter(i => !!i.raw_video).length;
        const editedVideos = influencersToUse.filter(i => !!i.edited_video).length;

        if (isStoryBrand) {
            const totalStories = influencersToUse.reduce((acc, inf) => acc + (inf.stories?.length || 0), 0);
            return {
                totalInfluencers: influencersToUse.length,
                rawVideosReceived: rawVideos,
                editedVideos: editedVideos,
                totalLeads,
                totalScripts: totalStories,
                totalInfluencerTasks,
                totalBudget,
                totalProof,
                influencerList,
                scriptList,
                leadList: displayedLeads,
                isStory: true
            };
        }

        return {
            totalInfluencers: influencersToUse.length,
            rawVideosReceived: rawVideos,
            editedVideos: editedVideos,
            totalLeads,
            totalProjects: currentProjects.length,
            totalScripts,
            totalInfluencerTasks,
            totalBudget,
            totalProof,
            influencerList,
            scriptList,
            leadList: displayedLeads,
            isStory: false
        };
    }, [myProjects, brandFilter, brandInfluencers, brandLeads, brands, allInfluencers, searchTerm, allLeads, myBrands]);

    const filteredProjects = useMemo(() => {
        const base = myProjects.filter(p => {
            const bName = (p.brand || '').trim().toUpperCase();
            const matchesBrand = brandFilter === 'ALL' || bName === brandFilter || (!p.brand && brandFilter === 'UNBRANDED');
            const matchesStage = stageFilter === 'ALL' || p.current_stage === stageFilter;
            const lowSearch = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || 
                p.title.toLowerCase().includes(lowSearch) || 
                (p.brand?.toLowerCase() || '').includes(lowSearch) ||
                (p.data?.influencer_name?.toLowerCase() || '').includes(lowSearch) ||
                (p.data?.influencer_email?.toLowerCase() || '').includes(lowSearch) ||
                (p.data?.influencer_niche?.toLowerCase() || '').includes(lowSearch) ||
                (lowSearch === 'free' && (String(p.data?.influencer_budget) === '0' || String(p.data?.influencer_budget).toLowerCase().includes('free'))) ||
                String(p.data?.influencer_budget || '').toLowerCase().includes(lowSearch);
            
            const isInfluencer = isInfluencerProject(p);
            const matchesType = workTypeFilter === 'ALL' || 
                (workTypeFilter === 'INFLUENCER' && isInfluencer) || 
                (workTypeFilter === 'PERSONAL' && !isInfluencer);
            
            return matchesBrand && matchesStage && matchesSearch && matchesType;
        });

        // Deduplication Logic
        const uniqueProjects: Record<string, Project> = {};
        base.forEach(p => {
            const influencerName = p.data?.influencer_name || '';
            const key = `${p.title}-${influencerName}-${p.brand || ''}`;
            if (!uniqueProjects[key]) {
                uniqueProjects[key] = p;
            } else {
                const existing = uniqueProjects[key];
                const existingTime = new Date(existing.updated_at || existing.created_at).getTime();
                const currentTime = new Date(p.updated_at || p.created_at).getTime();
                if (currentTime > existingTime) uniqueProjects[key] = p;
            }
        });

        return Object.values(uniqueProjects).sort((a, b) => 
            new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        );
    }, [myProjects, brandFilter, stageFilter, searchTerm, workTypeFilter]);

    const stageBreakdown = useMemo(() => {
        const stages = [
            WorkflowStage.PARTNER_REVIEW,
            WorkflowStage.SENT_TO_INFLUENCER,
            WorkflowStage.PA_VIDEO_CMO_REVIEW,
            WorkflowStage.VIDEO_EDITING,
            WorkflowStage.PA_FINAL_REVIEW,
            WorkflowStage.POSTED
        ];
        
        return stages.map(stage => ({
            stage,
            count: myProjects.filter(p => {
                const bName = (p.brand || '').trim().toUpperCase();
                const matchesBrand = brandFilter === 'ALL' || bName === brandFilter || (!p.brand && brandFilter === 'UNBRANDED');
                const matchesType = workTypeFilter === 'ALL' || 
                    (workTypeFilter === 'INFLUENCER' && isInfluencerProject(p)) || 
                    (workTypeFilter === 'PERSONAL' && !isInfluencerProject(p));
                return p.current_stage === stage && matchesBrand && matchesType;
            }).length,
            label: STAGE_LABELS[stage] || stage.replace(/_/g, ' ')
        }));
    }, [myProjects, brandFilter, workTypeFilter]);

    const renderMetricCard = (label: string, value: number | string, icon: React.ReactNode, colorClass: string, bgClass: string) => (
        <div className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 transition-all hover:shadow-md flex-1 min-w-[240px]`}>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${bgClass} ${colorClass}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-3xl font-black text-slate-900 tabular-nums">{value}</p>
            </div>
        </div>
    );

    const handleProjectClick = (project: Project) => {
        setSelectedProjectInternal(project);
        setViewMode('DETAILS');
    };

    const renderProjectDetails = (project: Project) => (
        <div className="space-y-10 animate-fade-in max-w-7xl mx-auto px-4 py-6">
            {/* Elegant Header */}
            <div className="flex items-center gap-6">
                <button 
                    onClick={() => setViewMode('OVERVIEW')}
                    className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/50 transition-all shadow-sm group"
                >
                    <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                </button>
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Project Insights</h2>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            project.status === TaskStatus.REWORK ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                            {project.status}
                        </span>
                    </div>
                    <p className="text-slate-500 font-medium flex items-center gap-2">
                        {project.title} 
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Main Content Area */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Core Intelligence Card */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-full -mr-32 -mt-32 -z-10"></div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform</span>
                                <div className="flex items-center gap-2">
                                    {project.channel === Channel.INSTAGRAM ? <Instagram className="w-4 h-4 text-pink-500" /> : <Youtube className="w-4 h-4 text-red-500" />}
                                    <p className="font-bold text-slate-900">{project.channel}</p>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority</span>
                                <p className={`font-bold ${project.priority === 'HIGH' ? 'text-orange-600' : 'text-slate-900'}`}>{project.priority}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeline</span>
                                <p className="font-bold text-slate-900">{format(new Date(project.created_at), 'MMM dd, yyyy')}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Role</span>
                                <p className="font-bold text-slate-900 uppercase tracking-tighter text-sm">{project.assigned_to_role || 'General'}</p>
                            </div>
                        </div>

                        <div className="mt-10 pt-10 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Stage</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                        <Layers className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <p className="text-xl font-black text-slate-900 tracking-tight">{STAGE_LABELS[project.current_stage] || project.current_stage}</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Owner</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xs font-black text-slate-600 uppercase">
                                        {(project.writer_name || 'S')[0]}
                                    </div>
                                    <p className="text-xl font-black text-slate-900 tracking-tight">{project.writer_name || 'System'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Script Content Area */}
                    {(project.data?.script_content || project.data?.idea_description) && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-100">
                                        <FileText className="w-4 h-4 text-white" />
                                    </div>
                                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900">
                                        {project.data?.source === 'IDEA_PROJECT' ? 'Creative Idea' : 'Script Narrative'}
                                    </h3>
                                </div>
                                <div className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-full">
                                    Ref: {project.id.slice(0, 8)}
                                </div>
                            </div>
                            <div className="bg-slate-50/50 rounded-[1.5rem] p-8 border border-slate-100">
                                <div 
                                    className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{ __html: (project.data?.script_content || project.data?.idea_description || '').replace(/\n/g, '<br/>') }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Delivery & Assets */}
                    {(project.video_link || project.edited_video_link || project.data?.script_reference_link) && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {project.video_link && (
                                <a href={project.video_link} target="_blank" rel="noopener noreferrer" className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-indigo-500 transition-all flex flex-col gap-4 group shadow-sm">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                        <Video className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Raw Footage</p>
                                        <p className="text-sm font-bold text-slate-900 flex items-center justify-between">Review Material <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" /></p>
                                    </div>
                                </a>
                            )}
                            {project.edited_video_link && (
                                <a href={project.edited_video_link} target="_blank" rel="noopener noreferrer" className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-emerald-500 transition-all flex flex-col gap-4 group shadow-sm">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                                        <PlayCircle className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Final Delivery</p>
                                        <p className="text-sm font-bold text-slate-900 flex items-center justify-between">Watch Video <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600" /></p>
                                    </div>
                                </a>
                            )}
                            {project.data?.script_reference_link && (
                                <a href={project.data.script_reference_link} target="_blank" rel="noopener noreferrer" className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-blue-500 transition-all flex flex-col gap-4 group shadow-sm">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                        <LinkIcon className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Master Script</p>
                                        <p className="text-sm font-bold text-slate-900 flex items-center justify-between">View Document <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600" /></p>
                                    </div>
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column: Workflow Activity */}
                <div className="lg:col-span-4 h-full">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm flex flex-col sticky top-8">
                        <div className="flex items-center justify-between mb-10">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                                    <Activity className="w-4 h-4 text-white" />
                                </div>
                                <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900">Activity</h3>
                            </div>
                            <div className="bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                                {comments.length} Events
                            </div>
                        </div>

                        {isLoadingComments ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing Log...</p>
                            </div>
                        ) : comments.length > 0 ? (
                            <div className="space-y-8 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                {comments.map((comment, idx) => (
                                    <div key={idx} className="relative pl-12 group">
                                        <div className={`absolute left-2.5 top-0.5 w-5 h-5 rounded-full border-[3px] border-white flex items-center justify-center shadow-sm transition-transform group-hover:scale-125 ${
                                            comment.action === 'APPROVED' ? 'bg-emerald-500' : 
                                            comment.action === 'REWORK' ? 'bg-orange-500' : 'bg-slate-400'
                                        }`}></div>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{comment.actor_name}</p>
                                                <span className="text-[9px] font-bold text-slate-400 italic">{format(new Date(comment.timestamp), 'MMM dd, p')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                                    comment.action === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 
                                                    comment.action === 'REWORK' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-500'
                                                }`}>{comment.action}</span>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">→ {comment.stage.replace(/_/g, ' ')}</span>
                                            </div>
                                            {comment.comment && (
                                                <div className="mt-2 p-4 bg-slate-50 rounded-2xl text-xs font-medium text-slate-600 border border-slate-100 group-hover:bg-white group-hover:border-indigo-100 transition-all">
                                                    {comment.comment}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                                <MessageSquare className="w-16 h-16 text-slate-200" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center px-6">The activity timeline will populate as the project moves through the pipeline.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );


    if (viewMode === 'DETAILS' && selectedProjectInternal) {
        return renderProjectDetails(selectedProjectInternal);
    }

    return (
        <div className="space-y-10 animate-fade-in pb-20 max-w-[120rem] mx-auto px-4 lg:px-8">

            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                            <Layers className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Work Overview</h1>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select category to view brands</p>
                        </div>
                    </div>

                    {/* Category Selection Tabs */}
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1.5 self-start md:self-center">
                        <button 
                            onClick={() => {
                                setCategoryFilter('REEL');
                                setBrandFilter('ALL');
                            }}
                            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                categoryFilter === 'REEL' 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                            <Video className="w-4 h-4" />
                            Reels
                        </button>
                        <button 
                            onClick={() => {
                                setCategoryFilter('STORY');
                                setBrandFilter('ALL');
                            }}
                            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                categoryFilter === 'STORY' 
                                    ? 'bg-[#D946EF] text-white shadow-lg shadow-pink-200' 
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                            <Instagram className="w-4 h-4" />
                            Stories
                        </button>
                    </div>
                </div>

                {/* Dynamic Influencer List */}
                    <div className="flex flex-wrap items-center gap-3 max-h-48 overflow-y-auto no-scrollbar pb-2">
                        <button 
                            onClick={() => setBrandFilter('ALL')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-2 ${
                                brandFilter === 'ALL' 
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                    : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            All Brands
                        </button>

                        {categoryFilter && allBrandNames.length > 0 && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                <div className="h-6 w-px bg-slate-200 mx-1"></div>
                                <select 
                                    value={brandFilter === 'ALL' || brandFilter === 'UNBRANDED' ? '' : brandFilter}
                                    onChange={(e) => setBrandFilter(e.target.value || 'ALL')}
                                    className="bg-white border-2 border-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl outline-none focus:border-indigo-500 transition-all cursor-pointer hover:border-slate-300"
                                >
                                    <option value="">Select {categoryFilter} Brand</option>
                                    {allBrandNames.map(b => (
                                        <option key={b} value={b}>{b.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
            </div>

            {/* Global Search Bar - Now after Work Overview */}
            <div className="flex items-center gap-6 animate-in fade-in slide-in-from-top-2 duration-500 delay-150">
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Super Search: Collabs, Creators, Niche, Contact, Budget, Leads..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-8 py-3 bg-white border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-lg text-sm font-bold placeholder:text-slate-300"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Performance Snapshot */}
            {brandDashboardMetrics && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Activity className="w-6 h-6 text-indigo-600" />
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-indigo-600">{brandFilter === 'ALL' ? 'Global' : brandFilter.replace(/_/g, ' ')}</span> Performance
                            </h2>
                        </div>
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-full tracking-widest border border-indigo-100">
                            Live Data
                        </span>
                    </div>


                    <div className="flex flex-wrap gap-6 relative">
                        {/* Removed the blocking loading overlay to prevent laggy perception */}
                        <div 
                            onClick={() => setActiveKpi(activeKpi === 'SCRIPTS' ? null : 'SCRIPTS')}
                            className={`cursor-pointer hover:scale-[1.02] transition-all flex-1 min-w-[200px] ${activeKpi === 'SCRIPTS' ? 'ring-4 ring-indigo-500/20' : ''}`}
                        >
                            {renderMetricCard(brandDashboardMetrics.isStory ? "Total Stories" : "Total Scripts", brandDashboardMetrics.totalScripts, <FileText className="w-6 h-6" />, "text-indigo-600", "bg-indigo-50")}
                        </div>
                        <div 
                            onClick={() => setActiveKpi(activeKpi === 'INFLUENCERS' ? null : 'INFLUENCERS')}
                            className={`cursor-pointer hover:scale-[1.02] transition-all flex-1 min-w-[200px] ${activeKpi === 'INFLUENCERS' ? 'ring-4 ring-violet-500/20' : ''}`}
                        >
                            {renderMetricCard("Influencers", brandDashboardMetrics.totalInfluencers, <Users className="w-6 h-6" />, "text-violet-600", "bg-violet-50")}
                        </div>

                        <div 
                            onClick={() => setActiveKpi(activeKpi === 'RAW' ? null : 'RAW')}
                            className={`cursor-pointer hover:scale-[1.02] transition-all flex-1 min-w-[200px] ${activeKpi === 'RAW' ? 'ring-4 ring-amber-500/20' : ''}`}
                        >
                            {renderMetricCard("Raw Videos", brandDashboardMetrics.rawVideosReceived, <Video className="w-6 h-6" />, "text-amber-600", "bg-amber-50")}
                        </div>
                        <div 
                            onClick={() => setActiveKpi(activeKpi === 'EDITED' ? null : 'EDITED')}
                            className={`cursor-pointer hover:scale-[1.02] transition-all flex-1 min-w-[200px] ${activeKpi === 'EDITED' ? 'ring-4 ring-blue-500/20' : ''}`}
                        >
                            {renderMetricCard("Edited Videos", brandDashboardMetrics.editedVideos, <CheckCircle2 className="w-6 h-6" />, "text-blue-600", "bg-blue-50")}
                        </div>
                        <div 
                            onClick={() => navigate('/partner_associate/leads', { state: { brandFilter: brandFilter === 'ALL' ? undefined : brandFilter } })}
                            className={`cursor-pointer hover:scale-[1.02] transition-all flex-1 min-w-[200px] ${activeKpi === 'LEADS' ? 'ring-4 ring-emerald-500/20' : ''}`}
                        >
                            {renderMetricCard("Total Leads", brandDashboardMetrics.totalLeads, <TrendingUp className="w-6 h-6" />, "text-emerald-600", "bg-emerald-50")}
                        </div>
                        <div 
                            onClick={() => setActiveKpi(activeKpi === 'BUDGET' ? null : 'BUDGET')}
                            className={`cursor-pointer hover:scale-[1.02] transition-all flex-1 min-w-[200px] ${activeKpi === 'BUDGET' ? 'ring-4 ring-purple-500/20' : ''}`}
                        >
                            {renderMetricCard("Total Budget", `$${brandDashboardMetrics.totalBudget.toLocaleString()}`, <DollarSign className="w-6 h-6" />, "text-purple-600", "bg-purple-50")}
                        </div>
                        <div 
                            onClick={() => setActiveKpi(activeKpi === 'PROOF' ? null : 'PROOF')}
                            className={`cursor-pointer hover:scale-[1.02] transition-all flex-1 min-w-[200px] ${activeKpi === 'PROOF' ? 'ring-4 ring-sky-500/20' : ''}`}
                        >
                            {renderMetricCard("Posting Proofs", brandDashboardMetrics.totalProof, <FileCheck className="w-6 h-6" />, "text-sky-600", "bg-sky-50")}
                        </div>
                    </div>

                    {/* KPI Detail Sections */}
                    <div className="mt-8 transition-all animate-in fade-in slide-in-from-top-4 duration-500">
                        {/* Influencer Details */}
                        {activeKpi === 'INFLUENCERS' && brandDashboardMetrics.influencerList.length > 0 && (
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-violet-600" /> Influencer Registry
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total {brandDashboardMetrics.influencerList.length} Active Influencers</span>
                                        <button onClick={() => setActiveKpi(null)} className="text-slate-400 hover:text-slate-900 transition-colors"><X className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Creator Name</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Handle & Contact</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Niche & Location</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Budget</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Added By</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {brandDashboardMetrics.influencerList.map((inf: any) => {
                                                const dbInf = (brandFilter === 'ALL' ? allInfluencers : brandInfluencers).find(i => i.influencer_name === inf.name);
                                                return (
                                                    <tr key={inf.name} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-xs font-black text-violet-600 uppercase">
                                                                    {inf.name[0]}
                                                                </div>
                                                                <span className="font-bold text-slate-900">{inf.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                {dbInf?.instagram_handle ? (
                                                                    <a href={`https://instagram.com/${dbInf.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-pink-600 hover:underline">
                                                                        <Instagram className="w-3 h-3" /> {dbInf.instagram_handle}
                                                                    </a>
                                                                ) : <span className="text-slate-300 text-xs">No Handle</span>}
                                                                <span className="text-[10px] text-slate-500">{dbInf?.influencer_email || 'No Email'}</span>
                                                                <span className="text-[9px] text-slate-400">{dbInf?.contact_details || ''}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-xs font-bold text-slate-700">{dbInf?.niche || 'N/A'}</span>
                                                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                    <MapPin className="w-2.5 h-2.5" /> {dbInf?.location || 'Unknown'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs font-bold text-emerald-600">${dbInf?.budget || 0}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                                            {dbInf?.sent_by || 'System'}
                                                        </td>
                                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => {
                                                    const bName = dbInf?.brand_name || brandFilter;
                                                    if (bName && bName !== 'ALL') {
                                                        const rolePath = user.role === Role.SUB_EDITOR ? 'sub_editor' : user.role.toLowerCase();
                                                        navigate(`/${rolePath}/brand-details/${encodeURIComponent(bName)}?highlightInfluencer=${encodeURIComponent(inf.name)}`);
                                                    } else {
                                                        toast.error("Select an influencer first to view details");
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-sm"
                                            >
                                                View Details
                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* CEO Approved Scripts Details */}
                        {activeKpi === 'SCRIPTS' && (
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                                            <FileText className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">CEO Approved Scripts</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active & Ready for Outreach</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveKpi(null)} className="text-slate-400 hover:text-slate-900 transition-colors"><X className="w-5 h-5" /></button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Script Title</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Brand</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Approved Date</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Current Stage</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {brandDashboardMetrics.scriptList
                                                .filter((script: any) => 
                                                    !!script.ceo_approved_at || 
                                                    ![WorkflowStage.SCRIPT, WorkflowStage.SCRIPT_REVIEW_L1, WorkflowStage.SCRIPT_REVIEW_L2].includes(script.current_stage)
                                                )
                                                .map((script: any) => (
                                                    <tr key={script.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <span className="font-bold text-slate-900">{script.title}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 rounded text-slate-500 whitespace-nowrap">
                                                                {script.brand || 'Unbranded'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                                            {script.ceo_approved_at ? format(new Date(script.ceo_approved_at), 'MMM dd, yyyy') : 'Recently Approved'}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="px-3 py-1 bg-emerald-50 rounded-full text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                                                                {script.current_stage === WorkflowStage.PARTNER_REVIEW ? 'OUTREACH READY' : (STAGE_LABELS[script.current_stage] || script.current_stage.replace(/_/g, ' '))}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <button 
                                                                onClick={() => handleProjectClick(script)}
                                                                className="text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:underline"
                                                            >
                                                                View Details
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        {/* Leads Details */}
                        {activeKpi === 'LEADS' && (
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                                            <TrendingUp className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Leads Intelligence</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Influencer Specific Conversions</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveKpi(null)} className="text-slate-400 hover:text-slate-900 transition-colors"><X className="w-5 h-5" /></button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Lead Name</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Source Intelligence</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Stage & Status</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Captured At</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {brandDashboardMetrics.leadList.filter((lead: any) => {
                                                if (!searchTerm) return true;
                                                const lowSearch = searchTerm.toLowerCase();
                                                return (lead.full_name || lead.name || '').toLowerCase().includes(lowSearch) ||
                                                       (lead.email || '').toLowerCase().includes(lowSearch) ||
                                                       (lead.phone || '').toLowerCase().includes(lowSearch) ||
                                                       (lead.source || '').toLowerCase().includes(lowSearch) ||
                                                       (lead.status || lead.stage || '').toLowerCase().includes(lowSearch);
                                            }).length > 0 ? brandDashboardMetrics.leadList.filter((lead: any) => {
                                                if (!searchTerm) return true;
                                                const lowSearch = searchTerm.toLowerCase();
                                                return (lead.full_name || lead.name || '').toLowerCase().includes(lowSearch) ||
                                                       (lead.email || '').toLowerCase().includes(lowSearch) ||
                                                       (lead.phone || '').toLowerCase().includes(lowSearch) ||
                                                       (lead.source || '').toLowerCase().includes(lowSearch) ||
                                                       (lead.status || lead.stage || '').toLowerCase().includes(lowSearch);
                                            }).map((lead: any) => (
                                                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="font-bold text-slate-900 block">{lead.full_name || lead.name || 'Anonymous'}</span>
                                                        <button 
                                                            onClick={() => {
                                                                const bName = brandFilter === 'ALL' ? (lead.brand || '') : brandFilter;
                                                                if (bName && bName !== 'ALL') {
                                                                    const rolePath = user.role === Role.SUB_EDITOR ? 'sub_editor' : user.role.toLowerCase();
                                                                    navigate(`/${rolePath}/brand-details/${encodeURIComponent(bName)}?highlightLead=${encodeURIComponent(lead.id)}`);
                                                                } else {
                                                                    toast.error("Influencer information missing for this lead");
                                                                }
                                                            }}
                                                            className="text-[9px] font-black text-indigo-600 hover:underline uppercase mt-1"
                                                        >
                                                            View Full Details
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-medium text-slate-600">{lead.email || 'No Email'}</span>
                                                            <span className="text-[10px] text-slate-400">{lead.phone || ''}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 rounded text-slate-500">
                                                            {lead.source || 'Direct'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="px-3 py-1 bg-indigo-50 rounded-full text-[10px] font-black uppercase text-indigo-600 tracking-wider w-fit">
                                                                Stage: {lead.stage || 'UNTRACKED'}
                                                            </span>
                                                            <span className="px-3 py-1 bg-emerald-50 rounded-full text-[10px] font-black uppercase text-emerald-600 tracking-wider w-fit">
                                                                Status: {lead.status || 'NEW'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                                        {lead.created_at ? format(new Date(lead.created_at), 'MMM dd, HH:mm') : 'N/A'}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                                        No leads found matching your search
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        {/* Detailed Drill-down for Workflow & Budget KPIs */}
                        {['TASKS', 'RAW', 'EDITED', 'BUDGET', 'PROOF'].includes(activeKpi || '') && (
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                                            activeKpi === 'RAW' ? 'bg-pink-600' :
                                            activeKpi === 'EDITED' ? 'bg-purple-600' :
                                            activeKpi === 'PROOF' ? 'bg-orange-600' :
                                            activeKpi === 'BUDGET' ? 'bg-emerald-600' :
                                            'bg-indigo-600'
                                        }`}>
                                            {activeKpi === 'RAW' ? <Video className="w-5 h-5 text-white" /> :
                                             activeKpi === 'EDITED' ? <PlayCircle className="w-5 h-5 text-white" /> :
                                             activeKpi === 'PROOF' ? <LinkIcon className="w-5 h-5 text-white" /> :
                                             activeKpi === 'BUDGET' ? <DollarSign className="w-5 h-5 text-white" /> :
                                             <Activity className="w-5 h-5 text-white" />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                                                {activeKpi === 'RAW' ? 'Raw Footage Inventory' :
                                                 activeKpi === 'EDITED' ? 'Edited Video Pipeline' :
                                                 activeKpi === 'PROOF' ? 'Proof Link Verification' :
                                                 activeKpi === 'BUDGET' ? 'Budget Distribution' :
                                                 'Active Workflow Tasks'}
                                            </h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {activeKpi === 'BUDGET' ? 'Financial Overview' : 'Live Management Interface'}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveKpi(null)} className="text-slate-400 hover:text-slate-900 transition-colors"><X className="w-5 h-5" /></button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Influencer</th>
                                                {activeKpi === 'BUDGET' ? (
                                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                                                ) : (
                                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Asset/Link</th>
                                                )}
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(brandFilter === 'ALL' ? allInfluencers : brandInfluencers)
                                                .filter(inf => {
                                                    if (activeKpi === 'RAW') return !!inf.raw_video;
                                                    if (activeKpi === 'EDITED') return !!inf.edited_video;
                                                    if (activeKpi === 'PROOF') return !!inf.proof_link;
                                                    if (activeKpi === 'BUDGET') return !!inf.budget && inf.budget !== '0' && inf.budget !== 0;
                                                    return true; // Tasks
                                                })
                                                .map((inf: any) => (
                                                <tr key={inf.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="font-bold text-slate-900 block">{inf.influencer_name}</span>
                                                        <span className="text-[10px] text-slate-400">{inf.influencer_email || ''}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {activeKpi === 'BUDGET' ? (
                                                            <span className="text-sm font-black text-emerald-600">${inf.budget || 0}</span>
                                                        ) : (
                                                            <a 
                                                                href={activeKpi === 'RAW' ? inf.raw_video : activeKpi === 'EDITED' ? inf.edited_video : inf.proof_link} 
                                                                target="_blank" 
                                                                rel="noreferrer" 
                                                                className="text-indigo-600 hover:underline flex items-center gap-1.5 text-xs font-bold"
                                                            >
                                                                <ExternalLink className="w-3 h-3" /> 
                                                                {activeKpi === 'RAW' ? 'Raw Video' : activeKpi === 'EDITED' ? 'Edited Video' : 'Proof Link'}
                                                            </a>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                            {STAGE_LABELS[inf.project_status] || inf.project_status || 'READY'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button 
                                                            onClick={() => {
                                                                const bName = inf.brand_name || brandFilter;
                                                                if (bName && bName !== 'ALL') {
                                                                    const rolePath = user.role === Role.SUB_EDITOR ? 'sub_editor' : user.role.toLowerCase();
                                                                    navigate(`/${rolePath}/brand-details/${encodeURIComponent(bName)}?highlightInfluencer=${encodeURIComponent(inf.influencer_name)}`);
                                                                } else {
                                                                    toast.error("Pipeline data missing");
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-sm"
                                                        >
                                                            View Details
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(brandFilter === 'ALL' ? allInfluencers : brandInfluencers)
                                                .filter(inf => {
                                                    if (activeKpi === 'RAW') return !!inf.raw_video;
                                                    if (activeKpi === 'EDITED') return !!inf.edited_video;
                                                    if (activeKpi === 'PROOF') return !!inf.proof_link;
                                                    if (activeKpi === 'BUDGET') return !!inf.budget && inf.budget !== '0' && inf.budget !== 0;
                                                    return true;
                                                }).length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">
                                                        No records found for this category
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!activeKpi && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        {/* Modern Project Grid */}
                        <div className="lg:col-span-12 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                {filteredProjects.length === 0 ? (
                                    <div className="col-span-full py-32 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                            <Search className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">No projects found</h3>
                                        <p className="text-slate-500 mt-2">Try adjusting your filters or search terms.</p>
                                        <button 
                                            onClick={() => {
                                                setBrandFilter('ALL');
                                                setStageFilter('ALL');
                                                setSearchTerm('');
                                                setWorkTypeFilter('ALL');
                                            }}
                                            className="mt-8 px-6 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                                        >
                                            Clear all filters
                                        </button>
                                    </div>
                                ) : (
                                    filteredProjects.map(project => (
                                        <div 
                                            key={project.id}
                                            onClick={() => handleProjectClick(project)}
                                            className="group bg-white rounded-3xl border border-slate-200 p-7 hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-100 transition-all cursor-pointer flex flex-col h-full relative overflow-hidden"
                                        >
                                            {/* Accent background decoration */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 group-hover:bg-indigo-100/50 transition-colors"></div>

                                            <div className="flex items-center justify-between mb-6 relative">
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                    project.channel === Channel.YOUTUBE ? 'bg-red-50 text-red-600' :
                                                    project.channel === Channel.INSTAGRAM ? 'bg-pink-50 text-pink-600' :
                                                    'bg-slate-50 text-slate-600'
                                                }`}>
                                                    {project.channel}
                                                </div>
                                                {isInfluencerProject(project) && (
                                                    <div className="px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                                        <Users className="w-3 h-3" /> Influencer
                                                    </div>
                                                )}
                                            </div>

                                            <h4 className="font-bold text-xl text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors mb-6 line-clamp-2">
                                                {project.title}
                                            </h4>

                                            <div className="mt-auto space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Timeline</span>
                                                        <span className="text-xs font-bold text-slate-600">{format(new Date(project.created_at), 'MMM dd, yyyy')}</span>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-indigo-50/30 group-hover:border-indigo-100 transition-all">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workflow Stage</span>
                                                        {project.status === TaskStatus.REWORK && (
                                                            <span className="flex items-center gap-1 text-[10px] font-black text-red-600 uppercase">
                                                                <AlertCircle className="w-3 h-3" /> Rework
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-900 truncate">
                                                        {STAGE_LABELS[project.current_stage] || project.current_stage}
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between pt-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xs font-black text-indigo-600 border border-indigo-100">
                                                            {(project.writer_name || 'S')[0]}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Owner</span>
                                                            <span className="text-xs font-bold text-slate-900">{project.writer_name || 'System'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-white transition-all" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PAOverview;
