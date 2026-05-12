
import React, { useState } from 'react';
import { Project, Role, TaskStatus, WorkflowStage, STAGE_LABELS, Channel } from '../../types';
import { Clock, FileText, CheckCircle, Edit3, ArrowLeft, Video, PlayCircle, ExternalLink, Link, Layout, Tag } from 'lucide-react';
import { format } from 'date-fns';
import CreateScript from '../writer/CreateScript';
import { supabase } from '../../src/integrations/supabase/client';
import { getWorkflowStateForRole, isInfluencerVideo } from '../../services/workflowUtils';
import ScriptDisplay from '../ScriptDisplay';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface PAScriptMyWorkProps {
    user: any;
    projects: Project[];
    onBack?: () => void;
}

const PAScriptMyWork: React.FC<PAScriptMyWorkProps> = ({ user, projects, onBack }) => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [reviewComments, setReviewComments] = useState<any[]>([]);
    const [editingProject, setEditingProject] = useState<Project | null>(null);

    const scriptFilter = searchParams.get('filter') || 'ALL';
    const setScriptFilter = (filter: string) => {
        setSearchParams(prev => {
            prev.set('filter', filter);
            return prev;
        }, { replace: true });
    };

    // Filter projects where PA is creator or writer and NOT an influencer instance
    const isInfluencerInstance = (p: any) => {
        const data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
        const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
        return (
            data?.influencer_instance === true || 
            metadata?.influencer_instance === true ||
            !!data?.influencer_name ||
            !!metadata?.influencer_name ||
            !!data?.parent_script_id ||
            !!metadata?.parent_script_id
        );
    };

    const myScripts = projects.filter(p => !isInfluencerInstance(p));

    const filteredProjects = myScripts.filter(project => {
        if (scriptFilter === 'ALL') return true;
        if (scriptFilter === 'COMPLETED') return project.status === TaskStatus.DONE;
        if (project.status === TaskStatus.DONE) return false;

        switch (scriptFilter) {
            case 'SCRIPT_L1': return project.current_stage === WorkflowStage.SCRIPT_REVIEW_L1;
            case 'SCRIPT_L2': return project.current_stage === WorkflowStage.SCRIPT_REVIEW_L2;
            case 'CINE': return project.current_stage === WorkflowStage.CINEMATOGRAPHY;
            case 'PARTNER_REVIEW': return project.current_stage === WorkflowStage.PARTNER_REVIEW;
            case 'SENT_TO_INF': return project.current_stage === WorkflowStage.SENT_TO_INFLUENCER;
            case 'CMO_VIDEO': return project.current_stage === WorkflowStage.PA_VIDEO_CMO_REVIEW;
            case 'EDITING': return project.current_stage === WorkflowStage.VIDEO_EDITING;
            case 'FINAL_CMO': return project.current_stage === WorkflowStage.FINAL_REVIEW_CMO;
            case 'FINAL_CEO': return project.current_stage === WorkflowStage.FINAL_REVIEW_CEO;
            case 'PA_FINAL': return project.current_stage === WorkflowStage.PA_FINAL_REVIEW;
            case 'PROOF': return !!((project.data as any)?.posting_proof_link || (project.metadata as any)?.posting_proof_link);
            case 'POSTED': return project.current_stage === WorkflowStage.POSTED;
            default: return true;
        }
    });

    if (editingProject) {
        return (
            <CreateScript
                project={editingProject}
                onClose={() => setEditingProject(null)}
                onSuccess={() => setEditingProject(null)}
                creatorRole={Role.PARTNER_ASSOCIATE}
            />
        );
    }

    if (selectedProject) {
        const pData = typeof selectedProject.data === 'string' ? JSON.parse(selectedProject.data) : selectedProject.data;
        const pMetadata = typeof selectedProject.metadata === 'string' ? JSON.parse(selectedProject.metadata) : selectedProject.metadata;

        return (
            <div className="space-y-6 animate-fade-in pb-20">
                {/* Back button */}
                <button
                    onClick={() => setSelectedProject(null)}
                    className="flex items-center text-sm font-black text-slate-700 hover:text-slate-900 py-2 px-4 bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                    ← Back to My Work
                </button>

                <div className="space-y-6">
                    {/* Basic Info Section */}
                    <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h2 className="text-2xl font-black uppercase mb-4">Project Details</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Title</h3>
                                <p className="font-medium bg-slate-50 p-2">{selectedProject.title}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Channel</h3>
                                <p className="font-medium bg-slate-50 p-2">{selectedProject.channel}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Writer</h3>
                                <p className="font-medium bg-slate-50 p-2">
                                    {pData?.writer_name || pMetadata?.writer_name || selectedProject.writer_name || '—'}
                                </p>
                            </div>
                            {(selectedProject.assigned_to_role === Role.EDITOR || selectedProject.assigned_to_role === Role.SUB_EDITOR) && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Editor</h3>
                                    <p className="font-medium bg-slate-50 p-2">
                                        {selectedProject.editor_name || selectedProject.sub_editor_name || pData?.editor_name || pData?.sub_editor_name || '—'}
                                    </p>
                                </div>
                            )}
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h3>
                                <p className="font-medium bg-slate-50 p-2">{selectedProject.status}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h3>
                                <p className="font-medium bg-slate-50 p-2">{selectedProject.current_stage ? selectedProject.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Priority</h3>
                                <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${selectedProject.priority === 'HIGH'
                                    ? 'bg-red-500 text-white'
                                    : selectedProject.priority === 'NORMAL'
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-green-500 text-white'
                                    }`}>
                                    {selectedProject.priority}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Assigned To</h3>
                                <p className="font-medium bg-slate-50 p-2">{selectedProject.assigned_to_role || 'Unassigned'}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Created At</h3>
                                <p className="font-medium bg-slate-50 p-2">{new Date(selectedProject.created_at).toLocaleString()}</p>
                            </div>
                            {selectedProject.brand && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Brand</h3>
                                    <p className="font-black text-[#0085FF] uppercase bg-slate-50 p-2">{selectedProject.brand.replace(/_/g, ' ')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Influencer Details - If exists */}
                    {(pData?.influencer_name || pMetadata?.influencer_name) && (
                        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h2 className="text-xl font-black uppercase mb-4">Influencer Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Influencer Name</h3>
                                    <p className="font-black text-purple-600 uppercase bg-slate-50 p-2">
                                        {pData?.influencer_name || pMetadata?.influencer_name}
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
                    {(pData?.script_content || pData?.idea_description) && (
                        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="text-lg font-black uppercase mb-4">
                                {pData?.source === 'IDEA_PROJECT' ? 'Idea Description' : 'Script Content'}
                            </h3>
                            <div className="max-h-60 overflow-y-auto border-2 border-gray-200 p-4 bg-gray-50">
                                <div
                                    className="whitespace-pre-wrap font-sans text-sm"
                                    dangerouslySetInnerHTML={{
                                        __html: (() => {
                                            let content = pData?.script_content || pData?.idea_description || 'No content available';
                                            if (content !== 'No content available') {
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
                            </div>
                        </div>
                    )}

                    {/* Production Assets Section */}
                    {(selectedProject.video_link || (selectedProject as any).video_url || selectedProject.edited_video_link || selectedProject.thumbnail_link || selectedProject.creative_link || pData?.posting_proof_link) && (
                        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="text-lg font-black uppercase mb-4">Production Assets</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {(selectedProject.video_link || (selectedProject as any).video_url) && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Raw Video</h4>
                                        <a 
                                            href={selectedProject.video_link || (selectedProject as any).video_url} 
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
                                {selectedProject.edited_video_link && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Edited Video</h4>
                                        <a 
                                            href={selectedProject.edited_video_link} 
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
                                {selectedProject.thumbnail_link && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Thumbnail</h4>
                                        <a 
                                            href={selectedProject.thumbnail_link} 
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
                                {selectedProject.creative_link && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Creative Asset</h4>
                                        <a 
                                            href={selectedProject.creative_link} 
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
                                {pData?.posting_proof_link && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Proof of Posting</h4>
                                        <a 
                                            href={pData.posting_proof_link} 
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

                    {/* Project Comments & Feedback Section */}
                    <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-xl font-black uppercase mb-6 border-b-2 border-black pb-3 text-slate-900">
                            Project Comments & Feedback
                        </h3>

                        {reviewComments.length > 0 ? (
                            <div className="space-y-6">
                                {reviewComments.map((comment, index) => (
                                    <div key={index} className={`border-l-4 pl-4 py-2 ${comment.action === 'APPROVED' ? 'border-green-500' : comment.action === 'REWORK' ? 'border-yellow-500' : 'border-red-500'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-slate-900">{comment.actor_name}</p>
                                                <p className="text-sm text-slate-600">{format(new Date(comment.timestamp), 'MMM dd, yyyy h:mm a')}</p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-bold uppercase ${comment.action === 'APPROVED' ? 'bg-green-100 text-green-800' : comment.action === 'REWORK' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                {comment.action}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-slate-700">{comment.comment}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-500 italic font-medium">No comments or feedback recorded yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2">
                        Script My Work
                    </h1>
                    <p className="font-bold text-base sm:text-lg text-slate-500 italic">
                        Managing your original script submissions
                    </p>
                </div>
                {onBack && (
                    <button 
                        onClick={onBack}
                        className="px-6 py-2 bg-slate-100 border-2 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        Back to Scripts
                    </button>
                )}
            </div>

            {/* Role Filters */}
            <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {[
                    { id: 'ALL', label: 'All Projects', color: 'bg-slate-900', textColor: 'text-white' },
                    { id: 'SCRIPT_L1', label: 'script_review_l1(cmo)', color: 'bg-yellow-400', textColor: 'text-black' },
                    { id: 'SCRIPT_L2', label: 'script_review_l2(ceo)', color: 'bg-violet-700', textColor: 'text-white' },
                    { id: 'CINE', label: 'cine', color: 'bg-emerald-600', textColor: 'text-white' },
                    { id: 'PARTNER_REVIEW', label: 'partner review', color: 'bg-indigo-600', textColor: 'text-white' },
                    { id: 'SENT_TO_INF', label: 'sent to influencer', color: 'bg-pink-600', textColor: 'text-white' },
                    { id: 'CMO_VIDEO', label: 'cmo_video_review', color: 'bg-blue-600', textColor: 'text-white' },
                    { id: 'EDITING', label: 'editing', color: 'bg-slate-600', textColor: 'text-white' },
                    { id: 'FINAL_CMO', label: 'final review(cmo)', color: 'bg-orange-600', textColor: 'text-white' },
                    { id: 'FINAL_CEO', label: 'final review(ceo)', color: 'bg-red-600', textColor: 'text-white' },
                    { id: 'PA_FINAL', label: 'pa final review', color: 'bg-cyan-600', textColor: 'text-white' },
                    { id: 'PROOF', label: 'proof of posting', color: 'bg-teal-600', textColor: 'text-white' },
                    { id: 'POSTED', label: 'posted', color: 'bg-purple-600', textColor: 'text-white' },
                    { id: 'COMPLETED', label: 'completed', color: 'bg-green-500', textColor: 'text-white' },
                ].map((filter) => (
                    <button
                        key={filter.id}
                        onClick={() => setScriptFilter(filter.id)}
                        className={`px-4 py-2 text-[10px] font-black uppercase border-2 border-black transition-all ${scriptFilter === filter.id
                            ? `${filter.color} ${filter.textColor} shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        {filter.label}
                        {filter.id === 'ALL' ? '' : ` (${filter.id === 'COMPLETED'
                            ? myScripts.filter(p => p.status === TaskStatus.DONE).length
                            : myScripts.filter(p => {
                                if (p.status === TaskStatus.DONE) return false;
                                switch(filter.id) {
                                    case 'SCRIPT_L1': return p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1;
                                    case 'SCRIPT_L2': return p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2;
                                    case 'CINE': return p.current_stage === WorkflowStage.CINEMATOGRAPHY;
                                    case 'PARTNER_REVIEW': return p.current_stage === WorkflowStage.PARTNER_REVIEW;
                                    case 'SENT_TO_INF': return p.current_stage === WorkflowStage.SENT_TO_INFLUENCER;
                                    case 'CMO_VIDEO': return p.current_stage === WorkflowStage.PA_VIDEO_CMO_REVIEW;
                                    case 'EDITING': return p.current_stage === WorkflowStage.VIDEO_EDITING;
                                    case 'FINAL_CMO': return p.current_stage === WorkflowStage.FINAL_REVIEW_CMO;
                                    case 'FINAL_CEO': return p.current_stage === WorkflowStage.FINAL_REVIEW_CEO;
                                    case 'PA_FINAL': return p.current_stage === WorkflowStage.PA_FINAL_REVIEW;
                                    case 'PROOF': return !!((p.data as any)?.posting_proof_link || (p.metadata as any)?.posting_proof_link);
                                    case 'POSTED': return p.current_stage === WorkflowStage.POSTED;
                                    default: return false;
                                }
                            }).length
                            })`}
                    </button>
                ))}
            </div>

            <div className="grid gap-4">
                {filteredProjects.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-16 text-center">
                        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-black uppercase text-slate-400 tracking-tight">
                            Your script queue is empty
                        </h3>
                        <p className="text-slate-400 font-bold uppercase text-[10px] mt-2">No projects match the selected filter</p>
                    </div>
                ) : (
                    filteredProjects.map(task => (
                        <div
                            key={task.id}
                            onClick={async () => {
                                if (task.status === TaskStatus.REWORK || task.current_stage === WorkflowStage.SCRIPT_REVIEW_L1) {
                                    setEditingProject(task);
                                } else {
                                    setSelectedProject(task);
                                    const { data: allHistoryData } = await supabase
                                        .from('workflow_history')
                                        .select('*')
                                        .eq('project_id', task.id)
                                        .order('timestamp', { ascending: false });
                                    
                                    if (allHistoryData) {
                                        // Filter to include all relevant workflow stages for comprehensive history
                                        const commentsData = allHistoryData.filter(item => {
                                            if (['APPROVED', 'REWORK', 'REJECTED'].includes(item.action)) return true;
                                            if (item.stage === 'SCRIPT' && item.action === 'SUBMITTED') return true;
                                            if (item.stage === 'REWORK' && item.action === 'SUBMITTED') return true;
                                            if (['WRITER_VIDEO_APPROVAL', 'POST_WRITER_REVIEW'].includes(item.stage) && item.action === 'SUBMITTED') return true;
                                            if (item.stage === 'MULTI_WRITER_APPROVAL' && ['APPROVED', 'SUBMITTED'].includes(item.action)) return true;
                                            if (item.action === 'SET_SHOOT_DATE' || item.action === 'SET_DELIVERY_DATE') return true;
                                            if (['CINEMATOGRAPHY', 'VIDEO_EDITING', 'SUB_EDITOR_PROCESSING', 'THUMBNAIL_DESIGN'].includes(item.stage) && item.action === 'SUBMITTED') return true;
                                            if (['FINAL_REVIEW_CMO', 'FINAL_REVIEW_CEO'].includes(item.stage)) return true;
                                            if (item.action === 'SUB_EDITOR_ASSIGNED') return true;
                                            if (item.action === 'REWORK_VIDEO_SUBMITTED') return true;
                                            return false;
                                        });
                                        setReviewComments(commentsData || []);
                                    }
                                }
                            }}
                            className="bg-white p-6 border-2 border-black cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 text-[10px] font-black uppercase border-2 border-black bg-black text-white">
                                        {task.channel}
                                    </span>
                                    <span className={`px-3 py-1 text-[10px] font-black uppercase border-2 border-black ${
                                        task.status === TaskStatus.DONE ? 'bg-green-500 text-white' : 
                                        task.status === TaskStatus.REWORK ? 'bg-orange-500 text-white' : 
                                        'bg-[#0085FF] text-white'
                                    }`}>
                                        {task.status === TaskStatus.DONE ? 'COMPLETED' : (STAGE_LABELS[task.current_stage] || task.current_stage?.replace(/_/g, ' '))}
                                    </span>
                                </div>
                                <div className="text-[10px] font-black text-slate-400 flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {format(new Date(task.created_at), 'MMM dd, yyyy')}
                                </div>
                            </div>
                            <h3 className="text-lg font-black text-slate-900 uppercase leading-tight mb-2">
                                {(() => {
                                    let displayTitle = task.title;
                                    if (task.brand) {
                                        displayTitle = displayTitle.replace(new RegExp(task.brand.replace(/_/g, ' '), 'gi'), '');
                                    }
                                    return displayTitle.replace(/^ - | - $/g, '').replace(/\( - \)/g, '').replace(/\(\)/g, '').trim() || task.title;
                                })()}
                            </h3>
                            <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-slate-50">
                                <div className="flex flex-col gap-3">
                                    <div className="text-[10px] font-black text-[#0085FF] uppercase">
                                        {task.brand?.replace(/_/g, ' ') || 'GENERAL'}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {(task.video_link || (task as any).video_url) && (
                                            <a href={task.video_link || (task as any).video_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors" title="Raw Video" onClick={(e) => e.stopPropagation()}>
                                                <Video className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                        {task.edited_video_link && (
                                            <a href={task.edited_video_link} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-purple-50 text-purple-600 rounded border border-purple-100 hover:bg-purple-100 transition-colors" title="Edited Video" onClick={(e) => e.stopPropagation()}>
                                                <PlayCircle className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                        {task.thumbnail_link && (
                                            <a href={task.thumbnail_link} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded border border-blue-100 hover:bg-blue-100 transition-colors" title="Thumbnail" onClick={(e) => e.stopPropagation()}>
                                                <Layout className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                        {task.creative_link && (
                                            <a href={task.creative_link} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-pink-50 text-pink-600 rounded border border-pink-100 hover:bg-pink-100 transition-colors" title="Creative Asset" onClick={(e) => e.stopPropagation()}>
                                                <Tag className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <span className="text-[10px] font-black uppercase text-slate-900 flex items-center">
                                    View Details <Edit3 className="w-3 h-3 ml-1" />
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PAScriptMyWork;
