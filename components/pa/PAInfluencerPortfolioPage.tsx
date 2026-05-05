import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const influencerNameParam = searchParams.get('name');
    const influencerIdParam = searchParams.get('inf_id');
    const navigate = useNavigate();
    const passedState = location.state as { influencer?: any, brandType?: string } | null;

    const [influencerProjects, setInfluencerProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(!passedState?.influencer);
    const [error, setError] = useState<string | null>(null);
    const [brandData, setBrandData] = useState<any>(passedState?.brandType ? { brand_type: passedState.brandType } : null);

    // If we have passed state, initialize projects with it immediately
    useEffect(() => {
        if (passedState?.influencer) {
            console.log('🚀 Using passed state for immediate render');
            const inf = passedState.influencer;
            
            // Create a pseudo-project from the influencer data if needed, 
            // but usually influencer data contains project info if merged in PABrandDetails
            const pseudoProject: any = {
                id: inf.project_id || (projectId?.startsWith('temp-') ? projectId : 'new'),
                title: inf.influencer_name,
                current_stage: inf.project_status || WorkflowStage.PARTNER_REVIEW,
                data: {
                    influencer_name: inf.influencer_name,
                    influencer_email: inf.influencer_email,
                    brand: inf.brand_name,
                    registry_id: inf.id,
                    is_pa_brand: true
                },
                created_at: inf.created_at
            };
            setInfluencerProjects([pseudoProject]);
        }
    }, []);

    useEffect(() => {
        const fetchBrandInfo = async () => {
            const currentProject = influencerProjects.find(p => p.id === projectId) || influencerProjects[0];
            const pData = typeof currentProject?.data === 'string' ? JSON.parse(currentProject.data) : currentProject?.data;
            const pMetadata = typeof currentProject?.metadata === 'string' ? JSON.parse(currentProject.metadata) : currentProject?.metadata;
            
            const bName = pData?.brand || pMetadata?.brand || currentProject?.brandSelected || currentProject?.brand;
            
            if (bName) {
                const { data } = await supabase.from('brands').select('*').eq('brand_name', bName).maybeSingle();
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
                // Loading is handled by initial state; background fetch shouldn't trigger global loading screen
                
                // 1. Fetch the primary influencer registry record first if we have an ID
                let canonicalName = influencerNameParam?.toLowerCase().trim() || '';
                let canonicalEmail = '';
                let registryRecord: any = null;

                if (influencerIdParam) {
                    const { data } = await supabase
                        .from('influencers')
                        .select('*')
                        .eq('id', influencerIdParam)
                        .maybeSingle();
                    if (data) {
                        registryRecord = data;
                        canonicalName = (data.influencer_name || '').toLowerCase().trim();
                        canonicalEmail = (data.influencer_email || '').toLowerCase().trim();
                    }
                }

                // 2. Fetch ALL projects and filter by is_pa_brand in JS (checks both data and metadata)
                const { data: allProjects, error: fetchError } = await supabase
                    .from('projects')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (fetchError) throw fetchError;

                // Filter for PA brand projects (check both data and metadata columns)
                const allPaProjects = (allProjects || []).filter(p => {
                    try {
                        const pData = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
                        const pMetadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
                        return pData?.is_pa_brand === true || pMetadata?.is_pa_brand === true;
                    } catch (e) {
                        return false;
                    }
                });

                // 2b. If canonicalName is still empty but we have a projectId, try to find it in allPaProjects
                if (!canonicalName && !canonicalEmail && projectId) {
                    const referenceProject = allPaProjects.find(p => p.id === projectId);
                    if (referenceProject) {
                        try {
                            const pData = typeof referenceProject.data === 'string' ? JSON.parse(referenceProject.data) : referenceProject.data;
                            const pMetadata = typeof referenceProject.metadata === 'string' ? JSON.parse(referenceProject.metadata) : referenceProject.metadata;
                            canonicalName = (pData?.influencer_name || pMetadata?.influencer_name || '').toLowerCase().trim();
                            canonicalEmail = (pData?.influencer_email || pMetadata?.influencer_email || '').toLowerCase().trim();
                        } catch (e) {
                            console.warn('Error parsing reference project JSON');
                        }
                    }
                }

                // 3. Filter projects strictly by name or email
                let matchingProjects: Project[] = [];
                if (canonicalName || canonicalEmail) {
                    matchingProjects = allPaProjects.filter(p => {
                        try {
                            const pData = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
                            const pMetadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
                            
                            const pName = (pData?.influencer_name || pMetadata?.influencer_name || '').toLowerCase().trim();
                            const pEmail = (pData?.influencer_email || pMetadata?.influencer_email || '').toLowerCase().trim();
                            
                            // Strict exact matching to avoid "Testing" matching "Harshitha Testing"
                            const nameMatch = canonicalName && pName === canonicalName;
                            const emailMatch = canonicalEmail && pEmail === canonicalEmail;
                            
                            return nameMatch || emailMatch;
                        } catch (e) {
                            return false;
                        }
                    });
                }

                // 4. If no projects found, create a dummy one from the registry record
                if (matchingProjects.length === 0) {
                    // If we didn't have a registryRecord yet (e.g. no inf_id but have name), try to find one
                    if (!registryRecord && canonicalName) {
                        const { data } = await supabase
                            .from('influencers')
                            .select('*')
                            .ilike('influencer_name', canonicalName)
                            .maybeSingle();
                        registryRecord = data;
                    }
                    
                    if (registryRecord) {
                        const dummyProject: any = {
                            id: 'temp-' + Date.now(),
                            title: `DRAFT: ${registryRecord.influencer_name}`,
                            current_stage: WorkflowStage.PARTNER_REVIEW,
                            data: {
                                influencer_name: registryRecord.influencer_name,
                                influencer_email: registryRecord.influencer_email,
                                is_pa_brand: true,
                                brand: registryRecord.brand_name,
                                registry_id: registryRecord.id,
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
                setLoading(false);
            }
        };

        fetchAllData();
    }, [projectId, influencerNameParam, influencerIdParam]);

    const handleBack = () => {
        navigate(-1);
    };

    const handleComplete = async () => {
        await refreshData(user);
        window.location.reload(); 
    };

    const currentProject = influencerProjects.find(p => p.id === projectId) || influencerProjects[0];

    if (!currentProject && loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white font-sans">
                <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
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


    let pDataFirst = influencerProjects[0]?.data;
    try {
        if (typeof pDataFirst === 'string') pDataFirst = JSON.parse(pDataFirst);
    } catch (e) {
        console.warn('Error parsing first project data');
    }
    const isStoryBrand = passedState?.brandType === 'STORY' || brandData?.brand_type === 'STORY' || pDataFirst?.brand_type === 'STORY';

    if (isStoryBrand) {
        // Find the actual influencer ID from the project or registry
        let pDataCurrent = currentProject.data;
        let pMetadataCurrent = currentProject.metadata;
        try {
            if (typeof pDataCurrent === 'string') pDataCurrent = JSON.parse(pDataCurrent);
            if (typeof pMetadataCurrent === 'string') pMetadataCurrent = JSON.parse(pMetadataCurrent);
        } catch (e) {
            console.warn('Error parsing current project JSON');
        }

        return (
            <PAStoryInfluencerDetails 
                influencerId={pDataCurrent?.influencer_id || pMetadataCurrent?.influencer_id || (projectId?.startsWith('temp-') ? null : projectId) || ''}
                brandName={brandData?.brand_name || pDataCurrent?.brand || pMetadataCurrent?.brand || ''}
                influencerName={pDataCurrent?.influencer_name || pMetadataCurrent?.influencer_name || ''}
                user={user}
                onBack={handleBack}
                onComplete={handleComplete}
                initialInfluencer={passedState?.influencer}
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
            initialInfluencer={passedState?.influencer}
        />
    );
};

export default PAInfluencerPortfolioPage;
