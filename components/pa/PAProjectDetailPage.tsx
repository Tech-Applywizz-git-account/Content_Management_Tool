import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, Role, User } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import PAInfluencerManagement from './PAInfluencerManagement';

interface PAProjectDetailPageProps {
    user: User;
    onLogout: () => void;
    projects?: Project[];
    refreshData: (user: User) => Promise<void>;
}

const PAProjectDetailPage: React.FC<PAProjectDetailPageProps> = ({ user, projects = [], refreshData }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    const [influencerProjects, setInfluencerProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!projectId) return;

            try {
                setLoading(true);
                
                // 1. Fetch ALL projects that are marked as PA Brand projects
                // We fetch all to ensure we can do complex filtering locally that matches PAMyWork logic
                const { data: allPaProjects, error: fetchError } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('data->>is_pa_brand', 'true')
                    .order('created_at', { ascending: false });

                if (fetchError) throw fetchError;
                if (!allPaProjects || allPaProjects.length === 0) throw new Error('No PA projects found');

                // 2. Find the target project
                const targetProject = allPaProjects.find(p => p.id === projectId);
                if (!targetProject) throw new Error('Target project not found');

                // 3. Find related projects using parent_script_id link
                const parentId = targetProject.data?.parent_script_id || targetProject.id;
                
                const matchingProjects = allPaProjects.filter(p => {
                    const projectParentId = p.data?.parent_script_id || p.id;
                    return projectParentId === parentId;
                });

                setInfluencerProjects(matchingProjects as Project[]);
            } catch (err) {
                console.error('Error fetching project data:', err);
                setError('Failed to load project details.');
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [projectId]);

    const handleBack = () => {
        navigate(-1);
    };

    const handleComplete = async () => {
        await refreshData(user);
        window.location.reload(); 
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-slate-100 border-t-[#0085FF] rounded-full animate-spin"></div>
                    <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">Loading Influencer Hub...</p>
                </div>
            </div>
        );
    }

    if (error || influencerProjects.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FDFCF6]">
                <div className="text-center max-w-md p-10 bg-white border border-slate-200 shadow-md">
                    <h2 className="text-2xl font-black uppercase text-slate-900 mb-4 tracking-tighter">Error Occurred</h2>
                    <p className="text-slate-500 font-bold mb-8 text-sm uppercase">{error || 'Influencer data not found.'}</p>
                    <button
                        onClick={handleBack}
                        className="bg-slate-900 px-8 py-3 text-white font-black uppercase text-xs tracking-widest shadow-sm hover:bg-black transition-all"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <PAInfluencerManagement
            project={influencerProjects.find(p => p.id === projectId) || influencerProjects[0]}
            allInfluencerProjects={influencerProjects}
            user={user}
            onBack={handleBack}
            onComplete={handleComplete}
        />
    );
};

export default PAProjectDetailPage;
