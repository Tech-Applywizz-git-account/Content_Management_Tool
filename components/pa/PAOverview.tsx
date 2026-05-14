import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../services/supabaseDb';
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
    Link as LinkIcon
} from 'lucide-react';
import { Project, WorkflowStage, TaskStatus, STAGE_LABELS, Channel, Role } from '../../types';
import { format } from 'date-fns';
import { supabase } from '../../src/integrations/supabase/client';

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

const PAOverview: React.FC<PAOverviewProps> = ({ user, allProjects, onSelectProject }) => {
    const [brands, setBrands] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [brandFilter, setBrandFilter] = useState('ALL');
    const [stageFilter, setStageFilter] = useState('ALL');
    const [workTypeFilter, setWorkTypeFilter] = useState<'ALL' | 'INFLUENCER' | 'PERSONAL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // View Mode State (Like CMO Dashboard)
    const [viewMode, setViewMode] = useState<'OVERVIEW' | 'DETAILS'>('OVERVIEW');
    const [selectedProjectInternal, setSelectedProjectInternal] = useState<Project | null>(null);
    const [comments, setComments] = useState<WorkflowHistoryEntry[]>([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const topRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const data = await db.brands.getAll();
                setBrands(data);
            } catch (err) {
                console.error("Failed to load brands:", err);
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
        const systemBrands = ['APPLYWIZZ', 'APPLYWIZZ_JOB_BOARD', 'LEAD_MAGNET_RTW', 'SHYAMS_PERSONAL_BRANDING', 'APPLYWIZZ_USA_JOBS', 'CAREER_IDENTIFIER'];
        const userBrands = brands.map(b => b.brand_name);
        const projectBrands = allProjects.map(p => p.brand).filter(Boolean) as string[];

        const merged = [...systemBrands, ...userBrands, ...projectBrands].map(name => name.trim().toUpperCase());
        return [...new Set(merged)].sort();
    }, [brands, allProjects]);

    const brandDashboardMetrics = useMemo(() => {
        if (brandFilter === 'ALL') return null;
        
        const brandProjects = myProjects.filter(p => (p.brand && p.brand.toUpperCase() === brandFilter) || (!p.brand && brandFilter === 'UNBRANDED'));
        
        const uniqueInfluencers = new Set();
        brandProjects.forEach(p => {
            if (isInfluencerProject(p)) {
                const pData = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
                const pMeta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
                const name = pData?.influencer_name || pMeta?.influencer_name;
                if (name) uniqueInfluencers.add(name);
            }
        });

        const rawVideos = brandProjects.filter(p => 
            p.video_link || p.pa_raw_footage_uploaded_at || 
            [WorkflowStage.PA_VIDEO_CMO_REVIEW, WorkflowStage.VIDEO_EDITING].includes(p.current_stage)
        ).length;

        const editedVideos = brandProjects.filter(p => 
            p.edited_video_link || p.pa_editor_video_uploaded_at || 
            [WorkflowStage.PA_FINAL_REVIEW, WorkflowStage.POSTED].includes(p.current_stage)
        ).length;

        const storiesPosted = brandProjects.filter(p => 
            p.channel === Channel.INSTAGRAM && 
            p.current_stage === WorkflowStage.POSTED &&
            (p.data?.category === 'Story' || p.data?.content_category === 'Story' || p.title.toLowerCase().includes('story'))
        ).length;

        const totalScripts = brandProjects.filter(p => (isPaBrand(p) || isInfluencerProject(p)) && !isInfluencerInstance(p)).length;
        const totalInfluencerTasks = brandProjects.filter(p => isInfluencerInstance(p)).length;

        // Detailed influencer stats
        const influencerStats: Record<string, any> = {};
        brandProjects.forEach(p => {
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
                if (p.video_link || p.pa_raw_footage_uploaded_at) influencerStats[name].rawUploaded++;
            }
        });

        const influencerList = Object.values(influencerStats).sort((a: any, b: any) => b.tasks - a.tasks);
        const scriptList = brandProjects.filter(p => (isPaBrand(p) || isInfluencerProject(p)) && !isInfluencerInstance(p))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return {
            totalInfluencers: uniqueInfluencers.size,
            rawVideosReceived: rawVideos,
            editedVideos: editedVideos,
            totalLeads: brandProjects.reduce((sum, p) => sum + (p.data?.leads_count || 0), 0),
            storiesPosted: storiesPosted,
            totalProjects: brandProjects.length,
            totalScripts,
            totalInfluencerTasks,
            influencerList,
            scriptList
        };
    }, [myProjects, brandFilter]);

    const filteredProjects = useMemo(() => {
        const base = myProjects.filter(p => {
            const bName = (p.brand || '').trim().toUpperCase();
            const matchesBrand = brandFilter === 'ALL' || bName === brandFilter || (!p.brand && brandFilter === 'UNBRANDED');
            const matchesStage = stageFilter === 'ALL' || p.current_stage === stageFilter;
            const matchesSearch = searchTerm === '' || 
                p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (p.brand?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (p.data?.influencer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            
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

    const renderMetricCard = (label: string, value: number, icon: React.ReactNode, colorClass: string, bgClass: string) => (
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
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="text-indigo-600 font-bold uppercase text-[11px] tracking-wider">{project.brand?.replace(/_/g, ' ') || 'General'}</span>
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#0085FF] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing Pipeline...</p>
                </div>
            </div>
        );
    }

    if (viewMode === 'DETAILS' && selectedProjectInternal) {
        return renderProjectDetails(selectedProjectInternal);
    }

    return (
        <div className="space-y-10 animate-fade-in pb-20 max-w-[120rem] mx-auto px-4 lg:px-8">
            {/* Clean Header Section */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 pt-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <LayoutDashboard className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                            Work Overview
                        </h1>
                    </div>
                    <p className="text-slate-500 font-medium ml-13">Unified command center for all brand content and influencer operations.</p>
                </div>

                {/* Modern Brand Selector */}
                <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-200 flex flex-wrap gap-1.5 shadow-sm max-w-full overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setBrandFilter('ALL')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                            brandFilter === 'ALL' 
                                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                                : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
                        }`}
                    >
                        All Brands
                    </button>
                    {allBrandNames.map(b => (
                        <button 
                            key={b} 
                            onClick={() => setBrandFilter(b)} 
                            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                                brandFilter === b 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                    : 'text-slate-500 hover:text-indigo-600 hover:bg-white'
                            }`}
                        >
                            {b.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Performance Snapshot */}
            {brandDashboardMetrics && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Activity className="w-6 h-6 text-indigo-600" />
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-indigo-600">{brandFilter.replace(/_/g, ' ')}</span> Performance
                            </h2>
                        </div>
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-full tracking-widest border border-indigo-100">
                            Live Data
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-6">
                        {renderMetricCard("Total Scripts", brandDashboardMetrics.totalScripts, <FileText className="w-6 h-6" />, "text-indigo-600", "bg-indigo-50")}
                        {renderMetricCard("Influencers", brandDashboardMetrics.totalInfluencers, <Users className="w-6 h-6" />, "text-violet-600", "bg-violet-50")}
                        {renderMetricCard("Active Tasks", brandDashboardMetrics.totalInfluencerTasks, <Activity className="w-6 h-6" />, "text-rose-600", "bg-rose-50")}
                        {renderMetricCard("Raw Videos", brandDashboardMetrics.rawVideosReceived, <Video className="w-6 h-6" />, "text-amber-600", "bg-amber-50")}
                        {renderMetricCard("Edited Videos", brandDashboardMetrics.editedVideos, <CheckCircle2 className="w-6 h-6" />, "text-blue-600", "bg-blue-50")}
                        {renderMetricCard("Total Leads", brandDashboardMetrics.totalLeads, <TrendingUp className="w-6 h-6" />, "text-emerald-600", "bg-emerald-50")}
                    </div>

                    {/* Influencer Details Table */}
                    {brandDashboardMetrics.influencerList.length > 0 && (
                        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mt-8">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-violet-600" /> Influencer Engagement
                                </h3>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total {brandDashboardMetrics.influencerList.length} Influencers</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Influencer Name</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tasks</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Raw Uploads</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Completed</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Latest Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {brandDashboardMetrics.influencerList.map((inf: any) => (
                                            <tr key={inf.name} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-xs font-black text-violet-600 uppercase">
                                                            {inf.name[0]}
                                                        </div>
                                                        <span className="font-bold text-slate-900">{inf.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-900">{inf.tasks}</td>
                                                <td className="px-6 py-4 font-bold text-amber-600">{inf.rawUploaded}</td>
                                                <td className="px-6 py-4 font-bold text-emerald-600">{inf.completed}</td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                        {STAGE_LABELS[inf.latestStatus] || inf.latestStatus.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {/* Script Pipeline Table */}
                    {brandDashboardMetrics.scriptList.length > 0 && (
                        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mt-8">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" /> Active Scripts
                                </h3>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total {brandDashboardMetrics.scriptList.length} Scripts</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Script Title</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Created At</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Stage</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {brandDashboardMetrics.scriptList.map((script: any) => (
                                            <tr key={script.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="font-bold text-slate-900 line-clamp-1">{script.title}</span>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                                    {format(new Date(script.created_at), 'MMM dd, yyyy')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border-2 border-black ${
                                                        script.status === TaskStatus.REWORK ? 'bg-red-500 text-white' : 'bg-yellow-400 text-black'
                                                    }`}>
                                                        {STAGE_LABELS[script.current_stage] || script.current_stage.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button 
                                                        onClick={() => handleProjectClick(script)}
                                                        className="text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:underline"
                                                    >
                                                        View Script
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Work Type & Search Bar */}
            <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="bg-slate-100 p-1.5 rounded-xl flex items-center gap-1.5">
                    <button 
                        onClick={() => setWorkTypeFilter('ALL')}
                        className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                            workTypeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        All Work
                    </button>
                    <button 
                        onClick={() => setWorkTypeFilter('INFLUENCER')}
                        className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                            workTypeFilter === 'INFLUENCER' ? 'bg-[#D946EF] text-white shadow-lg shadow-pink-200' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Influencers
                    </button>
                    <button 
                        onClick={() => setWorkTypeFilter('PERSONAL')}
                        className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                            workTypeFilter === 'PERSONAL' ? 'bg-[#0085FF] text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Scripts
                    </button>
                </div>

                <div className="flex-1 w-full relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search projects, influencers, or brands..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Modern Stages Sidebar */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-slate-400" />
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Pipeline</h3>
                            </div>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md">
                                {stageBreakdown.length} Stages
                            </span>
                        </div>
                        <div className="p-3 space-y-1">
                            {stageBreakdown.map((item, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => setStageFilter(stageFilter === item.stage ? 'ALL' : item.stage)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                                        stageFilter === item.stage 
                                        ? 'bg-indigo-50 text-indigo-700' 
                                        : 'bg-transparent text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className={`text-[11px] font-bold uppercase tracking-wide text-left ${stageFilter === item.stage ? 'text-indigo-700' : 'text-slate-600'}`}>
                                        {item.label}
                                    </span>
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                                        stageFilter === item.stage ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {item.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Modern Project Grid */}
                <div className="lg:col-span-9 space-y-8">
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
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Brand</span>
                                                <span className="text-sm font-bold text-slate-900 truncate max-w-[140px]">
                                                    {project.brand?.replace(/_/g, ' ') || 'General'}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Timeline</span>
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
        </div>
    );
};

export default PAOverview;
