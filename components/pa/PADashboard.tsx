import React, { useState, useEffect } from 'react';
import { User, Project, Role, WorkflowStage, Channel } from '../../types';
import { db } from '../../services/supabaseDb';
import { Plus, CheckCircle2, AlertCircle, Building2, FilePlus, ArrowLeft, Clock, User as UserIcon, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import Layout from '../Layout';
import PAMyWork from './PAMyWork';
import PAOverview from './PAOverview';
import PACalendar from './PACalendar';
import CreateScript from '../writer/CreateScript';
import PAReviewScreen from './PAReviewScreen';
import { toast } from 'sonner';
import PAVideoApproved from './PAVideoApproved';
import PACeoApprovedScripts from './PACeoApprovedScripts';
import PAInfluencerManagement from './PAInfluencerManagement';

interface PADashboardProps {
  user: User;
  onLogout: () => void;
  allProjects: Project[];
  refreshData: (user: User) => Promise<void>;
}
type DashboardMode = 'landing' | 'add-brand';

const SYSTEM_BRANDS = [
  { id: 'sys-1', brand_name: 'Shyam Personal Brand', target_audience: 'Founders & Creators', campaign_objective: 'Personal Branding', isSystem: true },
  { id: 'sys-2', brand_name: 'ApplyWizz', target_audience: 'Job Seekers', campaign_objective: 'App Installations', isSystem: true },
  { id: 'sys-3', brand_name: 'ApplyWizz Job Board', target_audience: 'Employers & Job Seekers', campaign_objective: 'Job Board Engagement', isSystem: true },
  { id: 'sys-4', brand_name: 'Lead Magnet (RTW)', target_audience: 'B2B Leads', campaign_objective: 'Lead Generation', isSystem: true },
  { id: 'sys-5', brand_name: 'ApplyWizz USA Jobs', target_audience: 'US Job Seekers', campaign_objective: 'US Market Reach', isSystem: true },
];

const PADashboard: React.FC<PADashboardProps> = ({ user, onLogout, allProjects, refreshData }) => {
  const { projectId: routeProjectId } = useParams();
  const navigate = useNavigate();
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('landing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingScript, setIsCreatingScript] = useState(false);
  const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);
  const [isFromCeoApproved, setIsFromCeoApproved] = useState(() => {
    // Initialize from URL on page load
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('source') === 'ceo-approved';
  });

  // Wrapper for state + navigation
  const setSelectedProject = (p: Project | null, fromCeoApproved = false) => {
    if (p) {
      // Always navigate to /review/{projectId} with source parameter
      const sourceParam = fromCeoApproved ? '?source=ceo-approved' : '';
      navigate(`/partner_associate/review/${p.id}${sourceParam}`);
    } else {
      navigate('/partner_associate');
    }
    setSelectedProjectState(p);
    setIsFromCeoApproved(fromCeoApproved);
  };

  useEffect(() => {
    if (routeProjectId && allProjects.length > 0) {
      const p = allProjects.find(item => item.id === routeProjectId);
      if (p && (!selectedProject || selectedProject.id !== p.id)) {
        setSelectedProjectState(p);
        // Check URL for source parameter
        const urlParams = new URLSearchParams(window.location.search);
        const source = urlParams.get('source');
        const isCeoApproved = source === 'ceo-approved';
        console.log('Project loaded, source:', source, 'isFromCeoApproved:', isCeoApproved);
        setIsFromCeoApproved(isCeoApproved);
      }
    } else if (!routeProjectId && selectedProject) {
        setSelectedProjectState(null);
    }
  }, [routeProjectId, allProjects, selectedProject]);

  const [brands, setBrands] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'EDITOR' | 'POSTED'>('PENDING');

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const data = await db.brands.getAll();
        setBrands([...SYSTEM_BRANDS, ...data]);
      } catch (err) {
        console.error("Failed to load brands:", err);
        setBrands(SYSTEM_BRANDS);
      }
    };

    fetchBrands();
  }, [successMessage]);

  const [formData, setFormData] = useState({
    brand_name: '',
    campaign_objective: '',
    target_audience: '',
    deliverables: ''
  });

  const location = useLocation();

  const getActiveViewFromPath = () => {
    const path = location.pathname;
    if (path.endsWith('/overview')) return 'overview';
    if (path.endsWith('/mywork')) return 'mywork';
    if (path.endsWith('/calendar')) return 'calendar';
    if (path.endsWith('/create-script')) return 'create-script';
    if (path.endsWith('/create-brand')) return 'create-brand';
    if (path.endsWith('/video-approval')) return 'video-approval';
    if (path.endsWith('/ceo-approved-scripts')) return 'ceo-approved-scripts';
    if (path.includes('/influencer-management/')) return 'influencer-management';
    return 'dashboard';
  };

  const activeView = getActiveViewFromPath();

  useEffect(() => {
    if (activeView === 'create-script') {
        setIsCreatingScript(true);
    } else {
        setIsCreatingScript(false);
    }
  }, [activeView]);

  const handleViewChange = (view: string) => {
    const rolePath = 'partner_associate';
    if (view === 'dashboard') {
      navigate(`/${rolePath}`);
      setDashboardMode('landing');
    } else {
      navigate(`/${rolePath}/${view}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await db.brands.create({
        ...formData,
        created_by_user_id: user.id
      });
      setSuccessMessage('Brand successfully created.');
      setFormData({
        brand_name: '',
        campaign_objective: '',
        target_audience: '',
        deliverables: ''
      });
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error creating brand:', error);
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        setErrorMessage('A brand with this name already exists.');
      } else {
        setErrorMessage(error.message || 'Failed to create brand. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScriptSuccess = () => {
    setIsCreatingScript(false);
    navigate('/partner_associate');
    toast.success('Script created successfully');
  };

  // If creating script, show the writer's full-page CreateScript component
  if (isCreatingScript) {
    return (
      <CreateScript 
        onClose={() => navigate('/partner_associate')} 
        onSuccess={handleScriptSuccess}
        creatorRole={Role.PARTNER_ASSOCIATE}
      />
    );
  }

  const renderProjectCard = (p: Project, readOnly = false) => {
    return (
      <div 
        key={p.id} 
        className={`relative bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col group ${
            readOnly ? 'opacity-80' : 'cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
        }`}
        onClick={() => !readOnly && setSelectedProject(p)}
      >
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${
            p.channel === Channel.YOUTUBE ? 'bg-[#FF4F4F] text-white' :
            p.channel === Channel.LINKEDIN ? 'bg-[#0085FF] text-white' :
            p.channel === Channel.INSTAGRAM ? 'bg-[#D946EF] text-white' :
            'bg-black text-white'
          }`}>
            {p.channel}
          </span>
          <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${
            p.priority === 'HIGH' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-900'
          }`}>
            {p.priority}
          </span>
          <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-yellow-400 text-black">
              {p.current_stage?.replace(/_/g, ' ')}
          </span>
        </div>

        <h4 className="font-black text-lg text-slate-900 mb-2 uppercase leading-tight group-hover:text-[#0085FF] transition-colors">{p.title}</h4>
        
        <div className="flex flex-col gap-1 mb-4">
            <div className="text-[10px] font-black text-[#0085FF] uppercase">
                {p.brand?.replace(/_/g, ' ') || 'UNBRANDED'}
            </div>
            <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center">
                <UserIcon className="w-3 h-3 mr-1" /> {p.writer_name || p.created_by_name || 'System'}
            </div>
        </div>

        <div className="mt-auto pt-4 border-t-2 border-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase">
              <Clock className="w-3 h-3 mr-1" />
              {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="text-[9px] font-medium text-slate-300 uppercase mt-0.5">
                Submitted {format(new Date(p.created_at), 'h:mm a')}
            </div>
          </div>
          {!readOnly && (
              <span className="text-[10px] font-black uppercase text-slate-900 flex items-center">
                  Review <Plus className="w-3 h-3 ml-1" />
              </span>
          )}
        </div>
      </div>
    );
  };

  const renderDashboardContent = () => {
    // Filter projects to only show those belonging to brands created by this PA
    const myBrandsNames = brands
        .filter(b => b.created_by_user_id === user.id)
        .map(b => b.brand_name.toLowerCase());

    const paStages = [WorkflowStage.PARTNER_REVIEW, WorkflowStage.SENT_TO_INFLUENCER, WorkflowStage.PA_FINAL_REVIEW];
    
    // Show projects that are either assigned to PA stages OR belong to my brands
    const myProjects = allProjects.filter(p => 
        (p.current_stage && paStages.includes(p.current_stage as WorkflowStage)) || 
        (p.brand && myBrandsNames.includes(p.brand.toLowerCase()))
    );

    // Column 1: Initial Review (Partnership Review Stage + Internal Review Stages)
    const initialReviewProjects = myProjects.filter(p => 
        [WorkflowStage.PARTNER_REVIEW, WorkflowStage.SCRIPT, WorkflowStage.SCRIPT_REVIEW_L1, WorkflowStage.SCRIPT_REVIEW_L2].includes(p.current_stage as WorkflowStage)
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Column 2: Sent to Influencer
    const sentToInfluencerProjects = myProjects.filter(p => 
        p.current_stage === WorkflowStage.SENT_TO_INFLUENCER
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Column 3: Final PA Review
    const finalReviewProjects = myProjects.filter(p => 
        p.current_stage === WorkflowStage.PA_FINAL_REVIEW
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Column 4: Editor (Projects with Editor - VIDEO_EDITING stage)
    const editorProjects = myProjects.filter(p => 
        p.current_stage === WorkflowStage.VIDEO_EDITING
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2">
              Partner Console
            </h1>
            <p className="font-bold text-base sm:text-lg text-slate-500">
              Welcome back, {user.full_name}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/partner_associate/create-brand')}
              className="px-6 py-4 bg-yellow-400 text-black border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center space-x-2 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Add Brand</span>
            </button>
            <button
              onClick={() => navigate('/partner_associate/create-script')}
              className="px-6 py-4 bg-[#D946EF] text-white border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center space-x-2 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>New Script</span>
            </button>
            <button
              onClick={() => handleViewChange('video-approval')}
              className="px-6 py-4 bg-[#F59E0B] text-white border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center space-x-2 transition-all relative"
            >
              <PlayCircle className="w-6 h-6 border-2 border-white rounded-full" />
              <span>Video Approved</span>
              {allProjects.filter(p => p.current_stage === WorkflowStage.POSTED).length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
                  {allProjects.filter(p => p.current_stage === WorkflowStage.POSTED).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 4-Column Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Column 1: Initial Review */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#FF8C00] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase tracking-wide text-xs">Initial Review</h3>
                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{initialReviewProjects.length}</span>
              </div>
              <div className="space-y-4">
                {initialReviewProjects.map(p => renderProjectCard(p))}
                {initialReviewProjects.length === 0 && <p className="text-center text-slate-400 font-bold uppercase text-xs pt-10">Clear Queue</p>}
              </div>
            </div>

            {/* Column 2: Sent to Influencer */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#D946EF] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase tracking-wide text-xs">Sent to Influencer</h3>
                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{sentToInfluencerProjects.length}</span>
              </div>
              <div className="space-y-4">
                {sentToInfluencerProjects.map(p => renderProjectCard(p))}
                {sentToInfluencerProjects.length === 0 && <p className="text-center text-slate-400 font-bold uppercase text-xs pt-10">All Sent</p>}
              </div>
            </div>

            {/* Column 3: Editor */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-900 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase tracking-wide text-xs">Editor</h3>
                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{editorProjects.length}</span>
              </div>
              <div className="space-y-4">
                {editorProjects.map(p => renderProjectCard(p))}
                {editorProjects.length === 0 && <p className="text-center text-slate-400 font-bold uppercase text-xs pt-10">Waiting for Edits</p>}
              </div>
            </div>

            {/* Column 4: Final PA Review */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#0085FF] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase tracking-wide text-xs">Final Review</h3>
                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{finalReviewProjects.length}</span>
              </div>
              <div className="space-y-4">
                {finalReviewProjects.map(p => renderProjectCard(p))}
                {finalReviewProjects.length === 0 && <p className="text-center text-slate-400 font-bold uppercase text-xs pt-10">No Arrivals</p>}
              </div>
            </div>

          </div>
      </div>
    );
  };

  const renderCreateBrandContent = () => {
    return (
      <div className="animate-fade-in w-full pb-12">
        <div className="max-w-7xl mx-auto px-4">
          <button
            onClick={() => navigate('/partner_associate')}
            className="flex items-center gap-2 mb-8 text-slate-600 hover:text-black font-black uppercase text-sm group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Back to dashboard
          </button>
          
          <div className="mb-8 pl-1">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter mb-2">Configure Brand</h2>
            <p className="text-slate-600 font-bold text-base sm:text-lg">Register a new client brand to the system so creators can reference them in scripts.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* LEFT COLUMN: The Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleBrandSubmit} className="bg-white p-6 sm:p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all space-y-6">
                
                {successMessage && (
                  <div className="bg-green-50 text-green-700 p-4 border-2 border-green-400 font-bold shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    {successMessage}
                  </div>
                )}

                {errorMessage && (
                  <div className="bg-red-50 text-red-700 p-4 border-2 border-red-400 font-bold shadow-[4px_4px_0px_0px_rgba(239,68,68,1)] flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                    <div>{errorMessage}</div>
                  </div>
                )}

                <div>
                  <label htmlFor="brand_name" className="block text-sm font-black text-slate-900 uppercase mb-2">
                    Brand Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="brand_name"
                    name="brand_name"
                    value={formData.brand_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-white border-2 border-black text-slate-900 font-bold focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                    placeholder="e.g., TechGrow Solutions"
                  />
                </div>

                <div>
                  <label htmlFor="campaign_objective" className="block text-sm font-black text-slate-900 uppercase mb-2">
                    Campaign Objective
                  </label>
                  <textarea
                    id="campaign_objective"
                    name="campaign_objective"
                    value={formData.campaign_objective}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border-2 border-black text-slate-900 font-bold focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all min-h-[120px] resize-y"
                    placeholder="What is the main goal of this brand's campaign?"
                  />
                </div>

                <div>
                  <label htmlFor="target_audience" className="block text-sm font-black text-slate-900 uppercase mb-2">
                    Target Audience
                  </label>
                  <textarea
                    id="target_audience"
                    name="target_audience"
                    value={formData.target_audience}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border-2 border-black text-slate-900 font-bold focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all min-h-[120px] resize-y"
                    placeholder="Who are we trying to reach?"
                  />
                </div>

                <div>
                  <label htmlFor="deliverables" className="block text-sm font-black text-slate-900 uppercase mb-2">
                    Deliverables
                  </label>
                  <textarea
                    id="deliverables"
                    name="deliverables"
                    value={formData.deliverables}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border-2 border-black text-slate-900 font-bold focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all min-h-[120px] resize-y"
                    placeholder="What specific content pieces are required?"
                  />
                </div>

                <div className="pt-6 mt-8 border-t-2 border-slate-200 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-8 py-4 bg-[#D946EF] text-white border-2 border-black font-black uppercase text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-pink-400 hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-4 border-black border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Brand'
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* RIGHT COLUMN: Available Brands (Names Only) */}
            <div className="lg:col-span-1 bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] lg:sticky lg:top-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-4 flex items-center gap-2 border-b-2 border-slate-100 pb-4">
                <Building2 className="w-6 h-6 text-yellow-500" />
                Available ({brands.length})
              </h3>
              
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {brands.map((brand: any) => (
                  <div key={brand.id} className={`border-2 border-black p-3 hover:-translate-y-1 transition-transform cursor-default ${brand.isSystem ? 'bg-slate-50' : 'bg-white'}`}>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-sm font-black text-slate-900 uppercase leading-tight line-clamp-2">{brand.brand_name}</h4>
                        <span className={`shrink-0 px-2 py-0.5 border text-[9px] font-black uppercase ${brand.isSystem ? 'bg-blue-100 text-blue-800 border-blue-400' : 'bg-green-100 text-green-700 border-green-400'}`}>
                          {brand.isSystem ? 'System' : 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {brands.length === 0 && (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 bg-slate-50">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No brands</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Layout
        user={user as any}
        onLogout={onLogout}
        onOpenCreate={() => navigate('/partner_associate/create-script')}
        activeView={activeView}
        onChangeView={handleViewChange}
        hideSidebar={!!selectedProject}
        finalReviewCount={allProjects.filter(p => [WorkflowStage.PA_FINAL_REVIEW].includes(p.current_stage as WorkflowStage)).length}
      >
        {selectedProject && isFromCeoApproved ? (
          <PAInfluencerManagement
            project={selectedProject}
            user={user}
            onBack={() => navigate(-1)}
            onComplete={async () => {
              // Reload project data to show updated history
              await refreshData(user!);
              const updatedProject = allProjects.find(p => p.id === selectedProject.id);
              if (updatedProject) {
                setSelectedProjectState(updatedProject);
              }
            }}
          />
        ) : selectedProject ? (
          <PAReviewScreen
            project={selectedProject}
            user={user}
            onBack={() => navigate(-1)}
            onComplete={() => {
              navigate(-1);
              // Force a full refresh of the application data to update the review queue
              window.location.reload(); 
            }}
          />
        ) : activeView === 'mywork' ? (
          <PAMyWork user={user} projects={allProjects} onReview={setSelectedProject} />
        ) : activeView === 'overview' ? (
          <PAOverview user={user} allProjects={allProjects} onSelectProject={setSelectedProject} />
        ) : activeView === 'calendar' ? (
          <PACalendar projects={allProjects || []} />
        ) : activeView === 'video-approval' ? (
          <PAVideoApproved 
            projects={allProjects.filter(p => [WorkflowStage.POSTED].includes(p.current_stage as WorkflowStage))} 
            onBack={() => handleViewChange('dashboard')} 
            onSelectProject={setSelectedProject} 
          />
        ) : activeView === 'ceo-approved-scripts' ? (
          <PACeoApprovedScripts 
            projects={allProjects} 
            onBack={() => handleViewChange('dashboard')} 
            onSelectProject={setSelectedProject} 
          />
        ) : activeView === 'create-brand' ? (
          renderCreateBrandContent()
        ) : (
          <div className="space-y-8 animate-fade-in">
             {renderDashboardContent()}
          </div>
        )}
      </Layout>
    </>
  );
};

export default PADashboard;
