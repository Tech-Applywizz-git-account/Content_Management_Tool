import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Project, User, WorkflowStage, STAGE_LABELS, Channel, TaskStatus, Role } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import { 
    Search, 
    Loader2,
    Plus,
    PlayCircle,
    MessageSquare,
    Clock,
    CheckCircle,
    ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import WriterProjectDetail from '../writer/WriterProjectDetail';
import CreateScript from '../writer/CreateScript';

interface PAScriptsProps {
    user: User;
    allProjects?: Project[];
}

const PAScripts: React.FC<PAScriptsProps> = ({ user, allProjects }) => {
    const navigate = useNavigate();
    const [scripts, setScripts] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode] = useState<'MY' | 'SENT'>('MY');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as 'kanban' | 'video-approval' | 'posted') || 'kanban';

    const setActiveTab = (tab: string) => {
        if (tab === 'kanban') {
            setSearchParams({});
        } else {
            setSearchParams({ tab });
        }
    };

    useEffect(() => {
        if (allProjects && allProjects.length > 0) {
            filterAndSetProjects(allProjects);
        } else {
            fetchMyScripts();
        }
    }, [user.id, viewMode, allProjects]);

    const isInfluencerInstance = (p: any) => {
        const data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
        const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
        
        return (
            data?.influencer_instance === true || 
            metadata?.influencer_instance === true ||
            !!data?.influencer_name ||
            !!metadata?.influencer_name ||
            !!data?.parent_script_id ||
            !!metadata?.parent_script_id
        );
    };

    const filterAndSetProjects = (data: Project[]) => {
        const filteredData = (data || []).filter(script => {
            const isInfluencerInst = isInfluencerInstance(script);
            const parsedData = typeof script.data === 'string' ? JSON.parse(script.data) : script.data;
            const isInfluencerProject = parsedData?.is_influencer === true;
            const isPaBrand = parsedData?.is_pa_brand === true;
            const isMine = script.created_by_user_id === user.id || script.writer_id === user.id;

            // Only show non-influencer and non-PA brand scripts in this general tab
            return !isInfluencerInst && !isInfluencerProject && !isPaBrand && isMine;
        });
        setScripts(filteredData);
        setLoading(false);
    };

    const fetchMyScripts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .or(`created_by_user_id.eq.${user.id},writer_id.eq.${user.id}`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            filterAndSetProjects(data || []);
        } catch (error: any) {
            console.error('Error fetching scripts:', error);
            toast.error('Failed to load your scripts');
        } finally {
            setLoading(false);
        }
    };

    const filteredScripts = scripts.filter(script => {
        return script.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (script.brand?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    });

    // Grouping logic for columns (Standard Script Workflow)
    const reworkScripts = filteredScripts.filter(p =>
        p.status === TaskStatus.REWORK &&
        ![WorkflowStage.CINEMATOGRAPHY, WorkflowStage.VIDEO_EDITING].includes(p.current_stage)
    );
    
    const scriptReviewScripts = filteredScripts.filter(p => 
        [WorkflowStage.SCRIPT, WorkflowStage.SCRIPT_REVIEW_L1, WorkflowStage.SCRIPT_REVIEW_L2].includes(p.current_stage) &&
        p.status !== TaskStatus.REWORK && p.status !== TaskStatus.DONE
    );

    const inProductionScripts = filteredScripts.filter(p =>
        [WorkflowStage.CINEMATOGRAPHY, WorkflowStage.VIDEO_EDITING].includes(p.current_stage) &&
        p.status !== TaskStatus.DONE
    );

    const finalReviewScripts = filteredScripts.filter(p => 
        [WorkflowStage.FINAL_REVIEW_CMO, WorkflowStage.FINAL_REVIEW_CEO, WorkflowStage.MULTI_WRITER_APPROVAL].includes(p.current_stage) &&
        p.status !== TaskStatus.REWORK && p.status !== TaskStatus.DONE
    );

    const videoApprovalScripts = filteredScripts.filter(p =>
        p.current_stage === WorkflowStage.WRITER_VIDEO_APPROVAL &&
        p.status !== TaskStatus.REWORK && p.status !== TaskStatus.DONE
    );

    const postedScripts = filteredScripts.filter(p => 
        p.current_stage === WorkflowStage.POSTED && p.status !== TaskStatus.DONE
    );

    const getStageColor = (stage: WorkflowStage, status?: TaskStatus) => {
        if (status === TaskStatus.REWORK) return 'bg-red-600 text-white';
        
        switch (stage) {
            case WorkflowStage.SCRIPT_REVIEW_L1:
            case WorkflowStage.SCRIPT_REVIEW_L2:
                return 'bg-[#0085FF] text-white';
            case WorkflowStage.SENT_TO_INFLUENCER:
            case WorkflowStage.PARTNER_REVIEW:
                return 'bg-[#8B5CF6] text-white';
            case WorkflowStage.CINEMATOGRAPHY:
            case WorkflowStage.VIDEO_EDITING:
            case WorkflowStage.THUMBNAIL_DESIGN:
                return 'bg-[#22C55E] text-white';
            case WorkflowStage.FINAL_REVIEW_CMO:
            case WorkflowStage.FINAL_REVIEW_CEO:
            case WorkflowStage.PA_FINAL_REVIEW:
                return 'bg-[#F59E0B] text-white';
            case WorkflowStage.POSTED:
                return 'bg-[#EC4899] text-white';
            default:
                return 'bg-slate-900 text-white';
        }
    };

    const ScriptCard = ({ project, onClick }: { project: Project, onClick: () => void }) => (

        <div 
            onClick={onClick}
            className={`bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all ${
                project.status === TaskStatus.REWORK &&
                ![WorkflowStage.CINEMATOGRAPHY, WorkflowStage.VIDEO_EDITING].includes(project.current_stage)
                    ? 'bg-red-50'
                    : ''
            }`}
        >
            <div className="flex justify-between items-start gap-2 mb-4 overflow-hidden">
                <span className={`px-2 py-1 text-[9px] font-black uppercase border-2 border-black flex-shrink-0 truncate max-w-[40%] ${
                    project.channel === Channel.YOUTUBE ? 'bg-[#FF4F4F] text-white' :
                    project.channel === Channel.LINKEDIN ? 'bg-[#0085FF] text-white' :
                    'bg-[#D946EF] text-white'
                }`}>
                    {project.channel}
                </span>
                <span className={`px-2 py-1 text-[9px] font-black uppercase border-2 border-black truncate flex-1 text-center min-w-0 ${getStageColor(project.current_stage, project.status)}`} title={STAGE_LABELS[project.current_stage] || project.current_stage}>
                    {STAGE_LABELS[project.current_stage] || project.current_stage}
                </span>
            </div>

            <h4 className="font-black text-lg text-slate-900 mb-1 uppercase leading-tight line-clamp-3">{project.title}</h4>
            
            {project.brand && (
                <div className="mt-1 mb-4">
                    <span className="px-2 py-1 bg-blue-50 text-[#0085FF] border border-blue-200 font-black text-[10px] uppercase tracking-wider">
                        #{project.brand.replace(/_/g, ' ')}
                    </span>
                </div>
            )}

            
            <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-auto border-t-2 border-slate-100 pt-3">
                <Clock className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                <span className="truncate">{format(new Date(project.created_at), 'MMM dd, yyyy')}</span>
            </div>

        </div>
    );

    if (selectedProject) {
        if (selectedProject.status === TaskStatus.REWORK) {
            return (
                <CreateScript
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    onSuccess={() => {
                        setSelectedProject(null);
                        fetchMyScripts();
                        toast.success('Script resubmitted successfully');
                    }}
                    creatorRole={Role.PARTNER_ASSOCIATE}
                />
            );
        }

        return (
            <WriterProjectDetail 
                project={selectedProject} 
                onBack={() => {
                    setSelectedProject(null);
                    fetchMyScripts();
                }} 
                showWorkflowStatus={true} 
                hideActions={false}
                simplifiedView={true}
            />
        );
    }

    return (
        <div className="p-8 max-w-[100rem] mx-auto space-y-8 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-4 border-black pb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => {
                            if (activeTab !== 'kanban') {
                                setActiveTab('kanban');
                            } else {
                                navigate('/partner_associate');
                            }
                        }}
                        className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
                        title={activeTab !== 'kanban' ? "Back to Scripts Kanban" : "Back to Dashboard"}
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">
                        PARTNER SCRIPTS
                    </h1>
                </div>

                <div className="flex flex-wrap gap-3">
                    
                    <button
                        onClick={() => setActiveTab(activeTab === 'video-approval' ? 'kanban' : 'video-approval')}
                        className={`px-5 py-3 border-2 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center space-x-2 ${
                            activeTab === 'video-approval' ? 'bg-[#F59E0B] text-white' : 'bg-white text-[#F59E0B]'
                        }`}
                    >
                        <PlayCircle className="w-4 h-4 flex-shrink-0" />
                        <div className="text-left">
                            <div>Video Approval {videoApprovalScripts.length > 0 && <span className="ml-1 bg-black text-white px-1.5 py-0.5 text-[9px] rounded-full">{videoApprovalScripts.length}</span>}</div>
                            <div className="text-[9px] font-bold opacity-75 normal-case">Writer video approval stage</div>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/partner_associate/script-mywork')}
                        className="px-5 py-3 bg-[#22C55E] text-white border-2 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center space-x-2"
                    >
                        <MessageSquare className="w-4 h-4 flex-shrink-0" />
                        <div className="text-left">
                            <div>My Work</div>
                            <div className="text-[9px] font-bold opacity-75 normal-case">Scripts & history</div>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveTab(activeTab === 'posted' ? 'kanban' : 'posted')}
                        className={`px-5 py-3 border-2 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center space-x-2 ${
                            activeTab === 'posted' ? 'bg-[#EC4899] text-white' : 'bg-white text-[#EC4899]'
                        }`}
                    >
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <div className="text-left">
                            <div>Posted {postedScripts.length > 0 && <span className="ml-1 bg-black text-white px-1.5 py-0.5 text-[9px] rounded-full">{postedScripts.length}</span>}</div>
                            <div className="text-[9px] font-bold opacity-75 normal-case">Published content</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search scripts or brands..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 pr-4 py-3 bg-white border-2 border-black font-bold text-sm focus:outline-none focus:ring-0 w-64 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border-2 border-dashed border-slate-300">
                    <Loader2 className="w-10 h-10 animate-spin text-[#0085FF] mb-4" />
                    <p className="font-black text-slate-400 text-sm tracking-widest uppercase">Fetching Pipeline...</p>
                </div>
            ) : activeTab === 'video-approval' ? (
                <div>
                    {videoApprovalScripts.length === 0 ? (
                        <div className="p-16 text-center font-bold text-slate-400 border-2 border-dashed border-slate-300 uppercase text-xs">
                            No projects awaiting video approval
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {videoApprovalScripts.map(p => (
                                <ScriptCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />
                            ))}
                        </div>
                    )}
                </div>
            ) : activeTab === 'posted' ? (
                <div className="space-y-4">
                    <div className="p-4 bg-[#EC4899] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between">
                        <h3 className="font-black uppercase tracking-wide text-sm">Posted Projects</h3>
                        <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{postedScripts.length}</span>
                    </div>
                    {postedScripts.length === 0 ? (
                        <div className="p-16 text-center font-bold text-slate-400 border-2 border-dashed border-slate-300 uppercase text-xs">
                            No posted projects yet
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {postedScripts.map(p => (
                                <ScriptCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {/* Column 1: Rework */}
                    <div className="space-y-4">
                        <div className="p-4 bg-red-600 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-center justify-between">
                                <h3 className="font-black uppercase tracking-wide text-xs">Rework</h3>
                                <span className="bg-white text-black px-2 py-0.5 font-bold text-[10px] border border-black">{reworkScripts.length}</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {reworkScripts.map(p => (
                                <ScriptCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />
                            ))}
                            {reworkScripts.length === 0 && <div className="p-8 text-center font-bold text-slate-400 border-2 border-dashed border-slate-300 uppercase text-[10px]">No rework</div>}
                        </div>
                    </div>

                    {/* Column 2: Script Review */}
                    <div className="space-y-4">
                        <div className="p-4 bg-[#0085FF] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-black uppercase tracking-wide text-xs">Script Review</h3>
                                    <p className="text-[9px] font-bold opacity-75 mt-0.5">CMO / CEO</p>
                                </div>
                                <span className="bg-white text-black px-2 py-0.5 font-bold text-[10px] border border-black">{scriptReviewScripts.length}</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {scriptReviewScripts.map(p => (
                                <ScriptCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />
                            ))}
                            {scriptReviewScripts.length === 0 && <div className="p-8 text-center font-bold text-slate-400 border-2 border-dashed border-slate-300 uppercase text-[10px]">No reviews</div>}
                        </div>
                    </div>

                    {/* Column 3: In Production */}
                    <div className="space-y-4">
                        <div className="p-4 bg-[#22C55E] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-black uppercase tracking-wide text-xs">In Production</h3>
                                    <p className="text-[9px] font-bold opacity-75 mt-0.5">Cine / Editor</p>
                                </div>
                                <span className="bg-white text-black px-2 py-0.5 font-bold text-[10px] border border-black">{inProductionScripts.length}</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {inProductionScripts.map(p => (
                                <ScriptCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />
                            ))}
                            {inProductionScripts.length === 0 && <div className="p-8 text-center font-bold text-slate-400 border-2 border-dashed border-slate-300 uppercase text-[10px]">No production</div>}
                        </div>
                    </div>

                    {/* Column 4: Final Review */}
                    <div className="space-y-4">
                        <div className="p-4 bg-[#F59E0B] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-black uppercase tracking-wide text-xs">Final Review</h3>
                                    <p className="text-[9px] font-bold opacity-75 mt-0.5">CMO / CEO</p>
                                </div>
                                <span className="bg-white text-black px-2 py-0.5 font-bold text-[10px] border border-black">{finalReviewScripts.length}</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {finalReviewScripts.map(p => (
                                <ScriptCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />
                            ))}
                            {finalReviewScripts.length === 0 && <div className="p-8 text-center font-bold text-slate-400 border-2 border-dashed border-slate-300 uppercase text-[10px]">No final reviews</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PAScripts;
