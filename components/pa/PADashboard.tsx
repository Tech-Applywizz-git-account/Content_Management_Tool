import React, { useState, useEffect } from 'react';
import { User, Project, Role, WorkflowStage, Channel } from '../../types';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { Plus, CheckCircle2, AlertCircle, Building2, FilePlus, ArrowLeft, Clock, User as UserIcon, PlayCircle, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
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
import PABrands from './PABrands';
import PACreateBrand from './PACreateBrand';
import PAAddInfluencer from './PAAddInfluencer';

interface PADashboardProps {
  user: User;
  onLogout: () => void;
  allProjects: Project[];
  refreshData: (user: User) => Promise<void>;
}

const PADashboard: React.FC<PADashboardProps> = ({ user, onLogout, allProjects, refreshData }) => {
  const { projectId: routeProjectId } = useParams();
  const navigate = useNavigate();
  const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isFromCeoApproved = searchParams.get('source') === 'ceo-approved';
  const activeView = location.pathname.split('/').pop() || 'dashboard';

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete handler
  const handleDeleteClick = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setProjectToDelete(p);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    
    setIsDeleting(true);
    try {
      // Delete from projects table
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id);
      
      if (error) throw error;
      
      // Also delete from influencers table if exists
      await supabase
        .from('influencers')
        .delete()
        .eq('instance_project_id', projectToDelete.id);
      
      toast.success('Project deleted successfully');
      setShowDeleteModal(false);
      setProjectToDelete(null);
      await refreshData(user);
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error(error.message || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

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
  };

  useEffect(() => {
    if (routeProjectId && allProjects.length > 0) {
      const p = allProjects.find(item => item.id === routeProjectId);
      if (p && (!selectedProject || selectedProject.id !== p.id)) {
        setSelectedProjectState(p);
        console.log('Project loaded from URL:', p.id, 'isFromCeoApproved:', isFromCeoApproved);
      }
    } else if (!routeProjectId && selectedProject) {
        setSelectedProjectState(null);
    }
  }, [routeProjectId, allProjects, selectedProject]);

  const handleViewChange = (view: string) => {
    const rolePath = 'partner_associate';
    if (view === 'dashboard') {
      navigate(`/${rolePath}`);
    } else {
      navigate(`/${rolePath}/${view}`);
    }
  };

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
          <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.ceo_approved_at ? 'bg-[#0085FF] text-white' : 'bg-yellow-400 text-black'}`}>
              {p.current_stage?.replace(/_/g, ' ')}
          </span>
        </div>

        <h4 className="font-black text-lg text-slate-900 mb-2 uppercase leading-tight group-hover:text-[#0085FF] transition-colors line-clamp-2">
            {p.data?.influencer_name && p.title.includes(p.data.influencer_name) 
              ? p.title.replace(p.data.influencer_name, '').replace(/^ - | - $/g, '').trim() || p.title
              : p.title
            }
        </h4>
        
        <div className="flex flex-col gap-1 mb-4">
            {p.data?.influencer_name && (
                <div className="text-[10px] font-black text-slate-900 uppercase flex items-center gap-1">
                    <UserIcon className="w-3 h-3" /> {p.data.influencer_name}
                </div>
            )}
            <div className="text-xs font-black text-[#0085FF] uppercase">
                {p.brand?.replace(/_/g, ' ') || 'UNBRANDED'}
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase">
                BY {p.writer_name || p.created_by_name || 'System'}
            </div>
        </div>

        <div className="mt-auto pt-4 border-t-2 border-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase">
              <Clock className="w-3 h-3 mr-1" />
              {p.ceo_approved_at 
                ? format(new Date(p.ceo_approved_at), 'MMM dd, yyyy') 
                : format(new Date(p.created_at), 'MMM dd, yyyy')}
            </div>
            <div className="text-[9px] font-medium text-slate-300 uppercase mt-0.5">
                {p.ceo_approved_at 
                  ? `Approved ${format(new Date(p.ceo_approved_at), 'h:mm a')}`
                  : `Submitted ${format(new Date(p.created_at), 'h:mm a')}`}
            </div>
          </div>
          {!readOnly && (
              <span className="text-[10px] font-black uppercase text-slate-900 flex items-center">
                  Review <Plus className="w-3 h-3 ml-1" />
              </span>
          )}
        </div>

        {/* Delete Button */}
        {!readOnly && (
          <button
            onClick={(e) => handleDeleteClick(e, p)}
            className="absolute top-2 right-2 p-1.5 bg-slate-100 hover:bg-red-500 text-slate-400 hover:text-white rounded border border-slate-200 hover:border-red-500 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete Project"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  const renderEditorCard = (p: Project) => {
    const paUploaderName = p.data?.uploaded_by_pa_name || p.created_by_name || user.full_name;
    const influencerName = p.data?.influencer_name || '—';
    return (
      <div
        key={p.id}
        className="relative bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col group cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
        onClick={() => setSelectedProject(p)}
      >
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${
            p.channel === Channel.YOUTUBE ? 'bg-[#FF4F4F] text-white' :
            p.channel === Channel.LINKEDIN ? 'bg-[#0085FF] text-white' :
            p.channel === Channel.INSTAGRAM ? 'bg-[#D946EF] text-white' :
            'bg-black text-white'
          }`}>
            {p.channel}
          </span>
          <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-slate-900 text-white">
            EDITING
          </span>
        </div>

        <h4 className="font-black text-base text-slate-900 mb-3 uppercase leading-tight group-hover:text-[#0085FF] transition-colors line-clamp-2">
          {p.title}
        </h4>

        <div className="flex flex-col gap-1.5 mb-3 p-3 bg-slate-50 border border-slate-200">
          <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Editor Stage Context</div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-[#D946EF] rounded-full" />
            <span className="text-[10px] font-black text-slate-700 uppercase">PA: {paUploaderName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-[#0085FF] rounded-full" />
            <span className="text-[10px] font-black text-slate-700 uppercase">Influencer: {influencerName}</span>
          </div>
          {p.video_link && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-green-700 uppercase">Raw video uploaded</span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-3 border-t-2 border-slate-50 flex items-center justify-between">
          <div className="text-[9px] font-bold text-slate-400 uppercase">
            {p.brand?.replace(/_/g, ' ') || 'UNBRANDED'}
          </div>
          <span className="text-[10px] font-black uppercase text-slate-900 flex items-center">
            Review <Plus className="w-3 h-3 ml-1" />
          </span>
        </div>
      </div>
    );
  };

  // Helper to check is_pa_brand in both data and metadata
  const isPaBrand = (p: any) => {
    const data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
    const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
    return data?.is_pa_brand === true || metadata?.is_pa_brand === true;
  };

  const isInfluencerInstance = (p: any) => {
    const data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
    const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
    return data?.influencer_instance === true || metadata?.influencer_instance === true;
  };

  const getSentById = (p: any) => {
    const data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
    const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
    return data?.sent_by_id || metadata?.sent_by_id;
  };

  const getParentScriptId = (p: any) => {
    const data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
    const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
    return data?.parent_script_id || metadata?.parent_script_id;
  };

  const renderDashboardContent = () => {

    const myClaimedParentIds = new Set(
        allProjects
            .filter(p =>
                isInfluencerInstance(p) &&
                (p.assigned_to_user_id === user.id || getSentById(p) === user.id) &&
                getParentScriptId(p)
            )
            .map(p => getParentScriptId(p) as string)
    );

    const initialReviewProjects = allProjects.filter(p =>
        p.current_stage === WorkflowStage.PARTNER_REVIEW &&
        p.ceo_approved_at &&
        isPaBrand(p) &&
        !isInfluencerInstance(p) &&
        !myClaimedParentIds.has(p.id)
    ).sort((a, b) => new Date(b.ceo_approved_at!).getTime() - new Date(a.ceo_approved_at!).getTime());

    const myInstances = allProjects.filter(p =>
        isInfluencerInstance(p) &&
        (p.assigned_to_user_id === user.id || getSentById(p) === user.id)
    );

    const sentToInfluencerProjects = myInstances.filter(p =>
        p.current_stage === WorkflowStage.SENT_TO_INFLUENCER
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const cmoReviewProjects = myInstances.filter(p =>
        p.current_stage === WorkflowStage.PA_VIDEO_CMO_REVIEW
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const editorProjects = myInstances.filter(p =>
        p.current_stage === WorkflowStage.VIDEO_EDITING
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const finalReviewProjects = myInstances.filter(p =>
        p.current_stage === WorkflowStage.PA_FINAL_REVIEW
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2">
              Partner Console
            </h1>
            <p className="text-slate-600 font-bold">
              Welcome back, {user.full_name}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
              {allProjects.filter(p => p.current_stage === WorkflowStage.POSTED && isPaBrand(p) && isInfluencerInstance(p) && (p.assigned_to_user_id === user.id || getSentById(p) === user.id)).length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-sm">
                  {allProjects.filter(p => p.current_stage === WorkflowStage.POSTED && isPaBrand(p) && isInfluencerInstance(p) && (p.assigned_to_user_id === user.id || getSentById(p) === user.id)).length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#FF8C00] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase tracking-wide text-xs">Initial Review</h3>
                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{initialReviewProjects.length}</span>
              </div>
              <div className="space-y-4">
                {initialReviewProjects.map(p => renderProjectCard(p))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#D946EF] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase tracking-wide text-xs">Sent to Influencer</h3>
                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{sentToInfluencerProjects.length}</span>
              </div>
              <div className="space-y-4">
                {sentToInfluencerProjects.map(p => renderProjectCard(p))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#22C55E] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase tracking-wide text-xs">CMO Review</h3>
                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{cmoReviewProjects.length}</span>
              </div>
              <div className="space-y-4">
                {cmoReviewProjects.map(p => renderProjectCard(p))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-900 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase tracking-wide text-xs">Editor Stage</h3>
                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{editorProjects.length}</span>
              </div>
              <div className="space-y-4">
                {editorProjects.map(p => renderEditorCard(p))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#0085FF] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black uppercase tracking-wide text-xs">Final Review</h3>
                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{finalReviewProjects.length}</span>
              </div>
              <div className="space-y-4">
                {finalReviewProjects.map(p => renderProjectCard(p))}
              </div>
            </div>
          </div>
      </div>
    );
  };

  const renderMainContent = () => {
    const myInstances = allProjects.filter(p =>
        isInfluencerInstance(p) &&
        (p.assigned_to_user_id === user?.id || getSentById(p) === user?.id)
    );
    const myProjects = allProjects.filter(p => p.assigned_to_user_id === user?.id);

    if (activeView === 'influencer-management' && selectedProject) {
        return (
          <PAInfluencerManagement
            project={selectedProject}
            allInfluencerProjects={allProjects.filter(p => {
                const parentId = selectedProject.data?.parent_script_id || selectedProject.id;
                return p.data?.parent_script_id === parentId || p.id === parentId;
            })}
            user={user as any}
            onBack={() => navigate('/partner_associate')}
            onComplete={async () => {
              await refreshData(user!);
              const updatedProject = allProjects.find(p => p.id === selectedProject.id);
              if (updatedProject) {
                setSelectedProjectState(updatedProject);
              }
            }}
          />
        );
    }

    if (selectedProject) {
        return (
          <PAReviewScreen
            project={selectedProject}
            user={user}
            allProjects={allProjects}
            fromCeoApproved={isFromCeoApproved}
            onBack={() => navigate('/partner_associate')}
            onComplete={async () => {
              await refreshData(user!);
              navigate('/partner_associate');
            }}
          />
        );
    }

    if (activeView === 'mywork') {
        return <PAMyWork user={user} projects={myInstances} onReview={setSelectedProject} />;
    }

    if (activeView === 'overview') {
        return <PAOverview user={user} allProjects={myProjects} onSelectProject={setSelectedProject} />;
    }

    if (activeView === 'calendar') {
        return <PACalendar projects={allProjects} />;
    }

    if (activeView === 'video-approval') {
        const approvedInstances = allProjects.filter(p =>
            p.current_stage === WorkflowStage.POSTED &&
            p.data?.influencer_instance === true &&
            (p.assigned_to_user_id === user.id || p.data?.sent_by_id === user.id)
        );
        return (
          <PAVideoApproved
            projects={approvedInstances}
            onBack={() => handleViewChange('dashboard')}
            onSelectProject={setSelectedProject}
          />
        );
    }

    if (activeView === 'ceo-approved-scripts') {
        return (
          <PACeoApprovedScripts 
            projects={allProjects} 
            onBack={() => handleViewChange('dashboard')} 
            onSelectProject={setSelectedProject} 
          />
        );
    }

    if (activeView === 'brands') {
        return <PABrands user={user} />;
    }

    if (activeView === 'create-brand') {
        return <PACreateBrand user={user} />;
    }

    if (activeView === 'add-influencer') {
        return <PAAddInfluencer user={user} />;
    }

    if (activeView === 'create-script') {
        return (
          <CreateScript 
            onClose={() => navigate('/partner_associate')} 
            onSuccess={async () => {
                await refreshData(user!);
                navigate('/partner_associate');
                toast.success('Script created successfully');
            }}
            creatorRole={Role.PARTNER_ASSOCIATE}
          />
        );
    }

    return (
      <div className="space-y-8 animate-fade-in">
         {renderDashboardContent()}
      </div>
    );
  };

  return (
    <>
      <Layout 
        user={user} 
        onLogout={onLogout}
        onOpenCreate={() => navigate('/partner_associate/create-script')}
        activeView={activeView === 'dashboard' || activeView === 'influencer-management' ? 'dashboard' : activeView}
        onChangeView={(view) => {
            if (view === 'dashboard') {
                navigate('/partner_associate');
            } else {
                handleViewChange(view as any);
            }
        }}
        hideSidebar={!!selectedProject}
      >
      <div className="w-full p-0 mt-2">
        {renderMainContent()}
      </div>
      </Layout>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && projectToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white border-4 border-red-500 shadow-[12px_12px_0px_0px_rgba(239,68,68,1)] max-w-md w-full p-10 animate-scale-in">
            <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
            <h3 className="text-3xl font-black text-slate-900 uppercase mb-4">Confirm Delete</h3>
            <p className="text-sm font-bold text-slate-500 uppercase mb-8 leading-relaxed">
              Are you sure you want to delete <span className="text-red-600">{projectToDelete.title}</span>?<br/>
              This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-4 border-2 border-black font-black uppercase text-xs hover:bg-slate-100 transition-all"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-4 bg-red-500 text-white border-2 border-black font-black uppercase text-xs hover:bg-red-600 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PADashboard;
