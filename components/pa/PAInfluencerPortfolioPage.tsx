import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, User } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import PAInfluencerPortfolio from './PAInfluencerPortfolio';

interface PAInfluencerPortfolioPageProps {
    user: User;
    onLogout: () => void;
    refreshData: (user: User) => Promise<void>;
}

const PAInfluencerPortfolioPage: React.FC<PAInfluencerPortfolioPageProps> = ({ user, refreshData }) => {
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
                const { data: allPaProjects, error: fetchError } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('data->>is_pa_brand', 'true')
                    .eq('assigned_to_user_id', user.id) // Properly filter by current user
                    .order('created_at', { ascending: false });

                if (fetchError) throw fetchError;
                if (!allPaProjects || allPaProjects.length === 0) throw new Error('No PA projects found');

                // 2. Find the target project to get the influencer name
                const targetProject = allPaProjects.find(p => p.id === projectId);
                if (!targetProject) throw new Error('Target project not found');

                const influencerName = (
                    targetProject.data?.influencer_name || 
                    (targetProject as any).influencer_name || 
                    ''
                ).toLowerCase().trim();

                if (influencerName) {
                    // 3. Filter projects matching this influencer
                    const matchingProjects = allPaProjects.filter(p => {
                        const projInfluencerName = (
                            p.data?.influencer_name || 
                            (p as any).influencer_name || 
                            ''
                        ).toLowerCase().trim();
                        return projInfluencerName === influencerName;
                    });
                    setInfluencerProjects(matchingProjects as Project[]);
                } else {
                    setInfluencerProjects([targetProject as Project]);
                }
            } catch (err) {
                console.error('Error fetching project data:', err);
                setError('Failed to load influencer portfolio.');
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
            <div className="min-h-screen flex items-center justify-center bg-white font-sans">
                <div className="flex flex-col items-center gap-6">
                    <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="space-y-2 text-center">
                        <p className="font-black uppercase text-sm tracking-widest text-slate-900">Entering Partnership Hub</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] animate-pulse">Syncing Executive Analytics...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || influencerProjects.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="text-center max-w-md w-full p-10 bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-3xl font-black uppercase text-slate-900 mb-2">Portfolio Error</h2>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-8">{error || 'Influencer data not found.'}</p>
                    <button
                        onClick={handleBack}
                        className="w-full bg-black text-white px-8 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-none transition-all"
                    >
                        Return to Workspace
                    </button>
                </div>
            </div>
        );
    }

    const currentProject = influencerProjects.find(p => p.id === projectId) || influencerProjects[0];

    return (
        <PAInfluencerPortfolio
            project={currentProject}
            allInfluencerProjects={influencerProjects}
            user={user}
            onBack={handleBack}
            onComplete={handleComplete}
        />
    );
};

export default PAInfluencerPortfolioPage;
