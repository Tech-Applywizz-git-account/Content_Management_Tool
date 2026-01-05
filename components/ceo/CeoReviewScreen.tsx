
import React, { useState, useRef, useEffect } from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, Channel } from '../../types';
import { db } from '../../services/supabaseDb';
import { getWorkflowState } from '../../services/workflowUtils';
import { supabase } from '../../src/integrations/supabase/client';
import { ArrowLeft, Check, X, RotateCcw, Download, Video, Image as ImageIcon } from 'lucide-react';
import Popup from '../Popup';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Props {
    project: Project;
    user: { full_name: string; role: Role };
    onBack: () => void;
    onComplete: () => void;
}

const CeoReviewScreen: React.FC<Props> = ({ project, user, onBack, onComplete }) => {
    const [decision, setDecision] = useState<'APPROVE' | 'REWORK' | 'REJECT' | null>(null);
    const [comment, setComment] = useState('');
    const [reworkStage, setReworkStage] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previousScript, setPreviousScript] = useState<string | null>(null);
    const [previousAssets, setPreviousAssets] = useState<{
        video_link: string | null;
        edited_video_link: string | null;
        thumbnail_link: string | null;
        creative_link: string | null;
    } | null>(null);
    
    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState<number>(0);
    
    // Confirmation popup state
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationAction, setConfirmationAction] = useState<'APPROVE' | 'REWORK' | 'REJECT' | null>(null);

    const scriptContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchPreviousScript = async () => {
            // Fetch previous script version and asset links if project is rejected
            const { data: historyData, error: historyError } = await supabase
                .from('workflow_history')
                .select('script_content, video_link, edited_video_link, thumbnail_link, creative_link')
                .eq('project_id', project.id)
                .in('action', ['REJECTED', 'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED'])
                .order('timestamp', { ascending: false })
                .limit(1);

            if (historyError) {
                // Handle case where script_content column doesn't exist yet
                if (historyError.code === '42703') {
                    console.warn('script_content column not found in workflow_history table. This is expected if the migration hasn\'t been applied yet.');
                } else {
                    console.error('Error fetching previous script:', historyError);
                }
            } else if (historyData && historyData.length > 0) {
                if (historyData[0].script_content) {
                    setPreviousScript(historyData[0].script_content);
                }
                
                // Set previous asset links
                setPreviousAssets({
                    video_link: historyData[0].video_link,
                    edited_video_link: historyData[0].edited_video_link,
                    thumbnail_link: historyData[0].thumbnail_link,
                    creative_link: historyData[0].creative_link
                });
            }
        };

        fetchPreviousScript();
    }, [project.id]);

    const downloadPDF = async () => {
        if (!scriptContentRef.current) return;

        try {
            // Create a clone of the content to avoid styling issues
            const clone = scriptContentRef.current.cloneNode(true) as HTMLElement;
            
            // Create a temporary container
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.width = '800px'; // Standard PDF width
            tempContainer.style.padding = '20px';
            tempContainer.appendChild(clone);
            document.body.appendChild(tempContainer);

            // Convert to canvas
            const canvas = await html2canvas(tempContainer, {
                scale: 2, // Higher quality
                useCORS: true,
                logging: false
            });

            // Convert to PDF
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            
            const imgWidth = pdf.internal.pageSize.getWidth();
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`${project.title}_script.pdf`);

            // Clean up
            document.body.removeChild(tempContainer);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    const handleSubmit = async () => {
        if (!decision) return;
        setIsSubmitting(true);

        try {
            if (decision === 'APPROVE') {
                await db.advanceWorkflow(project.id, comment || 'Approved by CEO');

                // Show popup for approval
                const nextStage = project.current_stage === WorkflowStage.SCRIPT_REVIEW_L2 ? 
                    WorkflowStage.CINEMATOGRAPHY : WorkflowStage.OPS_SCHEDULING;
                // For final review CEO stage, show OPS_SCHEDULING as current stage
                const displayStage = project.current_stage === WorkflowStage.FINAL_REVIEW_CEO ? WorkflowStage.OPS_SCHEDULING : nextStage;
                const stageLabel = STAGE_LABELS[displayStage] || 'Next Stage';
                setPopupMessage(`CEO has approved. Current stage: ${stageLabel}.`);
                setStageName(stageLabel);
                setPopupDuration(5000); // auto-close for approval
                setTimeout(() => {
  setShowPopup(true);
}, 0);
            } else if (decision === 'REWORK') {
                await db.rejectTask(project.id, reworkStage as WorkflowStage, comment);
                
                // Show popup for rework
                setPopupMessage('CEO has sent the script back for rework. The recipient will have full editing capabilities.');
                setStageName('Script Rework');
                setPopupDuration(5000); // manual close for rework
                setTimeout(() => {
  setShowPopup(true);
}, 0);
            } else if (decision === 'REJECT') {
                // Full reject goes back to SCRIPT/Draft usually, or a specific REJECTED state
                // For reject, we don't send back to a specific role, just reject the project
                await db.rejectTask(project.id, WorkflowStage.SCRIPT, comment || 'Rejected completely by CEO');
                
                // Show popup for rejection
                setPopupMessage('CEO has rejected the script. The recipient will see comments but have limited editing capabilities.');
                setStageName('Rejected');
                setPopupDuration(5000); // manual close for reject
                setTimeout(() => {
  setShowPopup(true);
}, 0);
            }
            // Do NOT call onComplete() immediately — wait until popup is closed so it is visible to the user
        } catch (error) {
            console.error('Failed to process review decision:', error);
            alert(`Failed to process review: ${error.message || 'Unknown error occurred'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getReworkOptions = () => {
        // STRICT CEO LOGIC
        // 1. Script Review Stage: Can ONLY go back to Writer.
        if (project.current_stage === WorkflowStage.SCRIPT_REVIEW_L2) {
            return [{ value: WorkflowStage.SCRIPT, label: 'Writer (Fix Script)' }];
        }

        // 2. Final Review Stage: Can go to CMO, Cine, Editor, or Designer. CANNOT go to Writer.
        if (project.current_stage === WorkflowStage.FINAL_REVIEW_CEO) {
            const options = [
                { value: WorkflowStage.FINAL_REVIEW_CMO, label: 'CMO (Review Feedback)' },
                { value: WorkflowStage.CREATIVE_DESIGN, label: 'Designer (Fix Visuals)' },
            ];
            // If video channel, add Editor/Cine
            if (project.channel !== Channel.LINKEDIN) {
                options.push({ value: WorkflowStage.VIDEO_EDITING, label: 'Editor (Fix Video)' });
                options.push({ value: WorkflowStage.CINEMATOGRAPHY, label: 'Cinematographer (Reshoot)' });
            }
            return options;
        }

        // Default fallback (shouldn't happen in CEO flow but good for safety)
        return [{ value: WorkflowStage.SCRIPT, label: 'Writer' }];
    };

    const isVideo = project.channel !== Channel.LINKEDIN;

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col">
            {/* Header */}
            <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
                <div className="flex items-center space-x-6">
                    <button onClick={onBack} className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all">
                        <ArrowLeft className="w-6 h-6 text-black" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Review: {project.title}</h1>
                        <div className="flex items-center space-x-2 mt-1">
                            <span className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black text-white ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F]' :
                                project.channel === 'LINKEDIN' ? 'bg-[#0085FF]' :
                                    'bg-[#D946EF]'
                                }`}>
                                {project.channel}
                            </span>
                            <span className="text-xs font-bold uppercase text-slate-500">
                                Stage: {STAGE_LABELS[project.current_stage]}
                            </span>
                            <span
                                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                                        ? 'bg-red-500 text-white'
                                        : project.priority === 'MEDIUM'
                                            ? 'bg-yellow-500 text-black'
                                            : 'bg-green-500 text-white'
                                    }`}
                            >
                                {project.priority}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row max-w-[1920px] mx-auto w-full">

                {/* LEFT COLUMN: Content (70%) */}
                <div className="flex-1 p-6 md:p-12 space-y-10 overflow-y-auto bg-slate-50">

                    {/* Info Block */}
                    <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Creator</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.data?.writer_name || project.writer_name || project.data?.cmo_name || project.cmo_name || 'Unknown Creator'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Priority</label>
                            <div className={`font-bold uppercase ${project.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                                {project.priority}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">CMO Status</label>
                            <div className="font-bold text-green-600 uppercase flex items-center">
                                <Check className="w-4 h-4 mr-1" /> Approved
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Due Date</label>
                            <div className="font-bold text-slate-900 uppercase">Today</div>
                        </div>
                    </div>

                    {/* Script Viewer */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Script & Message</h3>
                            <button 
                                onClick={downloadPDF}
                                className="text-sm font-bold uppercase flex items-center bg-white border-2 border-black px-4 py-2 hover:bg-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all"
                            >
                                <Download className="w-4 h-4 mr-2" /> Download PDF
                            </button>
                        </div>
                        
                        {previousScript ? (
                            // Show both old and new scripts side by side
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Previous Script */}
                                <div className="bg-white border-2 border-slate-300 p-6">
                                    <h4 className="font-black text-slate-900 uppercase mb-4 text-center">Previous Script</h4>
                                    <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-slate-50 p-4 border-2 border-slate-200 max-h-96 overflow-y-auto">
                                        {previousScript}
                                    </div>
                                </div>
                                
                                {/* Current Script */}
                                <div className="bg-white border-2 border-slate-300 p-6">
                                    <h4 className="font-black text-slate-900 uppercase mb-4 text-center">Current Script</h4>
                                    <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-slate-50 p-4 border-2 border-slate-200 max-h-96 overflow-y-auto">
                                        {project.data?.script_content || 'No script content available.'}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Show single script for non-rework projects
                            <div 
                                ref={scriptContentRef}
                                className="border-2 border-black bg-white p-8 min-h-[300px] whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            >
                                {project.data?.script_content || 'No script content available.'}
                            </div>
                        )}
                    </section>

                    {/* Assets Section (Only for final review) */}
                    {project.current_stage === WorkflowStage.FINAL_REVIEW_CEO && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Production Assets</h3>

                            {previousScript ? (
                                // Show both previous and current assets side by side for rework projects
                                <div className="space-y-8">
                                    {/* Raw Video Assets */}
                                    {isVideo && (project.video_link || previousAssets?.video_link) && (
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* Previous Raw Video */}
                                            {previousAssets?.video_link && (
                                                <div className="border-2 border-slate-300 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-100 border-b-2 border-slate-300">
                                                        <h4 className="font-black text-slate-900 text-sm uppercase text-center">Previous Raw Video</h4>
                                                    </div>
                                                    <div className="aspect-video bg-black flex items-center justify-center text-white">
                                                        <Video className="w-16 h-16 opacity-50" />
                                                    </div>
                                                    <div className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <p className="font-black text-slate-900 text-sm uppercase">Raw_Video.mp4</p>
                                                            <p className="text-xs text-slate-500 font-bold">Original footage</p>
                                                        </div>
                                                        <a href={previousAssets.video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Current Raw Video */}
                                            {project.video_link && (
                                                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-900 border-b-2 border-black">
                                                        <h4 className="font-black text-white text-sm uppercase text-center">Current Raw Video</h4>
                                                    </div>
                                                    <div className="aspect-video bg-black flex items-center justify-center text-white">
                                                        <Video className="w-16 h-16 opacity-50" />
                                                    </div>
                                                    <div className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <p className="font-black text-slate-900 text-sm uppercase">Raw_Video.mp4</p>
                                                            <p className="text-xs text-slate-500 font-bold">Original footage</p>
                                                        </div>
                                                        <a href={project.video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Edited Video Assets */}
                                    {isVideo && (project.edited_video_link || previousAssets?.edited_video_link) && (
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* Previous Edited Video */}
                                            {previousAssets?.edited_video_link && (
                                                <div className="border-2 border-slate-300 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-100 border-b-2 border-slate-300">
                                                        <h4 className="font-black text-slate-900 text-sm uppercase text-center">Previous Edited Video</h4>
                                                    </div>
                                                    <div className="aspect-video bg-black flex items-center justify-center text-white">
                                                        <Video className="w-16 h-16 opacity-50" />
                                                    </div>
                                                    <div className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <p className="font-black text-slate-900 text-sm uppercase">Edited_Video.mp4</p>
                                                            <p className="text-xs text-slate-500 font-bold">1080p • 24mb</p>
                                                        </div>
                                                        <a href={previousAssets.edited_video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Current Edited Video */}
                                            {project.edited_video_link && (
                                                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-900 border-b-2 border-black">
                                                        <h4 className="font-black text-white text-sm uppercase text-center">Current Edited Video</h4>
                                                    </div>
                                                    <div className="aspect-video bg-black flex items-center justify-center text-white">
                                                        <Video className="w-16 h-16 opacity-50" />
                                                    </div>
                                                    <div className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <p className="font-black text-slate-900 text-sm uppercase">Edited_Video.mp4</p>
                                                            <p className="text-xs text-slate-500 font-bold">1080p • 24mb</p>
                                                        </div>
                                                        <a href={project.edited_video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Thumbnail/Creative Assets */}
                                    {(project.thumbnail_link || previousAssets?.thumbnail_link) && (
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* Previous Thumbnail/Creative */}
                                            {previousAssets?.thumbnail_link && (
                                                <div className="border-2 border-slate-300 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-100 border-b-2 border-slate-300">
                                                        <h4 className="font-black text-slate-900 text-sm uppercase text-center">Previous Creative</h4>
                                                    </div>
                                                    <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300">
                                                        <ImageIcon className="w-16 h-16" />
                                                    </div>
                                                    <div className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <p className="font-black text-slate-900 text-sm uppercase">Creative_Thumbnail.png</p>
                                                            <p className="text-xs text-slate-500 font-bold">PNG • 2mb</p>
                                                        </div>
                                                        <a href={previousAssets.thumbnail_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Current Thumbnail/Creative */}
                                            {project.thumbnail_link && (
                                                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    <div className="p-3 bg-slate-900 border-b-2 border-black">
                                                        <h4 className="font-black text-white text-sm uppercase text-center">Current Creative</h4>
                                                    </div>
                                                    <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300">
                                                        <ImageIcon className="w-16 h-16" />
                                                    </div>
                                                    <div className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <p className="font-black text-slate-900 text-sm uppercase">Creative_Thumbnail.png</p>
                                                            <p className="text-xs text-slate-500 font-bold">PNG • 2mb</p>
                                                        </div>
                                                        <a href={project.thumbnail_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // Show single assets for non-rework projects
                                <div className="grid grid-cols-3 gap-6">
                                    {/* Raw Video Asset */}
                                    {isVideo && project.video_link && (
                                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            <div className="aspect-video bg-black flex items-center justify-center text-white border-b-2 border-black">
                                                <Video className="w-16 h-16 opacity-50" />
                                            </div>
                                            <div className="p-4 flex justify-between items-center bg-white">
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm uppercase">Raw_Video.mp4</p>
                                                    <p className="text-xs text-slate-500 font-bold">Original footage</p>
                                                </div>
                                                <a href={project.video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Edited Video Asset */}
                                    {isVideo && project.edited_video_link && (
                                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            <div className="aspect-video bg-black flex items-center justify-center text-white border-b-2 border-black">
                                                <Video className="w-16 h-16 opacity-50" />
                                            </div>
                                            <div className="p-4 flex justify-between items-center bg-white">
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm uppercase">Edited_Video.mp4</p>
                                                    <p className="text-xs text-slate-500 font-bold">1080p • 24mb</p>
                                                </div>
                                                <a href={project.edited_video_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Thumbnail/Creative Asset */}
                                    {project.thumbnail_link && (
                                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300 border-b-2 border-black">
                                                <ImageIcon className="w-16 h-16" />
                                            </div>
                                            <div className="p-4 flex justify-between items-center bg-white">
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm uppercase">Creative_Thumbnail.png</p>
                                                    <p className="text-xs text-slate-500 font-bold">PNG • 2mb</p>
                                                </div>
                                                <a href={project.thumbnail_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-black uppercase">View File</a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* RIGHT COLUMN: Approval Panel (30%) - Sticky */}
                <div className="w-full md:w-[450px] bg-white border-l-2 border-black p-8 shadow-[-10px_0px_20px_rgba(0,0,0,0.05)] sticky bottom-0 md:top-20 md:h-[calc(100vh-80px)] overflow-y-auto z-10 flex flex-col">
                    <h2 className="text-2xl font-black text-slate-900 uppercase mb-8 border-b-4 border-black pb-2 inline-block">Final Decision</h2>

                    <div className="space-y-4 flex-1">
                        {/* Approve Option */}
                        <label className={`block p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${decision === 'APPROVE' ? 'border-black bg-[#4ADE80]' : 'border-black bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center">
                                <input
                                    type="radio"
                                    name="decision"
                                    className="w-5 h-5 accent-black"
                                    checked={decision === 'APPROVE'}
                                    onChange={() => setDecision('APPROVE')}
                                />
                                <div className="ml-4 flex-1">
                                    <span className="block font-black text-lg uppercase text-slate-900">Approve Content</span>
                                    <span className="text-xs font-bold uppercase text-slate-600">
                                        {project.current_stage.includes('SCRIPT') ? 'Move to Production' : 'Ready for Publishing'}
                                    </span>
                                </div>
                                <Check className="w-8 h-8 ml-auto text-black" />
                            </div>
                        </label>

                        {/* Rework Option */}
                        <label className={`block p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${decision === 'REWORK' ? 'border-black bg-[#FFD952]' : 'border-black bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center">
                                <input
                                    type="radio"
                                    name="decision"
                                    className="w-5 h-5 accent-black"
                                    checked={decision === 'REWORK'}
                                    onChange={() => { setDecision('REWORK'); setReworkStage(''); }}
                                />
                                <div className="ml-4 flex-1">
                                    <span className="block font-black text-lg uppercase text-slate-900">Request Rework</span>
                                    <span className="text-xs font-bold uppercase text-slate-600">Send back for edits</span>
                                </div>
                                <RotateCcw className="w-8 h-8 ml-auto text-black" />
                            </div>
                        </label>

                        {/* Reject Option */}
                        <label className={`block p-6 border-2 cursor-pointer transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${decision === 'REJECT' ? 'border-black bg-[#FF4F4F] text-white' : 'border-black bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center">
                                <input
                                    type="radio"
                                    name="decision"
                                    className="w-5 h-5 accent-black"
                                    checked={decision === 'REJECT'}
                                    onChange={() => setDecision('REJECT')}
                                />
                                <div className="ml-4 flex-1">
                                    <span className={`block font-black text-lg uppercase ${decision === 'REJECT' ? 'text-white' : 'text-slate-900'}`}>Reject</span>
                                    <span className={`text-xs font-bold uppercase ${decision === 'REJECT' ? 'text-white/80' : 'text-slate-600'}`}>Terminate workflow</span>
                                </div>
                                <X className={`w-8 h-8 ml-auto ${decision === 'REJECT' ? 'text-white' : 'text-black'}`} />
                            </div>
                        </label>
                    </div>

                    <div className="my-8 border-t-2 border-dashed border-slate-300"></div>

                    {/* Conditional Inputs */}
                    <div className="space-y-6">
                        {decision === 'REWORK' && (
                            <div className="animate-fade-in space-y-2">
                                <label className="block text-xs font-black text-slate-500 uppercase">Send back to</label>
                                <select
                                    className="w-full p-4 border-2 border-black bg-white focus:bg-yellow-50 focus:outline-none font-bold text-sm uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                                    value={reworkStage}
                                    onChange={(e) => setReworkStage(e.target.value)}
                                >
                                    <option value="">-- Select Role --</option>
                                    {getReworkOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        )}

                        {(decision === 'REWORK' || decision === 'REJECT' || decision === 'APPROVE') && (
                            <div className="animate-fade-in space-y-2">
                                <label className="block text-xs font-black text-slate-500 uppercase">
                                    {decision === 'APPROVE' ? 'Notes (Optional)' : 'Reason (Required)'}
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder={decision === 'APPROVE' ? "Good job..." : "Please fix..."}
                                    className="w-full p-4 border-2 border-black rounded-none text-sm min-h-[120px] focus:bg-yellow-50 focus:outline-none font-medium resize-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                                />
                            </div>
                        )}
                    </div>

                    <div className="mt-8">
                        <button
                            disabled={!decision || isSubmitting || (decision === 'REWORK' && (!reworkStage || reworkStage === '')) || (decision === 'REJECT' && (!comment || comment.trim() === '')) || (decision === 'APPROVE' && (!comment || comment.trim() === ''))}
                            onClick={() => {
                                console.log('Button clicked', { decision, reworkStage, comment });
                                setConfirmationAction(decision);
                                setShowConfirmation(true);
                            }}
                            className={`w-full py-5 border-2 border-black font-black uppercase text-lg shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[6px] active:translate-x-[6px] transition-all flex justify-center items-center ${decision === 'REWORK' ? 'bg-[#FFD952] text-black' :
                                decision === 'REJECT' ? 'bg-[#FF4F4F] text-white' :
                                    decision === 'APPROVE' ? 'bg-[#0085FF] text-white' :
                                        'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300 shadow-none'
                                }`}
                        >
                            {isSubmitting ? (
                                <div className="w-6 h-6 border-4 border-current border-t-transparent rounded-full animate-spin" />
                            ) : decision === 'REWORK' ? 'Send For Rework' :
                                decision === 'REJECT' ? 'Confirm Rejection' :
                                    decision === 'APPROVE' ? 'Approve & Continue' :
                                        'Select Action'
                            }
                        </button>
                    </div>
                </div>
            </div>
            {showPopup && (
                <Popup
                    message={popupMessage}
                    stageName={stageName}
                    onClose={() => {
                        setShowPopup(false);
                        onComplete();
                    }}
                    duration={popupDuration}
                />
            )}
            
            {/* Confirmation Popup */}
            {showConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    {console.log('Rendering confirmation popup', { confirmationAction })}
                    <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-black uppercase">Confirm Action</h3>
                            <button 
                                onClick={() => setShowConfirmation(false)}
                                className="text-slate-500 hover:text-slate-700"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <p className="mb-6">
                            {confirmationAction === 'APPROVE' && 'Are you sure you want to approve this content?'}
                            {confirmationAction === 'REWORK' && 'Are you sure you want to send this content back for rework?'}
                            {confirmationAction === 'REJECT' && 'Are you sure you want to reject this content?'}
                        </p>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setShowConfirmation(false)}
                                className="flex-1 px-4 py-3 border-2 border-black text-black font-black uppercase hover:bg-slate-100 transition-colors"
                            >
                                No
                            </button>
                            <button
                                onClick={() => {
                                    setShowConfirmation(false);
                                    handleSubmit();
                                }}
                                className={`flex-1 px-4 py-3 border-2 border-black font-black uppercase transition-colors ${confirmationAction === 'REWORK' ? 'bg-[#FFD952] text-black' :
                                    confirmationAction === 'REJECT' ? 'bg-[#FF4F4F] text-white' :
                                        confirmationAction === 'APPROVE' ? 'bg-[#0085FF] text-white' :
                                            'bg-slate-200 text-slate-400'
                                }`}
                            >
                                Yes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CeoReviewScreen;
