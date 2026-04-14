import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Project, Role, WorkflowStage, STAGE_LABELS } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import CeoReviewScreen from './CeoReviewScreen';
import Layout from '../Layout';
import ScriptDisplay from '../ScriptDisplay';

const CeoProjectDetailPage: React.FC<{
    user: { id: string; full_name: string; role: Role };
    onLogout: () => void;
    onRefresh?: () => void;
    projects?: Project[];
}> = ({ user, onLogout, onRefresh, projects = [] }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // Instant UI: Find project in cache first
    const cachedProject = projects.find(p => p.id === projectId);
    const [project, setProject] = useState<Project | null>(cachedProject || null);
    const [loading, setLoading] = useState(!cachedProject);
    const [error, setError] = useState<string | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<any>(null);

    const path = location.pathname;
    const isHistory = path.includes('/history/');

    useEffect(() => {
        const loadProject = async () => {
            if (!projectId) {
                setError('No project ID provided');
                setLoading(false);
                return;
            }

            try {
                // Background fetch - don't show spinner if we have cached data
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', projectId)
                    .single();

                if (error) throw error;
                if (!data) {
                    if (!project) setError('Project not found');
                    return;
                }

                setProject(data as Project);

                if (isHistory) {
                    // Fetch history entry
                    const { data: historyRecords } = await supabase
                        .from('workflow_history')
                        .select('*')
                        .eq('project_id', projectId)
                        .eq('actor_id', user.id)
                        .in('action', ['APPROVED', 'SUBMITTED'])
                        .order('timestamp', { ascending: false });

                    if (historyRecords && historyRecords.length > 0) {
                        setSelectedHistory(historyRecords[0]);
                    }
                }
            } catch (err) {
                console.error('Error loading project:', err);
                if (!project) setError('Failed to load project');
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [projectId, isHistory, user.id]);

    // Only block if we have NO data AND we're still loading
    if (loading && !project) {
        return null; // Instant UI
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center max-w-md bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <h1 className="text-2xl font-black text-slate-900 mb-4 uppercase">Error</h1>
                    <p className="text-slate-600 mb-6 font-bold">{error || 'Project not found'}</p>
                    <button
                        onClick={() => navigate('/ceo')}
                        className="w-full bg-[#D946EF] border-2 border-black px-6 py-3 text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!isHistory) {
        return (
            <CeoReviewScreen
                project={project}
                onBack={() => navigate(-1)}
                onComplete={() => {
                    // Refresh the dashboard data before navigating back
                    if (onRefresh) {
                        onRefresh();
                    }
                    navigate(-1);
                }}
                user={user}
            />
        );
    }

    // History Detail View (Ported from CeoDashboard.tsx)
    const creatorName =
        project.data?.cmo_name ||
        project.data?.writer_name ||
        project.cmo_name ||
        project.writer_name ||
        'Unknown Creator';

    return (
        <Layout user={user as any} onLogout={onLogout} onOpenCreate={() => { }}>
            <div className="p-4 md:p-8 space-y-4 md:space-y-6">
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="font-bold underline text-sm md:text-base"
                    >
                        ← Back to History
                    </button>
                    {selectedHistory?.actor_id === user.id && (
                        <button
                            onClick={() => navigate(`/ceo/review/${project.id}`)}
                            className="px-4 py-2 bg-[#0085FF] text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all text-sm"
                        >
                            Edit
                        </button>
                    )}
                </div>

                <h1 className="text-xl md:text-3xl font-black uppercase">
                    {project.title} - Approved
                </h1>
                <p className="text-slate-600 text-sm md:text-base">
                    Approved on {selectedHistory?.timestamp ? new Date(selectedHistory.timestamp).toLocaleString() : 'Unknown date'}
                </p>

                {/* SCRIPT CONTENT */}
                <div className="border-2 border-black p-4 bg-slate-100">
                    <h3 className="font-black uppercase mb-2">Script Content</h3>
                    <ScriptDisplay 
                        content={project.data?.script_content || ''} 
                        caption={project.data?.captions}
                        showBox={false} 
                    />
                </div>

                {/* CEO COMMENT */}
                {selectedHistory?.comment && (
                    <div className="border-2 border-black p-4 bg-yellow-50">
                        <h3 className="font-black uppercase mb-2">CEO Comment</h3>
                        <p>{selectedHistory.comment}</p>
                    </div>
                )}

                {/* REJECTION REASON */}
                {selectedHistory?.action === 'REJECTED' && selectedHistory?.comment && (
                    <div className="border-2 border-black p-4 bg-red-50">
                        <h3 className="font-black uppercase mb-2 text-red-800">Rejection Reason</h3>
                        <p className="text-red-700">{selectedHistory.comment}</p>
                    </div>
                )}

                {/* ACTION DETAILS */}
                <div className="border-2 border-black p-4 md:p-6 flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-sm md:text-base"><strong>Creator:</strong> {creatorName}</p>
                        <p className="text-sm md:text-base"><strong>Approved By:</strong> {selectedHistory?.actor_name}</p>
                        <p className="text-sm md:text-base"><strong>Stage:</strong> {STAGE_LABELS[selectedHistory?.stage as WorkflowStage] || selectedHistory?.stage}</p>
                        {project.brand && <p className="text-sm md:text-base"><strong>Brand:</strong> <span className="font-black text-[#0085FF] uppercase">{project.brand.replace(/_/g, ' ')}</span></p>}
                        {project.data?.niche && (
                            <p className="text-sm md:text-base">
                                <strong>Niche:</strong> <span className="uppercase">{project.data.niche === 'PROBLEM_SOLVING' ? 'Problem Solving'
                                    : project.data.niche === 'SOCIAL_PROOF' ? 'Social Proof'
                                        : project.data.niche === 'LEAD_MAGNET' ? 'Lead Magnet'
                                            : project.data.niche === 'CAPTION_BASED' ? 'Caption Based'
                                                : project.data.niche === 'OTHER' && project.data.niche_other
                                                    ? project.data.niche_other
                                                    : project.data.niche}</span>
                            </p>
                        )}
                        {project.data?.influencer_name && <p className="text-sm md:text-base"><strong>Influencer:</strong> {project.data.influencer_name}</p>}
                        {project.data?.referral_link && (
                            <p className="text-sm md:text-base">
                                <strong>Referral Link:</strong> <a href={project.data.referral_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View Link</a>
                            </p>
                        )}
                    </div>
                    <div className="md:text-right">
                        <p className="font-black text-green-600 uppercase">
                            Approved
                        </p>
                        <p className="text-xs md:text-sm text-slate-500">
                            {selectedHistory?.timestamp
                                ? new Date(selectedHistory.timestamp).toLocaleString()
                                : ''}
                        </p>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default CeoProjectDetailPage;
