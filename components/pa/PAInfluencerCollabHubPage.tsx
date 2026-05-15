import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Project, User, WorkflowStage } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import PAInfluencerCollabHub from './PAInfluencerCollabHub';
import PAStoryInfluencerDetails from './PAStoryInfluencerDetails';
import { SYSTEM_BRANDS, normalizePABrandName } from '../../services/supabaseDb';

interface PAInfluencerCollabHubPageProps {
    user: User;
    onLogout: () => void;
    refreshData: (user: User, force?: boolean) => Promise<void>;
}

const PAInfluencerCollabHubPage: React.FC<PAInfluencerCollabHubPageProps> = ({ user, refreshData }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const influencerNameParam = searchParams.get('name');
    const influencerIdParam = searchParams.get('inf_id');
    const brandParam = searchParams.get('brand');
    const navigate = useNavigate();
    const passedState = location.state as { influencer?: any, brandType?: string } | null;

    const [influencerProjects, setInfluencerProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(!passedState?.influencer);
    const [error, setError] = useState<string | null>(null);

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
                    brand: brandParam || inf.brand_name,
                    registry_id: inf.id,
                    is_pa_brand: true
                },
                created_at: inf.created_at
            };
            setInfluencerProjects([pseudoProject]);
        }
    }, []);


    // Fetch all data function - extracted to useCallback for reuse
    const fetchAllData = useCallback(async () => {
        const parseProjectData = (proj: any) => {
            try {
                const rawData = proj?.data;
                if (typeof rawData === 'string') return JSON.parse(rawData) || {};
                return rawData || {};
            } catch {
                return {};
            }
        };

        const projectIsReel = (proj: any) => {
            const data = parseProjectData(proj);
            const brandType = (proj?.brand_type || data?.brand_type || '').toString().toUpperCase();
            return brandType === 'REEL' || brandType === '';
        };

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
                    let pData = p.data;
                    let pMetadata = p.metadata;
                    if (typeof pData === 'string') pData = JSON.parse(pData);
                    if (typeof pMetadata === 'string') pMetadata = JSON.parse(pMetadata);
                    
                    const isPaBrand = pData?.is_pa_brand === true || pMetadata?.is_pa_brand === true;
                    const isInfluencer = pData?.is_influencer === true || pMetadata?.is_influencer === true;
                    return (isPaBrand || isInfluencer) && projectIsReel(p);
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
            
            // Helper to normalize strings for comparison (remove spaces, hyphens, case)
            const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            const normalizedCanonicalName = normalize(canonicalName);
            const normalizedCanonicalEmail = canonicalEmail.toLowerCase().trim();

            if (normalizedCanonicalName || normalizedCanonicalEmail) {
                matchingProjects = allPaProjects.filter(p => {
                    try {
                        let pData = p.data;
                        let pMetadata = p.metadata;
                        if (typeof pData === 'string') pData = JSON.parse(pData);
                        if (typeof pMetadata === 'string') pMetadata = JSON.parse(pMetadata);
                        
                        const pName = pData?.influencer_name || pMetadata?.influencer_name || (p as any).influencer_name || '';
                        const pEmail = pData?.influencer_email || pMetadata?.influencer_email || (p as any).influencer_email || '';
                        
                        const normalizedPName = normalize(pName);
                        const normalizedPEmail = pEmail.toLowerCase().trim();
                        
                        const nameMatch = normalizedCanonicalName && normalizedPName === normalizedCanonicalName;
                        const emailMatch = normalizedCanonicalEmail && normalizedPEmail === normalizedCanonicalEmail;
                        
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
                    let query = supabase
                        .from('influencers')
                        .select('*')
                        .ilike('influencer_name', canonicalName);
                    if (brandParam) {
                        query = query.eq('brand_name', normalizePABrandName(brandParam));
                    }
                    const { data } = await query.limit(1).maybeSingle();
                    registryRecord = data;
                }
                
                const registryIsReel = !registryRecord?.brand_type || registryRecord?.brand_type.toUpperCase() === 'REEL';
                if (registryRecord && registryIsReel) {
                    const dummyProject: any = {
                        id: 'temp-' + Date.now(),
                        title: `DRAFT: ${registryRecord.influencer_name}`,
                        current_stage: WorkflowStage.PARTNER_REVIEW,
                        data: {
                            influencer_name: registryRecord.influencer_name,
                            influencer_email: registryRecord.influencer_email,
                            is_pa_brand: true,
                            brand: brandParam || registryRecord.brand_name,
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
            setError('Failed to load brand hub.');
            setLoading(false);
        }
    }, [projectId, influencerNameParam, influencerIdParam]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Refresh data when window regains focus (user returns from review screen)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('Window visible, refreshing collab hub data...');
                fetchAllData();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        const handleFocus = () => {
            console.log('Window focused, refreshing collab hub data...');
            fetchAllData();
        };
        
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [projectId, influencerNameParam, influencerIdParam]);

    const handleBack = () => {
        navigate(-1);
    };

    const handleComplete = async () => {
        await refreshData(user);
        window.location.reload(); 
    };

    const isStoryBrand = passedState?.brandType === 'STORY' || 
                        searchParams.get('brand_type') === 'STORY' ||
                        influencerProjects.some(p => {
                            const data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
                            return p.brand_type === 'STORY' || data?.brand_type === 'STORY';
                        });

    if (isStoryBrand) {
        return (
            <PAStoryInfluencerDetails
                influencerId={influencerIdParam || ''}
                brandName={brandParam || ''}
                influencerName={influencerNameParam || ''}
                user={user}
                onBack={handleBack}
                onComplete={handleComplete}
                initialInfluencer={passedState?.influencer}
            />
        );
    }

    const currentProject = influencerProjects.find(p => p.id === projectId) || influencerProjects[0];

    if (!currentProject && loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white font-sans">
                <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || (influencerProjects.length === 0 && !isStoryBrand)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="text-center max-w-md w-full p-10 bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-3xl font-black uppercase text-slate-900 mb-2">Brand Hub Error</h2>
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

    return (
        <PAInfluencerCollabHub
            project={currentProject}
            allInfluencerProjects={influencerProjects}
            user={user}
            onBack={handleBack}
            onComplete={handleComplete}
            initialInfluencer={passedState?.influencer}
        />
    );
};

export default PAInfluencerCollabHubPage;
