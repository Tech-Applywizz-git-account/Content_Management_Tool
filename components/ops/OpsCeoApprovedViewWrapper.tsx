import React, { useEffect, useState } from 'react';
import { Project } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import OpsCeoApprovedView from './OpsCeoApprovedView';
import { useParams, useNavigate } from 'react-router-dom';

interface Props {
    user: any;
    onLogout: () => void;
}

const OpsCeoApprovedViewWrapper: React.FC<Props> = ({ user, onLogout }) => {
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProject = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', projectId)
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Project not found');

                setProject(data as Project);
            } catch (err) {
                console.error('Error fetching project:', err);
                setError(err instanceof Error ? err.message : 'Failed to load project');
            } finally {
                setLoading(false);
            }
        };

        if (projectId) {
            fetchProject();
        }
    }, [projectId]);

    const handleBack = () => {
        // Navigate back to the CEO approved page
        navigate('/ops/ceoapproved');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white font-sans flex flex-col items-center justify-center">
                <div className="text-center">
                    <div className="text-xl font-black text-slate-900 uppercase mb-4">Loading Project...</div>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-white font-sans flex flex-col items-center justify-center">
                <div className="text-center">
                    <div className="text-xl font-black text-slate-900 uppercase mb-4">Error Loading Project</div>
                    <div className="text-slate-600 mb-6">{error || 'Project not found'}</div>
                    <button
                        onClick={handleBack}
                        className="bg-[#D946EF] text-white px-6 py-3 font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        ← Back to CEO Approved
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <OpsCeoApprovedView project={project} onBack={handleBack} />
        </div>
    );
};

export default OpsCeoApprovedViewWrapper;