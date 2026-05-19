import React, { useState, useEffect, useMemo } from 'react';
import { Project, Role, WorkflowStage, User, STAGE_LABELS, TaskStatus, ROLE_LABELS } from '../../types';
import { format } from 'date-fns';
import { 
  BarChart2, 
  Clock, 
  CheckCircle, 
  CheckCircle2,
  AlertTriangle, 
  RefreshCw, 
  Layout, 
  Upload,
  Briefcase, 
  Tag,
  ArrowLeft,
  Calendar,
  User as UserIcon,
  ExternalLink,
  ChevronRight,
  Filter,
  Shield,
  PlayCircle,
  Play,
  Video,
  Link,
  Users,
  FileText,
  FileCheck,
  DollarSign,
  MapPin,
  Instagram,
  Youtube,
  TrendingUp,
  Search,
  Send,
  Layers,
  X
} from 'lucide-react';
import { supabase } from '../../src/integrations/supabase/client';
import { db, SYSTEM_BRANDS, normalizePABrandName, getDynamicSourceFilterForBrand } from '../../services/supabaseDb';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import SearchResultsTable, { InfluencerSearchRow } from '../pa/SearchResultsTable';

// Helper function to format date to DD-MM-YYYY
const formatDateDDMMYYYY = (dateString: string | undefined): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is zero-indexed
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original if parsing fails
  }
};

const WORKFLOW_ORDER = [
  WorkflowStage.SCRIPT,
  WorkflowStage.SCRIPT_REVIEW_L1,
  WorkflowStage.SCRIPT_REVIEW_L2,
  WorkflowStage.CINEMATOGRAPHY,
  WorkflowStage.WRITER_VIDEO_APPROVAL,
  WorkflowStage.VIDEO_EDITING,
  WorkflowStage.MULTI_WRITER_APPROVAL,
  WorkflowStage.SUB_EDITOR_ASSIGNMENT,
  WorkflowStage.SUB_EDITOR_PROCESSING,
  WorkflowStage.THUMBNAIL_DESIGN,
  WorkflowStage.CREATIVE_DESIGN,
  WorkflowStage.FINAL_REVIEW_CMO,
  WorkflowStage.FINAL_REVIEW_CEO,
  WorkflowStage.POST_WRITER_REVIEW,
  WorkflowStage.OPS_SCHEDULING,
  WorkflowStage.POSTED,
  WorkflowStage.REWORK,
  WorkflowStage.WRITER_REVISION
];

const getMilestones = (p: Project): { label: string; time: string | undefined; color?: string }[] => {
  const milestones: { label: string; time: string | undefined; color?: string }[] = [];
  
  if (p.writer_submitted_at) {
    milestones.push({ label: 'Submitted', time: p.writer_submitted_at });
  } else if (p.created_at) {
    milestones.push({ label: 'Created', time: p.created_at });
  }

  switch (p.current_stage) {
    case WorkflowStage.SCRIPT_REVIEW_L2:
      milestones.push({ label: 'CMO Approved', time: p.cmo_approved_at, color: 'text-blue-600' });
      break;
    case WorkflowStage.CINEMATOGRAPHY:
      milestones.push({ label: 'CEO Approved', time: p.ceo_approved_at, color: 'text-blue-600' });
      break;
    case WorkflowStage.VIDEO_EDITING:
      milestones.push({ label: 'Cine Uploaded', time: p.cine_uploaded_at, color: 'text-blue-600' });
      break;
    case WorkflowStage.FINAL_REVIEW_CMO:
    case WorkflowStage.FINAL_REVIEW_CEO:
      if (p.cine_uploaded_at) milestones.push({ label: 'Cine Uploaded', time: p.cine_uploaded_at });
      milestones.push({ label: 'Editor Uploaded', time: p.editor_uploaded_at, color: 'text-blue-600' });
      break;
    case WorkflowStage.OPS_SCHEDULING:
      milestones.push({ label: 'Approved', time: p.ceo_approved_at || p.cmo_approved_at, color: 'text-blue-600' });
      break;
    case WorkflowStage.POSTED:
      if (p.post_scheduled_date) milestones.push({ label: 'Scheduled', time: p.post_scheduled_date });
      milestones.push({ label: 'Approved', time: p.ceo_approved_at || p.cmo_approved_at, color: 'text-blue-600' });
      break;
    case WorkflowStage.REWORK:
      milestones.push({ label: 'Rework Req', time: p.ceo_rework_at || p.cmo_rework_at, color: 'text-red-600' });
      break;
  }

  return milestones.filter(m => m.time).slice(0, 3);
};

const formatDateWithTime = (dateString: string | undefined): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
  } catch {
    return dateString;
  }
};

const getBrand = (p: Project): string => {
  const raw = p.brand || p.data?.brand_other || p.data?.brand || '';
  return normalizePABrandName(raw);
};

const getStageApprovalInfo = (p: Project, stage: string): { label: string; time: string | undefined; color?: string } => {
  switch (stage) {
    case WorkflowStage.SCRIPT:
      return { label: 'Submitted', time: p.writer_submitted_at, color: 'text-gray-600' };
    case WorkflowStage.SCRIPT_REVIEW_L1:
      return { label: 'Submitted', time: p.writer_submitted_at, color: 'text-gray-600' };
    case WorkflowStage.SCRIPT_REVIEW_L2:
      return { label: 'CMO Appr', time: p.cmo_approved_at, color: 'text-blue-600' };
    case WorkflowStage.CINEMATOGRAPHY:
      return { label: 'CEO Appr', time: p.ceo_approved_at || p.cmo_approved_at, color: 'text-blue-600' };
    case WorkflowStage.WRITER_VIDEO_APPROVAL:
      return { label: 'Cine Uploaded', time: p.cine_uploaded_at, color: 'text-blue-600' };
    case WorkflowStage.VIDEO_EDITING:
      return { label: 'Cine Uploaded', time: p.cine_uploaded_at, color: 'text-blue-600' }; 
    case WorkflowStage.MULTI_WRITER_APPROVAL:
    case WorkflowStage.SUB_EDITOR_ASSIGNMENT:
    case WorkflowStage.SUB_EDITOR_PROCESSING:
    case WorkflowStage.THUMBNAIL_DESIGN:
    case WorkflowStage.CREATIVE_DESIGN:
      return { label: 'Editor Ready', time: p.editor_uploaded_at || p.sub_editor_uploaded_at, color: 'text-blue-600' };
    case WorkflowStage.FINAL_REVIEW_CEO:
      return { label: 'CMO Appr', time: p.cmo_approved_at, color: 'text-blue-600' };
    case WorkflowStage.OPS_SCHEDULING:
      return p.ceo_approved_at 
        ? { label: 'CEO Appr', time: p.ceo_approved_at, color: 'text-blue-600' }
        : { label: 'CMO Appr', time: p.cmo_approved_at, color: 'text-blue-600' };
    case WorkflowStage.POSTED:
      return { label: 'Scheduled', time: p.post_scheduled_date, color: 'text-blue-600' };
    case 'REWORK':
      return { label: 'Rework Req', time: p.ceo_rework_at || p.cmo_rework_at, color: 'text-red-600' };
    default:
      return { label: '', time: undefined };
  }
};

const findPreviousApproval = (p: Project, currentStageIdx: number): { label: string; time: string | undefined; color?: string } | null => {
  if (currentStageIdx < 0) return null;
  
  // Try previous stages one by one until we find a timestamp
  for (let i = currentStageIdx; i >= 0; i--) {
    const stage = WORKFLOW_ORDER[i];
    const info = getStageApprovalInfo(p, stage as string);
    if (info.time) return info;
  }
  
  return { label: 'Submitted', time: p.writer_submitted_at, color: 'text-gray-600' };
};

const fetchOverallLeads = async () => {
  const today = new Date();
  const url = new URL(import.meta.env.VITE_LEADS_API_URL || 'http://localhost:3000/api/leads');
  url.searchParams.set('startDate', '2024-01-01');
  url.searchParams.set('endDate', today.toISOString().split('T')[0]);
  url.searchParams.set('limit', '20000');

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Leads API Error: ${response.status}`);

  const result = await response.json();
  return result.data || (Array.isArray(result) ? result : []);
};

interface Props {
  user: any;
}

const CmoOverview: React.FC<Props> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const topRef = React.useRef<HTMLDivElement>(null);

  const brandFilter = searchParams.get('brand') || 'ALL';
  const setBrandFilter = (b: string) =>
    setSearchParams(p => { p.set('brand', b); p.delete('overview_filter'); return p; }, { replace: true });

  const overviewFilter = searchParams.get('overview_filter') || '';
  const setOverviewFilter = (f: string) =>
    setSearchParams(p => { if (f) p.set('overview_filter', f); else p.delete('overview_filter'); return p; }, { replace: true });

  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [allInfluencers, setAllInfluencers] = useState<any[]>([]);
  const [brandInfluencers, setBrandInfluencers] = useState<any[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [brandLeads, setBrandLeads] = useState<any[]>([]);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'SCRIPTS' | 'INFLUENCERS'>('SCRIPTS');
  const [influencerSearchTerm, setInfluencerSearchTerm] = useState('');
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedBrandData, setExpandedBrandData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'DETAILS'>('OVERVIEW');

  useEffect(() => {
    const fetchAllProjects = async () => {
      try {
        const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setAllProjects(data || []);
      } catch (err) {
        console.error('Error fetching projects:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllProjects();
  }, []);

  useEffect(() => {
    const fetchBrandsAndData = async () => {
      try {
        const [brandsData, influencersData, leadsData] = await Promise.all([
          db.brands.getAll(),
          db.influencers.getAll(),
          fetchOverallLeads().catch(() => [])
        ]);
        setBrands([...brandsData, ...SYSTEM_BRANDS]);
        setAllInfluencers(influencersData || []);
        setAllLeads(leadsData || []);
      } catch (err) {
        console.error('Error fetching initial data for CMO Overview:', err);
      }
    };
    fetchBrandsAndData();
  }, []);

  useEffect(() => {
    if (!brandFilter || brandFilter === 'ALL') {
      setBrandInfluencers([]);
      setBrandLeads([]);
      return;
    }

    const fetchBrandSpecificData = async () => {
      try {
        // 1. Fetch Influencers and Leads
        const infData = await db.influencers.getByBrand(brandFilter);

        // 2. Fetch stories only for the influencers we found
        const influencerIds = infData.map(i => i.id);
        const storiesData = influencerIds.length > 0 
          ? await supabase.from('influencer_stories').select('*').in('influencer_id', influencerIds)
          : { data: [] };

        // Enrich influencers with stories
        const enriched = infData.map(inf => ({
          ...inf,
          stories: (storiesData.data || []).filter(s => s.influencer_id === inf.id)
        }));
        setBrandInfluencers(enriched);

        // 3. Filter Leads
        const sourceFilter = getDynamicSourceFilterForBrand(brandFilter, brands);
        const filteredLeads = sourceFilter ? allLeads.filter(l => sourceFilter(l.source || '')) : allLeads;
        setBrandLeads(filteredLeads);
      } catch (err) {
        console.warn('Failed to fetch brand-specific data:', err);
      }
    };

    fetchBrandSpecificData();
  }, [brandFilter, brands, allLeads]);

  // Scroll restoration logic
  useEffect(() => {
    if (viewMode === 'OVERVIEW' && !loading) {
      const savedScrollPos = sessionStorage.getItem('cmo_overview_scroll_pos');
      if (savedScrollPos) {
        // Small delay to ensure content is rendered
        const timeoutId = setTimeout(() => {
          window.scrollTo({
            top: parseInt(savedScrollPos, 10),
            behavior: 'auto'
          });
        }, 100);
        return () => clearTimeout(timeoutId);
      }
    } else if (viewMode === 'DETAILS') {
      if (topRef.current) topRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
      const timeoutId = setTimeout(() => {
        if (topRef.current) topRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [viewMode, loading]);

  interface WorkflowHistoryEntry {
    action: string;
    comment: string;
    actor_name: string;
    actor_id?: string;
    timestamp: string;
    stage: string;
    idx?: number;
    id?: string;
  }

  const [comments, setComments] = useState<WorkflowHistoryEntry[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchComments = async () => {
      if (!selectedProject?.id) return;

      const { data: allHistoryData, error: historyError } = await supabase
        .from('workflow_history')
        .select(`
          action,
          comment,
          actor_name,
          actor_id,
          timestamp,
          stage
        `)
        .eq('project_id', selectedProject.id)
        .order('timestamp', { ascending: false });

      if (historyError) {
        console.error('Error fetching workflow history:', historyError);
        setComments([]);
        return;
      }

      // Filter to include all relevant workflow stages for comprehensive history
      const commentsData = allHistoryData.filter(item => {
        if (['APPROVED', 'REWORK', 'REJECTED'].includes(item.action)) return true;
        if (item.stage === 'SCRIPT' && item.action === 'SUBMITTED') return true;
        if (item.stage === 'SCRIPT_REVIEW_L1' && item.action === 'SUBMITTED') return true;
        if (item.stage === 'REWORK' && item.action === 'SUBMITTED') return true;
        if (['WRITER_VIDEO_APPROVAL', 'POST_WRITER_REVIEW'].includes(item.stage) && item.action === 'SUBMITTED') return true;
        if (item.stage === 'MULTI_WRITER_APPROVAL' && ['APPROVED', 'SUBMITTED'].includes(item.action)) return true;
        if (item.action === 'SET_SHOOT_DATE' || item.action === 'SET_DELIVERY_DATE') return true;
        if (['CINEMATOGRAPHY', 'VIDEO_EDITING', 'SUB_EDITOR_PROCESSING', 'THUMBNAIL_DESIGN'].includes(item.stage) && item.action === 'SUBMITTED') return true;
        if (['CINEMATOGRAPHY', 'VIDEO_EDITING', 'SUB_EDITOR_PROCESSING', 'THUMBNAIL_DESIGN', 'SUB_EDITOR_ASSIGNMENT'].includes(item.stage) && item.action === 'APPROVED') return true;
        if (['FINAL_REVIEW_CMO', 'FINAL_REVIEW_CEO'].includes(item.stage)) return true;
        if (item.action === 'SUB_EDITOR_ASSIGNED') return true;
        if (item.action === 'REWORK_VIDEO_SUBMITTED') return true;
        if (item.stage === 'SCRIPT' && item.action === 'SUBMITTED') return true;
        if (item.stage === 'OPS_SCHEDULING') return true;
        if (item.stage === 'SCRIPT_REVIEW_L1' && item.action === 'SUBMITTED') return true;
        if (item.stage === 'SCRIPT_REVIEW_L2' && item.action === 'SUBMITTED') return true;
        if (['POST_WRITER_REVIEW'].includes(item.stage)) return true;
        return false;
      });

      const filteredComments = commentsData?.filter(comment => comment.action !== 'CREATED') || [];
      const uniqueEventsMap = new Map();

      filteredComments.forEach(comment => {
        const uniqueKey = `${comment.action}-${comment.actor_id || comment.actor_name}-${comment.comment || ''}-${comment.timestamp}`;
        if (!uniqueEventsMap.has(uniqueKey)) {
          uniqueEventsMap.set(uniqueKey, comment);
        }
      });

      let uniqueComments = (Array.from(uniqueEventsMap.values()) as WorkflowHistoryEntry[])
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (uniqueComments.length > 0) {
        const userIds = uniqueComments.map(comment => comment.actor_id).filter(id => id) as string[];
        if (userIds.length > 0) {
          const uniqueUserIds = [...new Set(userIds)];
          const userPromises = uniqueUserIds.map(async (userId) => {
            try {
              const user = await db.users.getById(userId as string);
              return { id: userId, ...user };
            } catch (error) {
              return null;
            }
          });
          const userData = await Promise.all(userPromises);
          const userMapTemp: Record<string, any> = {};
          userData.forEach(user => { if (user) userMapTemp[user.id] = user; });
          setUserMap(userMapTemp);
          uniqueComments = uniqueComments.map(comment => {
            if (comment.actor_id && userMapTemp[comment.actor_id]) {
              return {
                ...comment,
                actor_name: userMapTemp[comment.actor_id].full_name || userMapTemp[comment.actor_id].email || comment.actor_name
              };
            }
            return comment;
          });
        }
      }
      setComments(uniqueComments);
    };
    fetchComments();
  }, [selectedProject?.id]);

  const brandStats = useMemo(() => {
    const map: Record<string, number> = {};
    brands.forEach(b => {
      if (b.brand_name) {
        const name = normalizePABrandName(b.brand_name);
        if (name) map[name] = 0;
      }
    });
    allProjects.forEach(p => { 
      const b = getBrand(p); 
      if (b) map[b] = (map[b] || 0) + 1;
    });
    return { counts: map, list: Object.keys(map).sort() };
  }, [allProjects, brands]);

  useEffect(() => {
    if (!searchParams.get('brand') && brandStats.list.length > 0) {
      setBrandFilter(brandStats.list[0]);
    }
  }, [brandStats.list, searchParams]);

  const brandFilteredProjects = useMemo(() => {
    if (!brandFilter || brandFilter === 'ALL') {
      // If no valid filter yet, just return empty or fallback to the first brand if available
      return brandStats.list.length > 0 ? allProjects.filter(p => getBrand(p) === brandStats.list[0]) : [];
    }
    return allProjects.filter(p => getBrand(p) === brandFilter);
  }, [allProjects, brandFilter, brandStats.list]);

  const brandDashboardMetrics = useMemo(() => {
    const isAll = brandFilter === 'ALL';
    const currentBrand = !isAll ? brands.find(b => normalizePABrandName(b.brand_name) === brandFilter) : null;
    const isStoryBrand = !isAll && (currentBrand?.brand_type === 'STORY' || brandFilter.includes('STORY') || brandFilter.includes('STORIES'));

    const brandProjects = isAll 
      ? allProjects 
      : allProjects.filter(p => (getBrand(p) === brandFilter) || (!getBrand(p) && brandFilter === 'UNBRANDED'));
    
    const currentLeads = isAll ? allLeads : brandLeads;
    const totalLeads = currentLeads.length;
    let displayedLeads = currentLeads;
    let currentInfluencers = isAll ? allInfluencers : brandInfluencers;
    let currentProjects = brandProjects;

    const influencersToUse = currentInfluencers;
    // Heuristic helpers
    const isInfluencerProject = (p: any) => {
      const data = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
      const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
      return (
        data?.influencer_instance === true ||
        metadata?.influencer_instance === true ||
        data?.is_influencer === true ||
        metadata?.is_influencer === true ||
        !!data?.influencer_name ||
        !!metadata?.influencer_name ||
        !!data?.parent_script_id ||
        !!metadata?.parent_script_id
      );
    };

    const isInfluencerInstance = (p: any) => {
      const data = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
      const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
      return data?.influencer_instance === true || metadata?.influencer_instance === true;
    };

    const isPaBrand = (p: any) => {
      const data = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
      const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
      return data?.is_pa_brand === true || metadata?.is_pa_brand === true;
    };

    const totalScripts = currentProjects.filter(p => (isPaBrand(p) || isInfluencerProject(p)) && !isInfluencerInstance(p)).length;
    const totalInfluencerTasks = currentProjects.filter(p => isInfluencerInstance(p)).length;
    const totalProof = currentProjects.filter(p => !!p.pa_posting_proof_added_at).length;

    const totalBudget = influencersToUse.reduce((sum, inf) => {
      const budgetVal = typeof inf.budget === 'string' 
        ? parseFloat(inf.budget.replace(/[^0-9.]/g, '')) 
        : (typeof inf.budget === 'number' ? inf.budget : 0);
      return sum + (isNaN(budgetVal) ? 0 : budgetVal);
    }, 0);

    const isCompletionMarker = (value: unknown) => ['completed', 'complete', 'done', 'yes', 'finished', 'finish'].includes(String(value || '').trim().toLowerCase());
    const isExternalUrl = (value: unknown) => /^https?:\/\//i.test(String(value || '').trim());

    const influencerStats: Record<string, any> = {};
    
    // Seed with table data
    influencersToUse.forEach(inf => {
      const name = inf.influencer_name;
      if (!name) return;
      
      const hasProof = isExternalUrl(inf.proof_link);
      const isCompleteStatus = isCompletionMarker(inf.status) || isCompletionMarker(inf.proof_link);

      if (!influencerStats[name]) {
        influencerStats[name] = {
          name,
          tasks: 0,
          completed: 0,
          script_sent: !!inf.script_content || isCompleteStatus,
          raw_video: !!inf.video_link,
          edited_video: !!inf.edited_video_link,
          proof: hasProof,
          approved: inf.approved || inf.is_posted === true || isCompleteStatus,
          latestStatus: 'No active project',
          budget: inf.budget
        };
      } else {
        if (!!inf.script_content || isCompleteStatus) influencerStats[name].script_sent = true;
        if (!!inf.video_link) influencerStats[name].raw_video = true;
        if (!!inf.edited_video_link) influencerStats[name].edited_video = true;
        if (hasProof) influencerStats[name].proof = true;
        if (inf.approved || inf.is_posted === true || isCompleteStatus) influencerStats[name].approved = true;
      }
    });

    // Add/Update with project data
    currentProjects.forEach(p => {
      if (isInfluencerInstance(p)) {
        const name = p.data?.influencer_name || p.metadata?.influencer_name;
        if (!name) return;
        
        if (!influencerStats[name]) {
          influencerStats[name] = {
            name,
            tasks: 0,
            completed: 0,
            script_sent: false,
            raw_video: false,
            edited_video: false,
            proof: false,
            approved: false,
            latestStatus: p.current_stage,
            budget: 0
          };
        }
        
        influencerStats[name].tasks++;
        if (p.current_stage === WorkflowStage.POSTED) influencerStats[name].completed++;
        
        const scriptSentFromProject = !!p.pa_script_sent_at || [WorkflowStage.SENT_TO_INFLUENCER, WorkflowStage.PA_VIDEO_UPLOAD, WorkflowStage.PA_VIDEO_CMO_REVIEW, WorkflowStage.PA_VIDEO_APPROVAL, WorkflowStage.POSTED].includes(p.current_stage as WorkflowStage);
        if (scriptSentFromProject) influencerStats[name].script_sent = true;
        
        if (p.video_link || p.video_url || p.pa_raw_footage_uploaded_at) influencerStats[name].raw_video = true;
        if (p.edited_video_link) influencerStats[name].edited_video = true;
        
        const hasProjectProof = isExternalUrl(p.data?.posting_proof_link || p.data?.live_url || p.data?.referral_link);
        if (hasProjectProof || !!p.pa_posting_proof_added_at) influencerStats[name].proof = true;
        
        if (p.current_stage === WorkflowStage.PA_FINAL_REVIEW || p.current_stage === WorkflowStage.POSTED) influencerStats[name].approved = true;
        
        influencerStats[name].latestStatus = p.current_stage;
      }
    });

    let influencerList = Object.values(influencerStats).sort((a: any, b: any) => b.tasks - a.tasks);
    let scriptList = currentProjects.filter(p => (isPaBrand(p) || isInfluencerProject(p)) && !isInfluencerInstance(p))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalInfluencers = influencerList.length;
    const totalScriptsKPI = influencerList.filter(i => i.script_sent).length;
    const rawVideos = influencerList.filter(i => i.raw_video).length;
    const editedVideos = influencerList.filter(i => i.edited_video).length;
    const totalApprove = influencerList.filter(i => i.approved).length;
    const totalProofKPI = influencerList.filter(i => i.proof).length;

    if (isStoryBrand) {
      const totalStories = influencersToUse.reduce((acc, inf) => acc + (inf.stories?.length || 0), 0);
      return {
        totalInfluencers,
        rawVideosReceived: rawVideos,
        editedVideos: editedVideos,
        totalLeads,
        totalScripts: totalStories,
        totalInfluencerTasks,
        totalBudget,
        totalProof: totalProofKPI,
        totalApprove,
        influencerList,
        scriptList,
        leadList: displayedLeads,
        isStory: true
      };
    }

    return {
      totalInfluencers,
      rawVideosReceived: rawVideos,
      editedVideos: editedVideos,
      totalLeads,
      totalProjects: currentProjects.length,
      totalScripts: totalScriptsKPI,
      totalInfluencerTasks,
      totalBudget,
      totalProof: totalProofKPI,
      totalApprove,
      influencerList,
      scriptList,
      leadList: displayedLeads,
      isStory: false
    };
  }, [allProjects, brandFilter, brandInfluencers, brandLeads, brands, allInfluencers, allLeads]);

  // ── PA-Brands-style cross-brand influencer search ──────────────────────────
  const influencerSearchRows = useMemo<InfluencerSearchRow[]>(() => {
    const parseBudget = (v: unknown) => {
      if (v == null || v === '') return 0;
      if (typeof v === 'number') return v;
      const n = Number(String(v).replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    // Pre-compute lead sources for fast matching — same as PABrands
    const leadSources = allLeads.map((lead: any) => (lead.source || '').trim().toLowerCase());
    const rows = new Map<string, any>();
    allInfluencers.forEach((inf: any) => {
      const key = (inf.influencer_name || '').trim().toLowerCase();
      const brandName = (inf.brand_name || 'Unassigned').trim();
      const instagram_handle = inf.instagram_profile || inf.instagram_handle || '';
      const budget = parseBudget(inf.budget || inf.commercials || 0);
      const existing = rows.get(key);
      if (!existing) {
        rows.set(key, {
          id: inf.id || key,
          influencer_name: inf.influencer_name || 'Unknown',
          influencer_email: inf.influencer_email || '',
          instagram_handle,
          influencer_links: inf.influencer_links || [],
          total_budget: budget,
          // Count leads whose source string contains this influencer's name
          total_leads: key ? leadSources.filter((src: string) => src.includes(key)).length : 0,
          brands: brandName ? [brandName] : [],
          brand_types: [(inf.brand_type || 'REEL').toUpperCase()],
          primary_brand: brandName,
          profile_initial: (inf.influencer_name || 'I')[0]?.toUpperCase() || 'I',
          profile_color: 'bg-slate-900',
          niche: inf.niche,
          location: inf.location,
        });
      } else {
        existing.total_budget = (existing.total_budget || 0) + budget;
        existing.influencer_links = [...new Map([...(existing.influencer_links || []), ...(inf.influencer_links || [])].map((l: any) => [l.link, l])).values()];
        if (brandName && !existing.brands.includes(brandName)) existing.brands.push(brandName);
        if (!existing.instagram_handle) existing.instagram_handle = instagram_handle;
      }
    });
    return Array.from(rows.values()).map(item => ({ ...item, total_budget: `$${Number(item.total_budget || 0).toLocaleString()}` }));
  }, [allInfluencers, allLeads]);

  const filteredInfluencerRows = useMemo<InfluencerSearchRow[]>(() => {
    if (!influencerSearchTerm) return [];
    const low = influencerSearchTerm.toLowerCase();
    return influencerSearchRows.filter(row =>
      row.influencer_name.toLowerCase().includes(low) ||
      row.instagram_handle.toLowerCase().includes(low) ||
      row.brands.some((b: string) => b.toLowerCase().includes(low)) ||
      row.influencer_links.some((l: any) => (l.link || '').toLowerCase().includes(low))
    );
  }, [influencerSearchRows, influencerSearchTerm]);

  const handleSelectBrandDetails = async (brandName: string, rowId: string) => {
    if (expandedRowId === rowId && expandedBrandData?.brand_name === brandName) {
      setExpandedRowId(null); setExpandedBrandData(null); return;
    }
    setExpandedRowId(rowId);
    setExpandedBrandData({ brand_name: brandName, _loading: true });
    setOpenPopoverId(null);
    const row = influencerSearchRows.find(r => r.id === rowId);
    const infName = row?.influencer_name?.trim() || '';
    const infNameLower = infName.toLowerCase();
    try {
      const { data: infRecords } = await supabase.from('influencers').select('*, influencer_links(*)').ilike('influencer_name', infName).order('created_at', { ascending: false });
      const specificInf = (infRecords || []).find((inf: any) => normalizePABrandName(inf.brand_name) === normalizePABrandName(brandName));
      let latestAction = 'No recent action';
      let proofLink: string | null = null;
      if (specificInf) {
        const { data: projectData } = await supabase.from('projects').select('current_stage, data, pa_script_sent_at, video_link, edited_video_link').or(`id.eq.${specificInf.parent_project_id || 'none'},id.eq.${specificInf.instance_project_id || 'none'}`).limit(1);
        const project = projectData?.[0];
        proofLink = project?.data?.posting_proof_link || project?.data?.live_url || null;
        const scriptSent = !!specificInf.script_content || !!project?.pa_script_sent_at;
        const rawVideo = !!(project?.video_link || specificInf.video_link);
        const editedVideo = !!(project?.edited_video_link || specificInf.edited_video_link);
        if (proofLink) latestAction = 'Proof Uploaded';
        else if (editedVideo) latestAction = 'Edited Video Uploaded';
        else if (rawVideo) latestAction = 'Raw Video Received';
        else if (scriptSent) latestAction = 'Script Sent';
      }
      const foundBrand = brands.find((b: any) => normalizePABrandName(b.brand_name) === normalizePABrandName(brandName));
      const brandSourceFilter = getDynamicSourceFilterForBrand(brandName, brands);
      const brandLeadsForInf = allLeads.filter((l: any) => brandSourceFilter ? brandSourceFilter(l.source || '') : false);
      const influencerLeads = infNameLower ? brandLeadsForInf.filter((l: any) => (l.source || '').toLowerCase().includes(infNameLower)).length : brandLeadsForInf.length;
      setExpandedBrandData({ brand_name: brandName, campaign_name: foundBrand?.brand_name || brandName, niche: specificInf?.niche || 'N/A', collab_type: specificInf?.campaign_type || 'N/A', influencer_budget: specificInf?.budget || 'N/A', influencer_brand_leads: influencerLeads, latest_action: latestAction, proof_link: proofLink });
    } catch { setExpandedRowId(null); setExpandedBrandData(null); }
  };

  const handleInfluencerRowViewDetails = (_row: InfluencerSearchRow) => {
    setExpandedRowId(null); setExpandedBrandData(null); setOpenPopoverId(null);
  };
  // ────────────────────────────────────────────────────────────────────────────

  const kpiData = useMemo(() => {
    const base = brandFilteredProjects;
    
    // CMO Review Stats
    const cmoScript = base.filter(p => p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 && p.status !== TaskStatus.DONE).length;
    const cmoFinal = base.filter(p => [WorkflowStage.FINAL_REVIEW_CMO, WorkflowStage.POST_WRITER_REVIEW].includes(p.current_stage) && p.status !== TaskStatus.DONE).length;
    
    // CEO Review Stats
    const ceoScript = base.filter(p => p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2 && p.status !== TaskStatus.DONE).length;
    const ceoFinal = base.filter(p => p.current_stage === WorkflowStage.FINAL_REVIEW_CEO && p.status !== TaskStatus.DONE).length;

    // Production Stats (Exclude Rework)
    const cine = base.filter(p => [WorkflowStage.CINEMATOGRAPHY, WorkflowStage.WRITER_VIDEO_APPROVAL].includes(p.current_stage) && p.status !== TaskStatus.DONE && p.status !== TaskStatus.REWORK).length;
    const editor = base.filter(p => [WorkflowStage.VIDEO_EDITING, WorkflowStage.SUB_EDITOR_ASSIGNMENT, WorkflowStage.SUB_EDITOR_PROCESSING].includes(p.current_stage) && p.status !== TaskStatus.DONE && p.status !== TaskStatus.REWORK).length;
    const designer = base.filter(p => [WorkflowStage.THUMBNAIL_DESIGN, WorkflowStage.CREATIVE_DESIGN].includes(p.current_stage) && p.status !== TaskStatus.DONE && p.status !== TaskStatus.REWORK).length;

    // Approved counts (moved beyond these categories)
    const cmoApproved = base.filter(p => !['SCRIPT', 'SCRIPT_REVIEW_L1', 'FINAL_REVIEW_CMO', 'POST_WRITER_REVIEW'].includes(p.current_stage) && p.status !== TaskStatus.DONE).length;
    const ceoApproved = base.filter(p => !['SCRIPT', 'SCRIPT_REVIEW_L1', 'SCRIPT_REVIEW_L2', 'FINAL_REVIEW_CMO', 'FINAL_REVIEW_CEO', 'POST_WRITER_REVIEW'].includes(p.current_stage) && p.status !== TaskStatus.DONE).length;
    const prodApproved = base.filter(p => [WorkflowStage.OPS_SCHEDULING, WorkflowStage.POSTED].includes(p.current_stage) || p.status === TaskStatus.DONE).length;

    return {
      total: base.length,
      completed: base.filter(p => p.status === TaskStatus.DONE).length,
      rework: base.filter(p => p.status === TaskStatus.REWORK).length,
      cmoTotal: cmoScript + cmoFinal,
      cmoApproved,
      cmoScript,
      cmoFinal,
      ceoTotal: ceoScript + ceoFinal,
      ceoApproved,
      ceoScript,
      ceoFinal,
      prodTotal: cine + editor + designer,
      prodApproved,
      cine,
      editor,
      designer
    };
  }, [brandFilteredProjects]);

  const stageCounts = useMemo(() => {
    const map: Record<string, { pending: number; approved: number }> = {};
    const persistentStages = [
      WorkflowStage.SCRIPT, WorkflowStage.SCRIPT_REVIEW_L1, WorkflowStage.SCRIPT_REVIEW_L2, 
      WorkflowStage.CINEMATOGRAPHY, WorkflowStage.WRITER_VIDEO_APPROVAL, WorkflowStage.VIDEO_EDITING, 
      WorkflowStage.MULTI_WRITER_APPROVAL, WorkflowStage.FINAL_REVIEW_CMO, WorkflowStage.FINAL_REVIEW_CEO, 
      WorkflowStage.OPS_SCHEDULING, WorkflowStage.POSTED
    ];
    persistentStages.forEach(s => map[s] = { pending: 0, approved: 0 });

    brandFilteredProjects.forEach(p => {
      let currentStage: string = p.current_stage;
      if (p.status === TaskStatus.DONE) currentStage = WorkflowStage.POSTED;
      if (currentStage === WorkflowStage.POST_WRITER_REVIEW) currentStage = WorkflowStage.FINAL_REVIEW_CMO;

      const isReworkStatus = p.status === TaskStatus.REWORK;
      const currentIdx = WORKFLOW_ORDER.indexOf(currentStage as WorkflowStage);

      WORKFLOW_ORDER.forEach((s) => {
        const stageIdx = WORKFLOW_ORDER.indexOf(s);
        if (!map[s]) map[s] = { pending: 0, approved: 0 };
        
        // Items in REWORK status only count towards the REWORK stage button
        if (isReworkStatus) {
           if (s === WorkflowStage.REWORK) map[s].pending++;
           return;
        }

        if (currentStage === s) {
          map[s].pending++;
        } else {
          const postedIdx = WORKFLOW_ORDER.indexOf(WorkflowStage.POSTED);
          const isDone = p.status === TaskStatus.DONE;
          
          if (isDone) {
            // Done projects only count as approved for stages BEFORE Posted
            if (stageIdx < postedIdx) map[s].approved++;
          } else if (currentIdx > stageIdx) {
            // Active projects count as approved for stages they have passed
            map[s].approved++;
          }
        }
      });
    });
    return map;
  }, [brandFilteredProjects]);

  const orderedStageEntries = useMemo(() => {
    const persistentStages = [
      WorkflowStage.SCRIPT, WorkflowStage.SCRIPT_REVIEW_L1, WorkflowStage.SCRIPT_REVIEW_L2, 
      WorkflowStage.CINEMATOGRAPHY, WorkflowStage.WRITER_VIDEO_APPROVAL, WorkflowStage.VIDEO_EDITING, 
      WorkflowStage.MULTI_WRITER_APPROVAL, WorkflowStage.FINAL_REVIEW_CMO, WorkflowStage.FINAL_REVIEW_CEO, 
      WorkflowStage.OPS_SCHEDULING, WorkflowStage.POSTED
    ];
    const allRelevantStages = new Set([...Object.keys(stageCounts), ...persistentStages]);
    return Array.from(allRelevantStages)
      .filter(s => s !== WorkflowStage.POST_WRITER_REVIEW)
      .map(s => [s, stageCounts[s] || { pending: 0, approved: 0 }] as [string, { pending: number; approved: number }])
      .sort((a, b) => {
        const idxA = WORKFLOW_ORDER.indexOf(a[0] as WorkflowStage);
        const idxB = WORKFLOW_ORDER.indexOf(b[0] as WorkflowStage);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
  }, [stageCounts]);

  const overviewFilteredProjects = useMemo(() => {
    const base = brandFilteredProjects;
    if (!overviewFilter) return base;
    
    const kpiIds = ['COMPLETED', 'REWORK', 'CMO_REVIEW', 'CEO_REVIEW', 'IN_PRODUCTION'];
    if (kpiIds.includes(overviewFilter)) {
      switch (overviewFilter) {
        case 'COMPLETED': return base.filter(p => p.status === TaskStatus.DONE);
        case 'REWORK': return base.filter(p => p.status === TaskStatus.REWORK);
        case 'CMO_REVIEW': 
          return base.filter(p => p.current_stage !== 'SCRIPT' && p.status !== TaskStatus.DONE && p.status !== TaskStatus.REWORK);
        case 'CEO_REVIEW':
          return base.filter(p => !['SCRIPT', 'SCRIPT_REVIEW_L1'].includes(p.current_stage) && p.status !== TaskStatus.DONE && p.status !== TaskStatus.REWORK);
        case 'IN_PRODUCTION':
          return base.filter(p => !['SCRIPT', 'SCRIPT_REVIEW_L1', 'SCRIPT_REVIEW_L2', 'FINAL_REVIEW_CMO', 'FINAL_REVIEW_CEO', 'POST_WRITER_REVIEW'].includes(p.current_stage) && p.status !== TaskStatus.REWORK);
        default: return base;
      }
    }

    const actualFilter = (overviewFilter === WorkflowStage.POST_WRITER_REVIEW || overviewFilter === WorkflowStage.FINAL_REVIEW_CMO) ? WorkflowStage.FINAL_REVIEW_CMO : overviewFilter;
    const filterIdx = WORKFLOW_ORDER.indexOf(actualFilter as WorkflowStage);
    if (filterIdx === -1) return base.filter(p => p.current_stage === overviewFilter);

    return base.filter(p => {
      let currentStage: string = p.current_stage;
      if (p.status === TaskStatus.DONE) currentStage = WorkflowStage.POSTED;
      if (currentStage === WorkflowStage.POST_WRITER_REVIEW) currentStage = WorkflowStage.FINAL_REVIEW_CMO;
      const currentIdx = WORKFLOW_ORDER.indexOf(currentStage as WorkflowStage);
      if (p.status === TaskStatus.DONE) return WORKFLOW_ORDER.indexOf(WorkflowStage.POSTED) >= filterIdx;
      if (p.status === TaskStatus.REWORK) return filterIdx === WORKFLOW_ORDER.indexOf(WorkflowStage.REWORK);
      return currentIdx >= filterIdx;
    });
  }, [brandFilteredProjects, overviewFilter]);

  const projectsToShow = useMemo(() => {
    const list = [...overviewFilteredProjects];
    const filterIdx = WORKFLOW_ORDER.indexOf(overviewFilter as WorkflowStage);
    const isStageFilter = filterIdx !== -1 && !['POSTED', 'REWORK'].includes(overviewFilter);

    if (isStageFilter) {
      const actualFilter = (overviewFilter === WorkflowStage.POST_WRITER_REVIEW || overviewFilter === WorkflowStage.FINAL_REVIEW_CMO) ? WorkflowStage.FINAL_REVIEW_CMO : overviewFilter;
      list.sort((a, b) => {
        const getEffectiveStage = (p: Project) => {
          if (p.status === TaskStatus.DONE) return WorkflowStage.POSTED;
          if (p.current_stage === WorkflowStage.POST_WRITER_REVIEW) return WorkflowStage.FINAL_REVIEW_CMO;
          return p.current_stage;
        };
        const isAPending = getEffectiveStage(a) === actualFilter;
        const isBPending = getEffectiveStage(b) === actualFilter;
        if (isAPending && !isBPending) return -1;
        if (!isAPending && isBPending) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [overviewFilteredProjects, overviewFilter]);

  const handleViewDetails = (project: Project) => {
    sessionStorage.setItem('cmo_overview_scroll_pos', window.scrollY.toString());
    setSelectedProject(project);
    setViewMode('DETAILS');
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }, 10);
  };

  const handleBackToOverview = () => {
    setViewMode('OVERVIEW');
  };

  const { pendingList, approvedList } = useMemo(() => {
    if (overviewFilter === 'CMO_REVIEW') {
      const pending = projectsToShow.filter(p => [WorkflowStage.SCRIPT_REVIEW_L1, WorkflowStage.FINAL_REVIEW_CMO, WorkflowStage.POST_WRITER_REVIEW].includes(p.current_stage as WorkflowStage) && p.status !== TaskStatus.DONE);
      const approved = projectsToShow.filter(p => !['SCRIPT', 'SCRIPT_REVIEW_L1', 'FINAL_REVIEW_CMO', 'POST_WRITER_REVIEW'].includes(p.current_stage) && p.status !== TaskStatus.DONE);
      return { pendingList: pending, approvedList: approved };
    }
    if (overviewFilter === 'CEO_REVIEW') {
      const pending = projectsToShow.filter(p => [WorkflowStage.SCRIPT_REVIEW_L2, WorkflowStage.FINAL_REVIEW_CEO].includes(p.current_stage as WorkflowStage) && p.status !== TaskStatus.DONE);
      const approved = projectsToShow.filter(p => !['SCRIPT', 'SCRIPT_REVIEW_L1', 'SCRIPT_REVIEW_L2', 'FINAL_REVIEW_CMO', 'FINAL_REVIEW_CEO', 'POST_WRITER_REVIEW'].includes(p.current_stage) && p.status !== TaskStatus.DONE);
      return { pendingList: pending, approvedList: approved };
    }
    if (overviewFilter === 'IN_PRODUCTION') {
      const pending = projectsToShow.filter(p => [WorkflowStage.CINEMATOGRAPHY, WorkflowStage.WRITER_VIDEO_APPROVAL, WorkflowStage.VIDEO_EDITING, WorkflowStage.SUB_EDITOR_ASSIGNMENT, WorkflowStage.SUB_EDITOR_PROCESSING, WorkflowStage.THUMBNAIL_DESIGN, WorkflowStage.CREATIVE_DESIGN].includes(p.current_stage as WorkflowStage) && p.status !== TaskStatus.DONE && p.status !== TaskStatus.REWORK);
      const approved = projectsToShow.filter(p => [WorkflowStage.OPS_SCHEDULING, WorkflowStage.POSTED].includes(p.current_stage as WorkflowStage) || p.status === TaskStatus.DONE);
      return { pendingList: pending, approvedList: approved };
    }

    const filterIdx = WORKFLOW_ORDER.indexOf(overviewFilter as WorkflowStage);
    const isStageFilter = filterIdx !== -1 && !['POSTED', 'REWORK'].includes(overviewFilter);
    if (!isStageFilter) return { pendingList: projectsToShow, approvedList: [] };
    
    const actualFilter = (overviewFilter === WorkflowStage.POST_WRITER_REVIEW || overviewFilter === WorkflowStage.FINAL_REVIEW_CMO) ? WorkflowStage.FINAL_REVIEW_CMO : overviewFilter;
    const pending = projectsToShow.filter(p => {
      const s = p.status === TaskStatus.DONE ? WorkflowStage.POSTED : (p.current_stage === WorkflowStage.POST_WRITER_REVIEW ? WorkflowStage.FINAL_REVIEW_CMO : p.current_stage);
      return s === actualFilter;
    });
    const approved = projectsToShow.filter(p => {
      const s = p.status === TaskStatus.DONE ? WorkflowStage.POSTED : (p.current_stage === WorkflowStage.POST_WRITER_REVIEW ? WorkflowStage.FINAL_REVIEW_CMO : p.current_stage);
      return s !== actualFilter;
    });
    return { pendingList: pending, approvedList: approved };
  }, [projectsToShow, overviewFilter]);

  const isSplitViewActive = ['CMO_REVIEW', 'CEO_REVIEW', 'IN_PRODUCTION'].includes(overviewFilter) || (WORKFLOW_ORDER.indexOf(overviewFilter as WorkflowStage) !== -1 && !['POSTED', 'REWORK'].includes(overviewFilter));

  const renderProjectCard = (project: Project, primaryMilestone?: { label: string; time: string | undefined; color?: string }, statusColor: string = 'bg-emerald-500') => {
    const rawMilestones = getMilestones(project);
    const finalMilestones: { label: string; time: string | undefined; color?: string }[] = [];
    if (primaryMilestone && primaryMilestone.time) {
      finalMilestones.push(primaryMilestone);
    }
    rawMilestones.forEach(rm => {
      if (finalMilestones.length < 3 && !finalMilestones.some(fm => fm.label === rm.label)) {
        finalMilestones.push(rm);
      }
    });

    const brand = getBrand(project);

    return (
      <div 
        key={project.id} 
        onClick={() => handleViewDetails(project)} 
        className={`group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full overflow-hidden`}
      >
        <div className="p-6 flex-grow relative">
          <div className="flex items-center justify-between mb-4">
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
              project.channel === 'YOUTUBE' ? 'bg-violet-700 text-white' : 
              project.channel === 'INSTAGRAM' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm' :
              project.channel === 'LINKEDIN' ? 'bg-indigo-700 text-white' :
              'bg-violet-600 text-white'
            }`}>{project.channel}</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full border border-white shadow-sm ${statusColor}`} />
            </div>
          </div>
          
          <h4 className="font-black text-lg text-slate-900 leading-tight mb-3 group-hover:text-indigo-600 transition-colors line-clamp-2 min-h-[3rem] uppercase tracking-tighter">
            {project.title}
            {project.brand && (
              <span className="text-slate-400 text-sm ml-2">({project.brand.replace(/_/g, ' ')})</span>
            )}
          </h4>
          
          
          <div className={`grid gap-x-6 gap-y-4 mt-6 py-4 border-t border-slate-50 ${finalMilestones.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {finalMilestones.map((m, idx) => {
              const formatted = formatDateWithTime(m.time);
              const [date, ...timeArr] = formatted.split(' ');
              const time = timeArr.join(' ');
              
              return (
                <div key={idx} className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</span>
                  <div className="flex flex-col leading-tight">
                    <span className={`text-[11px] font-black tracking-tight ${m.color || 'text-slate-800'}`}>{date}</span>
                    <span className="text-[10px] font-bold text-slate-400">{time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="mt-auto px-6 py-4 bg-slate-50/40 border-t border-slate-100 flex flex-col gap-3 group-hover:bg-indigo-50/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Stage</span>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-tighter shadow-sm ${
              [WorkflowStage.POSTED, WorkflowStage.OPS_SCHEDULING].includes(project.current_stage as WorkflowStage) ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
              [WorkflowStage.SCRIPT_REVIEW_L1, WorkflowStage.SCRIPT_REVIEW_L2, WorkflowStage.FINAL_REVIEW_CMO, WorkflowStage.FINAL_REVIEW_CEO].includes(project.current_stage as WorkflowStage) ? 'bg-amber-50 text-amber-600 border-amber-200' :
              'bg-indigo-50 text-indigo-600 border-indigo-200'
            }`}>{STAGE_LABELS[project.current_stage as WorkflowStage] || project.current_stage}</span>
          </div>
          
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              {(project.video_link || (project as any).video_url) && (
                <a href={project.video_link || (project as any).video_url} target="_blank" rel="noopener noreferrer" className="p-1 bg-emerald-50 text-emerald-600 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors" title="Raw Video" onClick={(e) => e.stopPropagation()}>
                  <Video size={12} />
                </a>
              )}
              {project.edited_video_link && (
                <a href={project.edited_video_link} target="_blank" rel="noopener noreferrer" className="p-1 bg-purple-50 text-purple-600 rounded border border-purple-100 hover:bg-purple-100 transition-colors" title="Edited Video" onClick={(e) => e.stopPropagation()}>
                  <PlayCircle size={12} />
                </a>
              )}
              {project.thumbnail_link && (
                <a href={project.thumbnail_link} target="_blank" rel="noopener noreferrer" className="p-1 bg-blue-50 text-blue-600 rounded border border-blue-100 hover:bg-blue-100 transition-colors" title="Thumbnail" onClick={(e) => e.stopPropagation()}>
                  <Layout size={12} />
                </a>
              )}
              {project.creative_link && (
                <a href={project.creative_link} target="_blank" rel="noopener noreferrer" className="p-1 bg-pink-50 text-pink-600 rounded border border-pink-100 hover:bg-pink-100 transition-colors" title="Creative Asset" onClick={(e) => e.stopPropagation()}>
                  <Tag size={12} />
                </a>
              )}
              <div className="w-px h-3 bg-slate-200 mx-1" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[8px] font-black text-indigo-400 shadow-sm border-indigo-100">{(project.writer_name || '?')[0]}</div>
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter truncate max-w-[60px]">{project.writer_name || '—'}</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0 group-hover:border-indigo-200">
              <ChevronRight size={14} className="text-indigo-500" />
            </div>
          </div>
        </div>
      </div>
    );
;
  };

  const renderProjectDetails = (project: Project) => (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={handleBackToOverview}
        className="flex items-center text-sm font-black text-slate-700 hover:text-slate-900 py-2 px-4 bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
      >
        ← Back to Overview
      </button>

      <div className="space-y-6">
        {/* Basic Info Section */}
        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-2xl font-black uppercase mb-4">Project Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Title</h3>
              <p className="font-medium bg-slate-50 p-2 truncate" title={project.title}>{project.title}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Channel</h3>
              <p className="font-medium bg-slate-50 p-2">{project.channel}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Writer</h3>
              <p className="font-medium bg-slate-50 p-2">
                {project.writer_name || '—'}
              </p>
            </div>
            {(project.assigned_to_role === Role.EDITOR || project.assigned_to_role === Role.SUB_EDITOR) && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Editor</h3>
                <p className="font-medium bg-slate-50 p-2">
                  {project.editor_name || project.sub_editor_name || project.data?.editor_name || project.data?.sub_editor_name || '—'}
                </p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h3>
              <p className="font-medium bg-slate-50 p-2">{project.status}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h3>
              <p className="font-medium bg-slate-50 p-2">{project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Priority</h3>
              <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                ? 'bg-red-500 text-white'
                : project.priority === 'NORMAL'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-green-500 text-white'
                }`}>
                {project.priority}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Assigned To</h3>
              <p className="font-medium bg-slate-50 p-2">{project.assigned_to_role || 'Unassigned'}</p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Created At</h3>
              <p className="font-medium bg-slate-50 p-2">{new Date(project.created_at).toLocaleString()}</p>
            </div>
            {project.brand && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Brand</h3>
                <p className="font-black text-[#0085FF] uppercase bg-slate-50 p-2">{project.brand.replace(/_/g, ' ')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Influencer Details - If exists */}
        {(project.data?.influencer_name || (project as any).metadata?.influencer_name) && (
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black uppercase mb-4">Influencer Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Influencer Name</h3>
                <p className="font-black text-purple-600 uppercase bg-slate-50 p-2">
                  {project.data?.influencer_name || (project as any).metadata?.influencer_name}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Collaboration Status</h3>
                <p className="font-bold text-emerald-600 uppercase bg-slate-50 p-2">Active Collaboration</p>
              </div>
            </div>
          </div>
        )}

        {/* Script Content Section */}
        {(project.data?.script_content || project.data?.idea_description) && (
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-lg font-black uppercase mb-4">
              {project.data?.source === 'IDEA_PROJECT' ? 'Idea Description' : 'Script Content'}
            </h3>
            <div className="max-h-60 overflow-y-auto border-2 border-gray-200 p-4 bg-gray-50">
              {project.data?.script_content || project.data?.idea_description ? (
                <div
                  className="whitespace-pre-wrap font-sans text-sm"
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      let content = project.data?.script_content || project.data?.idea_description || 'No content available';
                      if (content !== 'No content available') {
                        // Decode HTML entities to properly display the content
                        content = content
                          .replace(/&lt;/g, '<')
                          .replace(/&gt;/g, '>')
                          .replace(/&amp;/g, '&')
                          .replace(/&quot;/g, '"')
                          .replace(/&#39;/g, "'")
                          .replace(/&nbsp;/g, ' ');
                      }
                      return content;
                    })()
                  }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  No content available
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Workflow Status Section */}
        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-lg font-black uppercase mb-4">Workflow Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h4>
              <p className="font-medium bg-slate-50 p-2">{project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h4>
              <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${project.status === 'DONE'
                ? 'bg-green-500 text-white'
                : project.status === 'WAITING_APPROVAL'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-blue-500 text-white'
                }`}>
                {project.status}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Rework Summary</h4>
              <div className="bg-slate-50 p-3 flex flex-col gap-1">
                <span className="font-black text-slate-900">
                  Count: {comments.filter(c => c.action === 'REWORK' || c.action === 'REJECTED').length}
                </span>
                {comments.some(c => c.action === 'REWORK' || c.action === 'REJECTED') && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    Initiated by: {[...new Set(comments.filter(c => c.action === 'REWORK' || c.action === 'REJECTED').map(r => r.actor_name))].join(', ')}
                  </span>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Project Type</h4>
              <span className="inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                {project.data?.source === 'IDEA_PROJECT' ? (project.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA') : 'SCRIPT'}
              </span>
            </div>
          </div>
        </div>

        {/* Production Assets Section */}
        {(project.video_link || project.video_url || project.edited_video_link || project.thumbnail_link || project.creative_link || project.data?.posting_proof_link) && (
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-lg font-black uppercase mb-4">Production Assets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(project.video_link || project.video_url) && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Raw Video</h4>
                  <a 
                    href={project.video_link || project.video_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-3 p-4 bg-emerald-50 border-2 border-emerald-100 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-all group"
                  >
                    <div className="bg-white p-2 border border-emerald-200 rounded-lg group-hover:scale-110 transition-transform">
                      <Video className="w-4 h-4" />
                    </div>
                    <span className="text-sm">View Raw Video</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-50" />
                  </a>
                </div>
              )}
              {project.edited_video_link && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Edited Video</h4>
                  <a 
                    href={project.edited_video_link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-3 p-4 bg-purple-50 border-2 border-purple-100 text-purple-700 rounded-xl font-bold hover:bg-purple-100 transition-all group"
                  >
                    <div className="bg-white p-2 border border-purple-200 rounded-lg group-hover:scale-110 transition-transform">
                      <PlayCircle className="w-4 h-4" />
                    </div>
                    <span className="text-sm">View Edited Video</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-50" />
                  </a>
                </div>
              )}
              {project.thumbnail_link && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Thumbnail</h4>
                  <a 
                    href={project.thumbnail_link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-3 p-4 bg-blue-50 border-2 border-blue-100 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all group"
                  >
                    <div className="bg-white p-2 border border-blue-200 rounded-lg group-hover:scale-110 transition-transform">
                      <Layout className="w-4 h-4" />
                    </div>
                    <span className="text-sm">View Thumbnail</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-50" />
                  </a>
                </div>
              )}
              {project.creative_link && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Creative Asset</h4>
                  <a 
                    href={project.creative_link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-3 p-4 bg-pink-50 border-2 border-pink-100 text-pink-700 rounded-xl font-bold hover:bg-pink-100 transition-all group"
                  >
                    <div className="bg-white p-2 border border-pink-200 rounded-lg group-hover:scale-110 transition-transform">
                      <Tag className="w-4 h-4" />
                    </div>
                    <span className="text-sm">View Creative</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-50" />
                  </a>
                </div>
              )}
              {project.data?.posting_proof_link && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Proof of Posting</h4>
                  <a 
                    href={project.data.posting_proof_link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-3 p-4 bg-orange-50 border-2 border-orange-100 text-orange-700 rounded-xl font-bold hover:bg-orange-100 transition-all group"
                  >
                    <div className="bg-white p-2 border border-orange-200 rounded-lg group-hover:scale-110 transition-transform">
                      <Link className="w-4 h-4" />
                    </div>
                    <span className="text-sm">View Posting Proof</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-50" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comments and Feedback Section - Same as CMO Project Details */}
        <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-xl font-black uppercase mb-6 border-b-2 border-black pb-3 text-slate-900">
            Project Comments & Feedback
          </h3>

          {/* Display current project dates and script reference link if they exist */}
          {(selectedProject?.shoot_date || selectedProject?.delivery_date || selectedProject?.post_scheduled_date || selectedProject?.data?.script_reference_link) && (
            <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!['JOBBOARD', 'LEAD_MAGNET'].includes(selectedProject.content_type) && selectedProject?.shoot_date && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">📅 Shoot Date:</span>
                    <span className="font-bold text-green-600">{formatDateDDMMYYYY(selectedProject.shoot_date)}</span>
                  </div>
                )}
                {selectedProject?.delivery_date && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">📦 Delivery Date:</span>
                    <span className="font-bold text-blue-600">{formatDateDDMMYYYY(selectedProject.delivery_date)}</span>
                  </div>
                )}
                {selectedProject?.post_scheduled_date && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">🗓️ Post Date:</span>
                    <span className="font-bold text-purple-600">{formatDateDDMMYYYY(selectedProject.post_scheduled_date)}</span>
                  </div>
                )}
                {selectedProject?.data?.script_reference_link && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">🔗 Script Link:</span>
                    <a href={selectedProject.data.script_reference_link} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 underline">
                      View Script
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fetch and display comments similar to CMO Project Details */}
          {comments.length > 0 ? (
            <div className="space-y-6">
              {comments.map((comment, index) => {
                // Determine the description based on stage and action
                let description = `${comment.action} in ${comment.stage}`;

                switch (comment.stage) {
                  case 'SCRIPT':
                    if (comment.action === 'SUBMITTED') {
                      description = 'Project submitted by writer';
                    }
                    break;
                  case 'SCRIPT_REVIEW_L1':
                    if (comment.action === 'APPROVED') {
                      description = 'Project approved by CMO';
                    } else if (comment.action === 'REWORK') {
                      description = 'CMO requested rework';
                    }
                    break;
                  case 'FINAL_REVIEW_CMO':
                    if (comment.action === 'APPROVED') {
                      description = 'Project approved by CMO';
                    } else if (comment.action === 'REWORK') {
                      description = 'CMO requested rework';
                    }
                    break;
                  case 'FINAL_REVIEW_CEO':
                    if (comment.action === 'APPROVED') {
                      description = 'Project approved by CEO';
                    } else if (comment.action === 'REWORK') {
                      description = 'CEO requested rework';
                    }
                    break;
                  case 'MULTI_WRITER_APPROVAL':
                    if (comment.action === 'APPROVED') {
                      description = 'Writer approved the final video';
                    } else if (comment.action === 'SUBMITTED') {
                      description = 'All writers have approved - Project advanced to CMO for final review';
                    }
                    break;
                  case 'CINEMATOGRAPHY':
                    if (comment.action === 'SUBMITTED') {
                      description = 'Raw video uploaded by cinematographer';
                    }
                    break;
                  case 'VIDEO_EDITING':
                    if (comment.action === 'SUBMITTED') {
                      description = 'Edited video uploaded by editor';
                    }
                    break;
                  case 'SUB_EDITOR_PROCESSING':
                    if (comment.action === 'SUBMITTED') {
                      description = 'Edited video uploaded by sub-editor';
                    } else if (comment.action === 'APPROVED') {
                      description = 'Sub-editor completed processing';
                    }
                    break;
                  case 'THUMBNAIL_DESIGN':
                    if (comment.action === 'SUBMITTED') {
                      description = 'Assets uploaded by designer';
                    }
                    break;
                  default:
                    // Handle special actions that might not have a specific stage mapping
                    if (comment.action === 'SET_SHOOT_DATE') {
                      description = 'Shoot date set';
                    } else if (comment.action === 'SET_DELIVERY_DATE') {
                      description = 'Delivery date set';
                    } else if (comment.action === 'REWORK_VIDEO_SUBMITTED') {
                      description = 'Rework video uploaded';
                    } else if (comment.action === 'SUB_EDITOR_ASSIGNED') {
                      description = 'Project assigned to sub-editor';
                    } else {
                      description = `${comment.action} in ${comment.stage}`;
                    }
                }

                return (
                  <div key={`${comment.stage}-${comment.action}-${comment.timestamp}-${comment.actor_id || comment.actor_name}`} className={`border-l-4 pl-4 py-2 ${comment.action === 'APPROVED' ? 'border-green-500' : comment.action === 'REWORK' ? 'border-yellow-500' : 'border-red-500'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-900">{comment.actor_name}</p>
                        <p className="text-sm text-slate-600">{format(new Date(comment.timestamp), 'MMM dd, yyyy h:mm a')}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-bold uppercase ${comment.action === 'APPROVED' ? 'bg-green-100 text-green-800' : comment.action === 'REWORK' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {comment.action}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-700">{comment.comment || description}</p>
                    {/* Display shoot date and delivery date based on action type */}
                    {comment.action === 'SET_SHOOT_DATE' && (
                      <div className="mt-2 text-sm text-slate-600 font-bold">
                        📅 Shoot Date: <span className="text-green-600">{comment.comment || selectedProject?.shoot_date}</span>
                      </div>
                    )}
                    {comment.action === 'SET_DELIVERY_DATE' && (
                      <div className="mt-2 text-sm text-slate-600 font-bold">
                        📅 Delivery Date: <span className="text-blue-600">{comment.comment || selectedProject?.delivery_date}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 italic font-medium">Comments and feedback will appear here as they are added</p>
              <p className="text-sm text-gray-400 mt-1">No comments or feedback recorded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (viewMode === 'DETAILS' && selectedProject) {
    return (
      <div ref={topRef}>
        {renderProjectDetails(selectedProject)}
      </div>
    );
  }

  return (
    <div ref={topRef} className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div><h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Overview</h1><p className="text-gray-500 font-medium mt-1">Manage and track your content pipeline in real-time.</p></div>
        {brandStats.list.length > 0 && (
          <div className="bg-white p-1.5 border border-slate-200 rounded-2xl shadow-sm flex flex-wrap gap-1">
            {brandStats.list.map(b => (
              <button 
                key={b} 
                onClick={() => setBrandFilter(b)} 
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                  (brandFilter === b || (!brandFilter && brandStats.list[0] === b)) 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sub-tabs: Scripts / Influencers */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1.5 w-fit">
        <button
          onClick={() => {
            setActiveSubTab('SCRIPTS');
            setActiveKpi(null);
          }}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeSubTab === 'SCRIPTS'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          Scripts
        </button>
        <button
          onClick={() => {
            setActiveSubTab('INFLUENCERS');
            setActiveKpi(null);
          }}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeSubTab === 'INFLUENCERS'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          Influencers
        </button>
      </div>

      {activeSubTab === 'INFLUENCERS' && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 animate-in fade-in duration-500">
          <div className="flex-1 bg-white border-2 border-slate-200 shadow-sm rounded-xl p-3 flex items-center">
              <div className="relative w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search influencers by name or handle..." 
                    value={influencerSearchTerm} 
                    onChange={(e) => setInfluencerSearchTerm(e.target.value)} 
                    className="w-full pl-12 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-lg font-medium focus:outline-none focus:bg-white focus:border-slate-300 transition-all text-sm" 
                  />
              </div>
          </div>
          {influencerSearchTerm !== '' && (
            <div className="flex items-center gap-2">
              <button 
                  onClick={() => setInfluencerSearchTerm('')} 
                  className="px-6 py-4 bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 rounded-xl font-bold uppercase text-[10px] transition-all flex items-center gap-2"
              >
                  <X className="w-3 h-3" /> Clear Search
              </button>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'SCRIPTS' && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-orange-500 rounded-full anim-pulse"></span>
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Pending Review</span>
              </div>
              <div className="flex items-center gap-2 border-l border-gray-200 pl-6">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Passed / Approved</span>
              </div>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Click any card to filter projects</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                id: '', 
                label: 'Total Scripts', 
                value: kpiData.total, 
                icon: BarChart2, 
                color: 'text-indigo-600', 
                bg: 'bg-indigo-50', 
                subtitle: 'Overview across all brands' 
              },
              { 
                id: 'CMO_REVIEW', 
                label: 'CMO Review', 
                pending: kpiData.cmoTotal,
                approved: kpiData.cmoApproved,
                icon: AlertTriangle, 
                color: 'text-amber-600', 
                bg: 'bg-amber-50', 
                subtitle: `${kpiData.cmoScript} Script | ${kpiData.cmoFinal} Final` 
              },
              { 
                id: 'CEO_REVIEW', 
                label: 'CEO Review', 
                pending: kpiData.ceoTotal,
                approved: kpiData.ceoApproved,
                icon: Shield, 
                color: 'text-rose-600', 
                bg: 'bg-rose-50', 
                subtitle: `${kpiData.ceoScript} Script | ${kpiData.ceoFinal} Final` 
              },
              { 
                id: 'IN_PRODUCTION', 
                label: 'In Production', 
                pending: kpiData.prodTotal,
                approved: kpiData.prodApproved,
                icon: PlayCircle, 
                color: 'text-teal-600', 
                bg: 'bg-teal-50', 
                subtitle: `Cine: ${kpiData.cine} | Edit: ${kpiData.editor} | Design: ${kpiData.designer}` 
              },
              { 
                id: 'REWORK', 
                label: 'Reworks', 
                value: kpiData.rework, 
                icon: RefreshCw, 
                color: 'text-red-600', 
                bg: 'bg-red-50', 
                subtitle: 'Action required' 
              },
              { 
                id: 'COMPLETED', 
                label: 'Posted', 
                value: kpiData.completed, 
                icon: CheckCircle2, 
                color: 'text-emerald-600', 
                bg: 'bg-emerald-50', 
                subtitle: 'Published' 
              }
            ].map(card => {
              const Icon = card.icon;
              const active = overviewFilter === card.id;
              return (
                <button key={card.id} onClick={() => setOverviewFilter(active ? '' : card.id)} className={`text-left p-6 rounded-2xl border transition-all relative overflow-hidden group ${active ? 'bg-white border-blue-500 shadow-lg' : 'bg-white border-gray-200 hover:shadow-md'}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`inline-flex p-2.5 rounded-xl ${card.bg} ${card.color}`}><Icon size={20} /></div>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-widest">{card.label}</span>
                  </div>
                  <div className="flex flex-col">
                    {card.pending !== undefined ? (
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black text-slate-900 leading-tight">{card.pending}</span>
                          <span className="text-xs font-black text-orange-600 uppercase tracking-tighter">Pending Action</span>
                        </div>
                        <div className="flex items-baseline gap-2 -mt-1">
                          <span className="text-2xl font-bold text-slate-400">{card.approved}</span>
                          <span className="text-[10px] font-black text-green-600 uppercase tracking-tighter">Approved</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-3xl font-bold text-gray-900">{card.value}</span>
                    )}
                    {card.subtitle && <span className="text-[10px] font-extrabold text-slate-400 uppercase mt-2 tracking-tighter">{card.subtitle}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-6 pt-8 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4"><h3 className="text-xl font-bold text-gray-900">Scripts</h3>{overviewFilter && (<div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100">{STAGE_LABELS[overviewFilter as WorkflowStage] || overviewFilter}<button onClick={() => setOverviewFilter('')} className="hover:text-blue-900">✕</button></div>)}</div>
              <div className="text-right flex flex-col items-end gap-1">
                <p className="text-xs text-gray-400 font-black uppercase tracking-widest">{projectsToShow.length} items found</p>
                {isSplitViewActive && (
                  <div className="flex items-center gap-4 text-xs font-black uppercase tracking-wider">
                    <span className="bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm">{pendingList.length} Pending</span>
                    <span className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg border border-green-100 shadow-sm">{approvedList.length} Approved</span>
                  </div>
                )}
              </div>
            </div>
            {loading ? (<div className="py-24 text-center text-gray-400">Loading...</div>) : projectsToShow.length === 0 ? (<div className="py-24 text-center bg-gray-50 rounded-3xl border border-dashed text-gray-400">No scripts found</div>) : (
              <div className="space-y-12">
                {pendingList.length > 0 && (
                  <div className="space-y-6">
                    {isSplitViewActive && <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Pending at Stage</h4>}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pendingList.map(project => {
                        const filterIdx = WORKFLOW_ORDER.indexOf(overviewFilter as WorkflowStage);
                        
                        // If filter is active, look for approval of previous stage
                        // If NO filter active, look for approval of project's previous stage
                        const targetIdx = filterIdx !== -1 
                          ? filterIdx - 1 
                          : WORKFLOW_ORDER.indexOf(project.current_stage) - 1;
                        
                        const info = findPreviousApproval(project, targetIdx);
                        return renderProjectCard(project, info || undefined, 'bg-orange-500');
                      })}
                    </div>
                  </div>
                )}
                {approvedList.length > 0 && (
                  <div className="space-y-6">
                    {isSplitViewActive && <h4 className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Approved</h4>}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {approvedList.map(project => {
                        // For approved items, we explicitly want the approval for the stage they just passed (overviewFilter)
                        const info = getStageApprovalInfo(project, overviewFilter);
                        return renderProjectCard(project, info.time ? info : undefined, 'bg-emerald-500');
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {activeSubTab === 'INFLUENCERS' && (
        <div className="space-y-8 animate-in fade-in duration-500">

          {/* PA Brands-style: show SearchResultsTable when searching, KPIs otherwise */}
          {influencerSearchTerm ? (
            <SearchResultsTable
              rows={filteredInfluencerRows}
              searchQuery={influencerSearchTerm}
              isLoading={false}
              resultsLabel="Influencer search results"
              onClearSearch={() => setInfluencerSearchTerm('')}
              openPopoverId={openPopoverId}
              onTogglePopover={(id) => setOpenPopoverId(openPopoverId === id ? null : id)}
              onSelectBrand={handleSelectBrandDetails}
              onViewDetails={handleInfluencerRowViewDetails}
              expandedRowId={expandedRowId}
              expandedBrandData={expandedBrandData}
              onCloseExpanded={() => { setExpandedRowId(null); setExpandedBrandData(null); }}
              userRole={user.role}
            />
          ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(brandDashboardMetrics.isStory ? [
              {
                id: 'INFLUENCERS',
                label: 'Total Influencers',
                value: brandDashboardMetrics.totalInfluencers,
                icon: Users,
                color: 'text-violet-600',
                bg: 'bg-violet-50',
                subtitle: 'Active creators'
              },
              {
                id: 'SCRIPTS',
                label: 'Total Stories',
                value: brandDashboardMetrics.totalScripts,
                icon: PlayCircle,
                color: 'text-indigo-600',
                bg: 'bg-indigo-50',
                subtitle: 'Total stories submitted'
              },
              {
                id: 'APPROVE',
                label: 'Approve',
                value: brandDashboardMetrics.totalApprove,
                icon: CheckCircle2,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                subtitle: 'Approved content'
              },
              {
                id: 'BUDGET',
                label: 'Total Budget',
                value: `$${brandDashboardMetrics.totalBudget.toLocaleString()}`,
                icon: DollarSign,
                color: 'text-purple-600',
                bg: 'bg-purple-50',
                subtitle: 'Total brand budget'
              },
              {
                id: 'LEADS',
                label: 'Total Leads',
                value: brandDashboardMetrics.totalLeads,
                icon: TrendingUp,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                subtitle: 'Conversions generated'
              }
            ] : [
              {
                id: 'INFLUENCERS',
                label: 'Total Influencers',
                value: brandDashboardMetrics.totalInfluencers,
                icon: Users,
                color: 'text-violet-600',
                bg: 'bg-violet-50',
                subtitle: 'Active creators'
              },
              {
                id: 'SCRIPTS',
                label: 'Scripts Sent',
                value: brandDashboardMetrics.totalScripts,
                icon: FileText,
                color: 'text-indigo-600',
                bg: 'bg-indigo-50',
                subtitle: 'Sent to creators'
              },
              {
                id: 'RAW',
                label: 'Raw Videos',
                value: brandDashboardMetrics.rawVideosReceived,
                icon: Video,
                color: 'text-amber-600',
                bg: 'bg-amber-50',
                subtitle: 'Raw footage uploaded'
              },
              {
                id: 'EDITED',
                label: 'Edited Videos',
                value: brandDashboardMetrics.editedVideos,
                icon: PlayCircle,
                color: 'text-blue-600',
                bg: 'bg-blue-50',
                subtitle: 'Final edits ready'
              },
              {
                id: 'APPROVE',
                label: 'Approve',
                value: brandDashboardMetrics.totalApprove,
                icon: CheckCircle2,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                subtitle: 'Approved content'
              },
              {
                id: 'PROOF',
                label: 'Proof',
                value: brandDashboardMetrics.totalProof,
                icon: FileCheck,
                color: 'text-sky-600',
                bg: 'bg-sky-50',
                subtitle: 'Verification links'
              },
              {
                id: 'BUDGET',
                label: 'Total Budget',
                value: `$${brandDashboardMetrics.totalBudget.toLocaleString()}`,
                icon: DollarSign,
                color: 'text-purple-600',
                bg: 'bg-purple-50',
                subtitle: 'Total brand budget'
              },
              {
                id: 'LEADS',
                label: 'Total Leads',
                value: brandDashboardMetrics.totalLeads,
                icon: TrendingUp,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                subtitle: 'Conversions generated'
              }
            ]).map(card => {
              const Icon = card.icon;
              const active = activeKpi === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => setActiveKpi(active ? null : card.id)}
                  className={`text-left p-6 rounded-2xl border transition-all relative overflow-hidden group ${
                    active ? 'bg-white border-blue-500 shadow-lg ring-4 ring-blue-500/10' : 'bg-white border-gray-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`inline-flex p-2.5 rounded-xl ${card.bg} ${card.color}`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-widest">{card.label}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-3xl font-bold text-gray-900">{card.value}</span>
                    {card.subtitle && (
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase mt-2 tracking-tighter">
                        {card.subtitle}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* KPI Detail Sections */}
          <div className="mt-8 transition-all animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Influencer Details */}
            {activeKpi === 'INFLUENCERS' && brandDashboardMetrics.influencerList.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-violet-600" /> Influencer Registry
                  </h3>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Total {brandDashboardMetrics.influencerList.length} Active Influencers
                    </span>
                    <button onClick={() => setActiveKpi(null)} className="text-slate-400 hover:text-slate-900 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Registry Table (no search active) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Creator Name</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Handle & Contact</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Niche & Location</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Budget</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {brandDashboardMetrics.influencerList.filter((inf: any) => {
                        if (!influencerSearchTerm) return true;
                        const dbInf = (brandFilter === 'ALL' ? allInfluencers : brandInfluencers).find(i => i.influencer_name === inf.name);
                        const term = influencerSearchTerm.toLowerCase();
                        return (
                          inf.name?.toLowerCase().includes(term) ||
                          dbInf?.instagram_profile?.toLowerCase().includes(term) ||
                          dbInf?.instagram_handle?.toLowerCase().includes(term) ||
                          dbInf?.influencer_email?.toLowerCase().includes(term) ||
                          dbInf?.contact_details?.toLowerCase().includes(term) ||
                          dbInf?.niche?.toLowerCase().includes(term) ||
                          dbInf?.location?.toLowerCase().includes(term) ||
                          dbInf?.campaign_type?.toLowerCase().includes(term) ||
                          dbInf?.budget?.toString().toLowerCase().includes(term) ||
                          dbInf?.product_name?.toLowerCase().includes(term) ||
                          dbInf?.platform_type?.toLowerCase().includes(term) ||
                          dbInf?.vercel_form_link?.toLowerCase().includes(term) ||
                          dbInf?.script_content?.toLowerCase().includes(term) ||
                          dbInf?.project_title?.toLowerCase().includes(term) ||
                          (dbInf?.influencer_links || []).some((linkObj: any) => linkObj.link?.toLowerCase().includes(term)) ||
                          (dbInf?.stories || []).some((s: any) => s.story_caption?.toLowerCase().includes(term))
                        );
                      }).map((inf: any) => {
                        const dbInf = (brandFilter === 'ALL' ? allInfluencers : brandInfluencers).find(i => i.influencer_name === inf.name);
                        return (
                          <tr key={inf.name} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-xs font-black text-violet-600 uppercase">
                                  {inf.name[0]}
                                </div>
                                <span className="font-bold text-slate-900">{inf.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                {dbInf?.instagram_handle ? (
                                  <a href={`https://instagram.com/${dbInf.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-pink-600 hover:underline">
                                    <Instagram className="w-3 h-3" /> {dbInf.instagram_handle}
                                  </a>
                                ) : <span className="text-slate-300 text-xs">No Handle</span>}
                                <span className="text-[10px] text-slate-500">{dbInf?.influencer_email || 'No Email'}</span>
                                <span className="text-[9px] text-slate-400">{dbInf?.contact_details || ''}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-slate-700">{dbInf?.niche || 'N/A'}</span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <MapPin className="w-2.5 h-2.5" /> {dbInf?.location || 'Unknown'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-emerald-600">${dbInf?.budget || 0}</span>
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => {
                                  const bName = dbInf?.brand_name || brandFilter;
                                  if (bName && bName !== 'ALL') {
                                    navigate(`/cmo/brand-details/${encodeURIComponent(bName)}?highlightInfluencer=${encodeURIComponent(inf.name)}`);
                                  } else {
                                    toast.error("Select a brand first to view details");
                                  }
                                }}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-sm"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CEO Approved Scripts Details */}
            {activeKpi === 'SCRIPTS' && (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">CEO Approved Scripts</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active & Ready for Outreach</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveKpi(null)} className="text-slate-400 hover:text-slate-900 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Script Title</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Brand</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Approved Date</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Current Stage</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {brandDashboardMetrics.scriptList
                        .filter((script: any) => 
                          !!script.ceo_approved_at || 
                          ![WorkflowStage.SCRIPT, WorkflowStage.SCRIPT_REVIEW_L1, WorkflowStage.SCRIPT_REVIEW_L2].includes(script.current_stage)
                        )
                        .map((script: any) => (
                          <tr key={script.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-900">{script.title}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 rounded text-slate-500 whitespace-nowrap">
                                {script.brand || 'Unbranded'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-slate-500">
                              {script.ceo_approved_at ? format(new Date(script.ceo_approved_at), 'MMM dd, yyyy') : 'Recently Approved'}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-emerald-50 rounded-full text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                                {script.current_stage === WorkflowStage.PARTNER_REVIEW ? 'OUTREACH READY' : (STAGE_LABELS[script.current_stage] || script.current_stage.replace(/_/g, ' '))}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => handleViewDetails(script as any)}
                                className="text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:underline"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Leads Details */}
            {activeKpi === 'LEADS' && (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Leads Intelligence</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Influencer Specific Conversions</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveKpi(null)} className="text-slate-400 hover:text-slate-900 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Lead Name</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Source Intelligence</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Stage & Status</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Assignment</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Captured At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {brandDashboardMetrics.leadList.map((lead: any) => (
                        <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900 block">{lead.full_name || lead.name || 'Anonymous'}</span>
                            <button 
                              onClick={() => {
                                const bName = brandFilter === 'ALL' ? (lead.brand || '') : brandFilter;
                                navigate('/cmo/leads', { state: { brandFilter: bName } });
                              }}
                              className="text-[9px] font-black text-indigo-600 hover:underline uppercase mt-1"
                            >
                              View Full Details
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-slate-600">{lead.email || 'No Email'}</span>
                              <span className="text-[10px] text-slate-400">{lead.phone || ''}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 rounded text-slate-500">
                              {lead.source || 'Direct'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5">
                              <span className="px-3 py-1 bg-indigo-50 rounded-full text-[10px] font-black uppercase text-indigo-600 tracking-wider w-fit">
                                Stage: {lead.current_stage || lead.stage || 'UNTRACKED'}
                              </span>
                              <span className="px-3 py-1 bg-emerald-50 rounded-full text-[10px] font-black uppercase text-emerald-600 tracking-wider w-fit">
                                Status: {lead.status || 'NEW'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-7 h-7 bg-slate-100 rounded flex items-center justify-center font-bold text-[10px] text-slate-600 shrink-0">
                                {lead.assigned_to?.charAt(0) || <Users size={12} />}
                              </div>
                              <span className="text-[11px] font-semibold text-slate-700 truncate">{lead.assigned_to || 'Unassigned'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-500">
                            {lead.created_at ? format(new Date(lead.created_at), 'MMM dd, HH:mm') : 'N/A'}
                          </td>
                        </tr>
                      ))}
                      {brandDashboardMetrics.leadList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                            No leads found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detailed Drill-down for Workflow & Budget KPIs */}
            {['RAW', 'EDITED', 'PROOF', 'BUDGET'].includes(activeKpi || '') && (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                      activeKpi === 'RAW' ? 'bg-pink-600' :
                      activeKpi === 'EDITED' ? 'bg-purple-600' :
                      activeKpi === 'PROOF' ? 'bg-orange-600' :
                      'bg-emerald-600'
                    }`}>
                      {activeKpi === 'RAW' ? <Video className="w-5 h-5 text-white" /> :
                       activeKpi === 'EDITED' ? <PlayCircle className="w-5 h-5 text-white" /> :
                       activeKpi === 'PROOF' ? <FileCheck className="w-5 h-5 text-white" /> :
                       <DollarSign className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                        {activeKpi === 'RAW' ? 'Raw Footage Inventory' :
                         activeKpi === 'EDITED' ? 'Edited Video Pipeline' :
                         activeKpi === 'PROOF' ? 'Proof Link Verification' :
                         'Budget Distribution'}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {activeKpi === 'BUDGET' ? 'Financial Overview' : 'Live Management Interface'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setActiveKpi(null)} className="text-slate-400 hover:text-slate-900 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Influencer</th>
                        {activeKpi === 'BUDGET' ? (
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                        ) : (
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Asset/Link</th>
                        )}
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(brandFilter === 'ALL' ? allInfluencers : brandInfluencers)
                        .filter(inf => {
                          if (activeKpi === 'RAW') return !!inf.raw_video;
                          if (activeKpi === 'EDITED') return !!inf.edited_video;
                          if (activeKpi === 'PROOF') return !!inf.proof_link;
                          if (activeKpi === 'BUDGET') return !!inf.budget && inf.budget !== '0' && inf.budget !== 0;
                          return true;
                        })
                        .map((inf: any) => (
                          <tr key={inf.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-900 block">{inf.influencer_name}</span>
                              <span className="text-[10px] text-slate-400">{inf.influencer_email || ''}</span>
                            </td>
                            <td className="px-6 py-4">
                              {activeKpi === 'BUDGET' ? (
                                <span className="text-sm font-black text-emerald-600">${inf.budget || 0}</span>
                              ) : (
                                <a 
                                  href={activeKpi === 'RAW' ? inf.raw_video : activeKpi === 'EDITED' ? inf.edited_video : inf.proof_link} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-indigo-600 hover:underline flex items-center gap-1.5 text-xs font-bold"
                                >
                                  <ExternalLink className="w-3 h-3" /> 
                                  {activeKpi === 'RAW' ? 'Raw Video' : activeKpi === 'EDITED' ? 'Edited Video' : 'Proof Link'}
                                </a>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                {STAGE_LABELS[inf.project_status] || inf.project_status || 'READY'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => {
                                  const bName = inf.brand_name || brandFilter;
                                  if (bName && bName !== 'ALL') {
                                    navigate(`/cmo/brand-details/${encodeURIComponent(bName)}?highlightInfluencer=${encodeURIComponent(inf.influencer_name)}`);
                                  } else {
                                    toast.error("Pipeline data missing");
                                  }
                                }}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-sm"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      {(brandFilter === 'ALL' ? allInfluencers : brandInfluencers)
                        .filter(inf => {
                          if (activeKpi === 'RAW') return !!inf.raw_video;
                          if (activeKpi === 'EDITED') return !!inf.edited_video;
                          if (activeKpi === 'PROOF') return !!inf.proof_link;
                          if (activeKpi === 'BUDGET') return !!inf.budget && inf.budget !== '0' && inf.budget !== 0;
                          return true;
                        }).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">
                            No records found for this category
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          </>
          )} {/* end: search/KPI ternary */}
        </div>
      )}
    </div>
  );
};

export default CmoOverview;