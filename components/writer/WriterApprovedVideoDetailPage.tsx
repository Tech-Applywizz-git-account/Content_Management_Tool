import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, Role } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import WriterApprovedVideoDetail from './WriterApprovedVideoDetail';

interface WriterApprovedVideoDetailPageProps {
    user: {
        id: string;
        email?: string;
        full_name?: string;
        role: Role;
    };
    onLogout: () => void;
    projects?: Project[];
}

const WriterApprovedVideoDetailPage: React.FC<WriterApprovedVideoDetailPageProps> = ({ user, onLogout, projects = [] }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    // Instant UI: Find project in cache first
    const cachedProject = projects.find(p => p.id === projectId);
    const [project, setProject] = useState<Project | null>(cachedProject || null);
    const [loading, setLoading] = useState(!cachedProject);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProject = async () => {
            if (!projectId) return;

            try {
                // Background fetch - don't show spinner if we have cached data
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', projectId)
                    .single();

                if (error) throw error;
                if (data) {
                    setProject(data as Project);
                }
            } catch (err) {
                console.error('Error fetching project:', err);
                if (!project) setError('Failed to load project details.');
            } finally {
                setLoading(false);
            }
        };

        fetchProject();
    }, [projectId]);

    const handleBack = () => {
        navigate(-1);
    };

    // Only block if we have NO data AND we're still loading
    if (loading && !project) {
        return null; // Instant UI
    }

    if (error || !project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center max-w-md p-8 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h2 className="text-2xl font-black uppercase text-slate-900 mb-4">Error</h2>
                    <p className="text-slate-600 mb-6">{error || 'Project not found.'}</p>
                    <button
                        onClick={handleBack}
                        className="bg-[#D946EF] border-2 border-black px-6 py-2 text-white font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <WriterApprovedVideoDetail
            project={project}
            onBack={handleBack}
        />
    );
};

export default WriterApprovedVideoDetailPage;
