import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Project, User, WorkflowStage } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import PAInfluencerPortfolio from './PAInfluencerPortfolio';
import PAStoryInfluencerDetails from './PAStoryInfluencerDetails';

interface PAInfluencerPortfolioPageProps {
    user: User;
    onLogout: () => void;
    refreshData: (user: User) => Promise<void>;
}

const PAInfluencerPortfolioPage: React.FC<PAInfluencerPortfolioPageProps> = ({ user, refreshData }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams] = useSearchParams();
    const influencerNameParam = searchParams.get('name');
    const navigate = useNavigate();

    const [influencerProjects, setInfluencerProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [brandData, setBrandData] = useState<any>(null);

    useEffect(() => {
        const fetchBrandInfo = async () => {
            const currentProject = influencerProjects.find(p => p.id === projectId) || influencerProjects[0];
            const bName = currentProject?.data?.brand || currentProject?.brandSelected || currentProject?.brand;
            
            if (bName) {
                const { data } = await supabase.from('brands').select('*').eq('brand_name', bName).single();
                if (data) setBrandData(data);
            }
        };

        if (influencerProjects.length > 0) {
            fetchBrandInfo();
        }
    }, [influencerProjects, projectId]);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                setLoading(true);
                
                // 1. Fetch ALL PA projects for this user
                const { data: allPaProjects, error: fetchError } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('data->>is_pa_brand', 'true')
                    .order('created_at', { ascending: false });

                if (fetchError) throw fetchError;

                let targetInfluencerName = '';
                let matchingProjects: Project[] = [];

                if (projectId && projectId !== 'new') {
                    // Find by ID
                    const targetProject = (allPaProjects || []).find(p => p.id === projectId);
                    if (targetProject) {
                        targetInfluencerName = (targetProject.data?.influencer_name || '').toLowerCase().trim();
                    }
                } else if (influencerNameParam) {
                    // Use name from query param
                    targetInfluencerName = influencerNameParam.toLowerCase().trim();
                }

                if (targetInfluencerName) {
                    matchingProjects = (allPaProjects || []).filter(p => {
                        const pName = (p.data?.influencer_name || '').toLowerCase().trim();
                        const pTitle = (p.title || '').toLowerCase().trim();
                        return pName === targetInfluencerName || pTitle.includes(targetInfluencerName);
                    });
                }

                // 2. If no projects found but we have a name, fetch from registry to create a dummy
                if (matchingProjects.length === 0 && targetInfluencerName) {
                    const { data: regData } = await supabase
                        .from('influencers')
                        .select('*')
                        .ilike('influencer_name', targetInfluencerName)
                        .single();
                    
                    if (regData) {
                        // Create a dummy project object for the UI to render
                        const dummyProject: any = {
                            id: 'temp-' + Date.now(),
                            title: `DRAFT: ${regData.influencer_name}`,
                            current_stage: WorkflowStage.PARTNER_REVIEW,
                            data: {
                                influencer_name: regData.influencer_name,
                                influencer_email: regData.influencer_email,
                                is_pa_brand: true,
                                brand: regData.brand_name
                            },
                            created_at: new Date().toISOString()
                        };
                        matchingProjects = [dummyProject];
                    }
                }

                if (matchingProjects.length === 0) {
                    throw new Error('Influencer profile not found');
                }

                setInfluencerProjects(matchingProjects as Project[]);
            } catch (err) {
                console.error('Error fetching project data:', err);
                setError('Failed to load influencer portfolio.');
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [projectId, influencerNameParam]);

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
    const isStoryBrand = brandData?.brand_type === 'STORY' || influencerProjects[0]?.data?.brand_type === 'STORY';

    if (isStoryBrand) {
        // Find the actual influencer ID from the project or registry
        return (
            <PAStoryInfluencerDetails 
                influencerId={currentProject.data?.influencer_id || (projectId?.startsWith('temp-') ? null : projectId) || ''}
                brandName={brandData?.brand_name || currentProject.data?.brand || ''}
                influencerName={currentProject.data?.influencer_name || ''}
                user={user}
                onBack={handleBack}
                onComplete={handleComplete}
            />
        );
    }

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
