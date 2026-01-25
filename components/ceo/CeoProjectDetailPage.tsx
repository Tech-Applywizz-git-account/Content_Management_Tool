import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Project, Role, WorkflowStage, STAGE_LABELS } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import CeoReviewScreen from './CeoReviewScreen';
import Layout from '../Layout';

const CeoProjectDetailPage: React.FC<{ user: { id: string; full_name: string; role: Role }; onLogout: () => void }> = ({ user, onLogout }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
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
                setLoading(true);
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', projectId)
                    .single();

                if (error) throw error;
                if (!data) {
                    setError('Project not found');
                    return;
                }

                setProject(data as Project);

                if (isHistory) {
                    // Fetch history entry
                    const { data: historyData } = await supabase
                        .from('workflow_history')
                        .select('*')
                        .eq('project_id', projectId)
                        .eq('actor_id', user.id)
                        .eq('action', 'APPROVED')
                        .maybeSingle();

                    if (historyData) {
                        setSelectedHistory(historyData);
                    }
                }
            } catch (err) {
                console.error('Error loading project:', err);
                setError('Failed to load project');
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [projectId, isHistory, user.id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#D946EF] border-t-transparent"></div>
            </div>
        );
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
                onComplete={() => navigate(-1)}
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
            <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="font-bold underline"
                    >
                        ← Back to History
                    </button>
                    {selectedHistory?.actor_id === user.id && (
                        <button
                            onClick={() => navigate(`/ceo/review/${project.id}`)}
                            className="px-4 py-2 bg-[#0085FF] text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            Edit
                        </button>
                    )}
                </div>

                <h1 className="text-3xl font-black uppercase">
                    {project.title} - Approved
                </h1>
                <p className="text-slate-600">
                    Approved on {selectedHistory?.timestamp ? new Date(selectedHistory.timestamp).toLocaleString() : 'Unknown date'}
                </p>

                {/* SCRIPT CONTENT */}
                <div className="border-2 border-black p-4 bg-slate-100">
                    <h3 className="font-black uppercase mb-2">Script Content</h3>
                    {project.data?.script_content
                        ? (() => {
                            let decodedContent = project.data.script_content
                                .replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>')
                                .replace(/&amp;/g, '&')
                                .replace(/&quot;/g, '"')
                                .replace(/&#39;/g, "'")
                                .replace(/&nbsp;/g, ' ');
                            return <div className="whitespace-pre-wrap text-sm" dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                        })()
                        : <p>No script</p>
                    }
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
                <div className="border-2 border-black p-4 flex justify-between">
                    <div>
                        <p><strong>Creator:</strong> {creatorName}</p>
                        <p><strong>Approved By:</strong> {selectedHistory?.actor_name}</p>
                        <p><strong>Stage:</strong> {STAGE_LABELS[selectedHistory?.stage as WorkflowStage] || selectedHistory?.stage}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-black text-green-600">
                            Approved
                        </p>
                        <p className="text-sm text-slate-500">
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
