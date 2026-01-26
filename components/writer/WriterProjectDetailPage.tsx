import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, Role } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import WriterProjectDetail from './WriterProjectDetail';

interface WriterProjectDetailPageProps {
    user: {
        id: string;
        email?: string;
        full_name?: string;
        role: Role;
    };
    onLogout: () => void;
}

const WriterProjectDetailPage: React.FC<WriterProjectDetailPageProps> = ({ user, onLogout }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProject = async () => {
            if (!projectId) return;

            try {
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
                setError('Failed to load project details.');
            } finally {
                setLoading(false);
            }
        };

        fetchProject();
    }, [projectId]);

    const handleBack = () => {
        navigate(-1);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-lg font-black uppercase text-slate-900">Loading Project...</p>
                </div>
            </div>
        );
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
        <WriterProjectDetail
            project={project}
            onBack={handleBack}
        />
    );
};

export default WriterProjectDetailPage;
