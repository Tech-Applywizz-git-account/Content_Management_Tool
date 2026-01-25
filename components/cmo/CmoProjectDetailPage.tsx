import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Project, Role } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import { db } from '../../services/supabaseDb';
import CmoReviewScreen from './CmoReviewScreen';
import CmoProjectDetails from './CmoProjectDetails';
import CmoHistoryDetail from './CmoHistoryDetail';

const CmoProjectDetailPage: React.FC<{ user: { id: string; full_name: string; role: Role }; onLogout: () => void }> = ({ user, onLogout }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<any>(null);

    const path = location.pathname;
    const isReview = path.includes('/review/');
    const isHistory = path.includes('/history_detail/');

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
                    // Fetch history entry if in history view
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
                        onClick={() => navigate('/cmo')}
                        className="w-full bg-[#D946EF] border-2 border-black px-6 py-3 text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const handleBack = () => {
        navigate(-1);
    };

    if (isReview) {
        return (
            <CmoReviewScreen
                project={project}
                onBack={handleBack}
                onComplete={handleBack}
            />
        );
    }

    if (isHistory) {
        return (
            <CmoHistoryDetail
                project={project}
                history={selectedHistory}
                onBack={handleBack}
                currentUser={user}
                onEdit={() => navigate(`/cmo/review/${project.id}`)}
            />
        );
    }

    return (
        <CmoProjectDetails
            project={project}
            onBack={handleBack}
        />
    );
};

export default CmoProjectDetailPage;
