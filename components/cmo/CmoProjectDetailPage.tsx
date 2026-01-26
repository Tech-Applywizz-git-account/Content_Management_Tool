import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Project, Role } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import { db } from '../../services/supabaseDb';
import CmoReviewScreen from './CmoReviewScreen';
import CmoProjectDetails from './CmoProjectDetails';
import CmoHistoryDetail from './CmoHistoryDetail';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';

const CmoProjectDetailPage: React.FC<{ user: { id: string; full_name: string; role: Role }; onLogout: () => void }> = ({ user, onLogout }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { navigateWithScroll } = useScrollRestoration();
    const [project, setProject] = useState<Project | null>(location.state?.initialProject || null);
    const [selectedHistory, setSelectedHistory] = useState<any>(null);

    const path = location.pathname;
    const isReview = path.includes('/review/');
    const isHistory = path.includes('/history_detail/');

    useEffect(() => {
        const loadProject = async () => {
            if (!projectId) {
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', projectId)
                    .single();

                if (error) throw error;
                if (!data) {
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
            }
        };

        loadProject();
    }, [projectId, isHistory, user.id]);


    const handleBack = () => {
        navigate(-1);
    };

    // Show loading spinner while project loads
    if (!project) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg font-black uppercase text-slate-900">Loading Project...</p>
                </div>
            </div>
        );
    }

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

    // Default project details view
    return (
        <CmoProjectDetails
            project={project}
            onBack={handleBack}
        />
    );
};

export default CmoProjectDetailPage;
