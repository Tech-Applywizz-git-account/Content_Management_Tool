import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, Role } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import CmoProjectDetails from './CmoProjectDetails';
import Layout from '../Layout';

const CmoProjectDetailPage: React.FC<{
    user: { full_name: string; role: Role };
    onLogout: () => void;
    projects?: Project[];
}> = ({ user, onLogout, projects = [] }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    // Instant UI: Find project in cache first
    const cachedProject = projects.find(p => p.id === projectId);
    const [project, setProject] = useState<Project | null>(cachedProject || null);
    const [loading, setLoading] = useState(!cachedProject);
    const [error, setError] = useState<string | null>(null);

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
                    .select('*, workflow_history(*)')
                    .eq('id', projectId)
                    .single();

                if (error) throw error;
                if (!data) {
                    if (!project) setError('Project not found');
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
    }, [projectId]);

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
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => { }}
            activeView="mywork"
            onChangeView={(view) => {
                if (view === 'dashboard') navigate('/cmo');
                else navigate(`/cmo/${view}`);
            }}
        >
            <CmoProjectDetails
                project={project}
                onBack={() => navigate(-1)}
                onUpdate={() => {
                    // Refresh the current page after update
                    window.location.reload();
                }}
            />
        </Layout>
    );
};

export default CmoProjectDetailPage;