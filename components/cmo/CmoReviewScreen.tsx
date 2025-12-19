import React, { useState, useRef } from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, TaskStatus, Channel } from '../../types';
import { db } from '../../services/supabaseDb';
import { ArrowLeft, Check, RotateCcw, X, Video, Image as ImageIcon, Download } from 'lucide-react';
import Popup from '../Popup';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Props {
    project: Project;
    onBack: () => void;
    onComplete: () => void;
}

const CmoReviewScreen: React.FC<Props> = ({ project, onBack, onComplete }) => {
    const [decision, setDecision] = useState<'APPROVE' | 'REWORK' | 'REJECT' | null>(null);
    const [comment, setComment] = useState('');
    const [reworkStage, setReworkStage] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState<number>(5000);
    
    // Confirmation popup state
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationAction, setConfirmationAction] = useState<'APPROVE' | 'REWORK' | 'REJECT' | null>(null);

    const isFinalReview = project.current_stage === WorkflowStage.FINAL_REVIEW_CMO;
    const isVideo = project.channel !== Channel.LINKEDIN;

    const scriptContentRef = useRef<HTMLDivElement>(null);

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
        setIsSubmitting(true);
        
        try {
            if (decision === 'APPROVE') {
                // CMO Approval -> Moves to next stage based on current stage
                await db.advanceWorkflow(project.id, comment || 'Approved by CMO');

                // Show popup for approval
                let stageLabel, message;
                if (project.current_stage === WorkflowStage.FINAL_REVIEW_CMO) {
                    // For final review, show Ready for Publishing and mention CEO
                    stageLabel = 'Ready for Publishing';
                    message = `CMO has approved. Ready for CEO review.`;
                } else {
                    // For regular review, show next stage
                    const nextStage = project.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 ? 
                        WorkflowStage.SCRIPT_REVIEW_L2 : WorkflowStage.CINEMATOGRAPHY;
                    stageLabel = STAGE_LABELS[nextStage] || 'Next Stage';
                    message = `CMO has approved. Current stage: ${stageLabel}.`;
                }
                setPopupMessage(message);
                setStageName(stageLabel);
                setPopupDuration(5000); // auto-close for approval
                setTimeout(() => {
                    setShowPopup(true);
                }, 0);
            } else if (decision === 'REWORK') {
                // Rework -> Moves back to WRITER (SCRIPT) or other roles
                await db.rejectTask(project.id, reworkStage as WorkflowStage, comment);
                
                // Show popup for rework
                setPopupMessage('CMO has sent the script back for rework.');
                setStageName('Script Rework');
                setPopupDuration(5000); // manual close for rework
                setTimeout(() => {
                    setShowPopup(true);
                }, 0);
            } else if (decision === 'REJECT') {
                // Full Reject
                await db.rejectTask(project.id, WorkflowStage.SCRIPT, 'Project killed by CMO: ' + comment);
                
                // Show popup for rejection
                setPopupMessage('CMO has rejected the script.');
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
        // CMO can send back to Writer from Script Review L1
        if (project.current_stage === WorkflowStage.SCRIPT_REVIEW_L1) {
            return [{ value: WorkflowStage.SCRIPT, label: 'Writer (Fix Script)' }];
        }
        
        // For Final Review CMO, can send back to various roles
        if (project.current_stage === WorkflowStage.FINAL_REVIEW_CMO) {
            const options = [
                { value: WorkflowStage.CREATIVE_DESIGN, label: 'Designer (Fix Visuals)' },
            ];
            // If video channel, add Editor/Cine
            if (isVideo) {
                options.push({ value: WorkflowStage.VIDEO_EDITING, label: 'Editor (Fix Video)' });
                options.push({ value: WorkflowStage.CINEMATOGRAPHY, label: 'Cinematographer (Reshoot)' });
            }
            return options;
        }
        
        // Default fallback
        return [{ value: WorkflowStage.SCRIPT, label: 'Writer' }];
    };

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
                                {project.writer_name || project.data?.writer_name || '—'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Priority</label>
                            <div className={`font-bold uppercase ${project.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                                {project.priority}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Status</label>
                            <div className="font-bold text-slate-900 uppercase">
                                {project.status}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase mb-1">Due Date</label>
                            <div className="font-bold text-slate-900 uppercase">Today</div>
                        </div>
                    </div>

                    {/* Brief Content */}
                    {project.data?.brief && (
                        <section className="space-y-4">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Brief / Notes</h3>
                            <div className="border-2 border-black bg-white p-8 min-h-[100px] whitespace-pre-wrap text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                {project.data.brief}
                            </div>
                        </section>
                    )}

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
                        <div 
                            ref={scriptContentRef}
                            className="border-2 border-black bg-white p-8 min-h-[300px] whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        >
                            {project.data?.script_content || 'No script content available.'}
                        </div>
                    </section>

                    {/* Assets Section (Only for final review) */}
                    {project.current_stage === WorkflowStage.FINAL_REVIEW_CMO && (
                        <section className="space-y-4 pt-6 border-t-4 border-black">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Production Assets</h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        </section>
                    )}
                </div>

                {/* RIGHT COLUMN: Approval Panel (30%) - Sticky */}
                <div className="w-full md:w-[450px] bg-white border-l-2 border-black p-8 shadow-[-10px_0px_20px_rgba(0,0,0,0.05)] sticky bottom-0 md:top-20 md:h-[calc(100vh-80px)] overflow-y-auto z-10 flex flex-col">
                    <h2 className="text-2xl font-black text-slate-900 uppercase mb-8 border-b-4 border-black pb-2 inline-block">CMO Decision</h2>

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
                                        {project.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 ? 'Move to CMO Review' : 'Ready for Publishing'}
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
                            disabled={!decision || isSubmitting || (decision === 'REWORK' && !reworkStage) || ((decision === 'REWORK' || decision === 'REJECT') && !comment)}
                            onClick={() => {
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

export default CmoReviewScreen;