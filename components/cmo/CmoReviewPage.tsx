import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Project, Role } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import CmoReviewScreen from './CmoReviewScreen';

interface CmoReviewPageProps {
    user: { full_name: string; role: Role };
    onLogout: () => void;
    refreshData: (user: any) => Promise<void>;
}

const CmoReviewPage: React.FC<CmoReviewPageProps> = ({ user, onLogout, refreshData }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // Check if project data was passed in location state for immediate display
    const initialProject = (location.state as any)?.initialProject as Project | undefined;

    const [project, setProject] = useState<Project | null>(initialProject || null);
    const [loading, setLoading] = useState(!initialProject);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadProject = async () => {
            if (!projectId) {
                setError('No project ID provided');
                setLoading(false);
                return;
            }

            // If we already have the project with history from state, we can skip the blocking fetch
            if (initialProject && (initialProject as any).history) {
                setLoading(false);
                return;
            }

            try {
                // Only show loading spinner if we don't have an initial project to show
                if (!initialProject) {
                    setLoading(true);
                }

                const { data, error } = await supabase
                    .from('projects')
                    .select('*, workflow_history(*)')
                    .eq('id', projectId)
                    .single();

                if (error) throw error;
                if (!data) {
                    setError('Project not found');
                    return;
                }

                // Map workflow_history to history property expected by Timeline
                const projectWithHistory = {
                    ...data,
                    history: data.workflow_history
                };

                setProject(projectWithHistory as Project);
            } catch (err) {
                console.error('Error loading project:', err);
                if (!project) setError('Failed to load project');
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [projectId, initialProject]);

    const handleBack = () => {
        const from = (location.state as any)?.from || '/cmo';
        navigate(from);
    };

    const handleComplete = async () => {
        // Explicitly trigger a data refresh to ensure the dashboard is up-to-date
        // before navigating back, so the project moves columns immediately
        if (refreshData && user) {
            await refreshData(user);
        }
        const from = (location.state as any)?.from || '/cmo';
        navigate(from);
    };

    if (loading && !project) {
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

    return (
        <div className="min-h-screen bg-white">
            <CmoReviewScreen
                project={project}
                onBack={handleBack}
                onComplete={handleComplete}
            />
        </div>
    );
};

export default CmoReviewPage;