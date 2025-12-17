import React, { useState } from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, TaskStatus } from '../../types';
import { db } from '../../services/supabaseDb';
import { ArrowLeft, Check, RotateCcw, X } from 'lucide-react';
import Popup from '../Popup';

interface Props {
    project: Project;
    onBack: () => void;
    onComplete: () => void;
}

const CmoReviewScreen: React.FC<Props> = ({ project, onBack, onComplete }) => {
    const [decision, setDecision] = useState<'APPROVED' | 'REWORK' | 'REJECTED' | null>(null);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');
    const [popupDuration, setPopupDuration] = useState<number>(5000);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        
        try {
            if (decision === 'APPROVED') {
                // CMO Approval -> Moves to next stage based on current stage
                console.log('Approving project:', project);
                console.log('Current stage:', project.current_stage);
                await db.advanceWorkflow(project.id, comment || 'Approved by CMO');

const nextStage =
  project.current_stage === WorkflowStage.SCRIPT_REVIEW_L1
    ? WorkflowStage.SCRIPT_REVIEW_L2
    : WorkflowStage.CINEMATOGRAPHY;

// For final review CMO stage, show current stage; otherwise show next stage
const displayStage = project.current_stage === WorkflowStage.FINAL_REVIEW_CMO ? WorkflowStage.FINAL_REVIEW_CMO : nextStage;
const stageLabel = STAGE_LABELS[displayStage];

setPopupMessage(`CMO has approved. Current stage: ${stageLabel}.`);
setStageName(stageLabel);
setPopupDuration(5000);

setTimeout(() => {
  setShowPopup(true);
}, 0);
            }
               else if (decision === 'REWORK') {
                // Rework -> Moves back to WRITER (SCRIPT)
                await db.rejectTask(project.id, WorkflowStage.SCRIPT, comment);
                
                // Show popup for rework
                setPopupMessage('CMO has sent the script back for rework.');
                setStageName('Script Rework');
                setPopupDuration(5000); // manual close for rework
                setTimeout(() => {
  setShowPopup(true);
}, 0);
            } else if (decision === 'REJECTED') {
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

    return (
        <div className="min-h-screen bg-white font-sans flex flex-col">
            <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 bg-white/95 backdrop-blur z-20">
                <div className="flex items-center space-x-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900">Review: {project.title}</h1>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded uppercase">{project.channel}</span>
                    <span className="text-xs font-bold uppercase text-slate-500">Stage: {STAGE_LABELS[project.current_stage]}</span>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row max-w-[1600px] mx-auto w-full">
                <div className="flex-1 p-8 overflow-y-auto">
                    {/* Content Viewer */}
                    <div className="max-w-3xl mx-auto space-y-8">
                        <div className="bg-slate-50 p-8 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Script Content</h3>
                            <div className="prose prose-slate max-w-none font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">
                                {project.data.script_content || 'No content provided.'}
                            </div>
                        </div>

                        {project.data.brief && (
                            <div className="bg-white p-6 rounded-xl border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Original Brief</h3>
                                <p className="text-slate-600">{project.data.brief}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Decision */}
                <div className="w-full md:w-[400px] bg-white border-l border-slate-200 p-6 shadow-xl sticky bottom-0 md:top-16 md:h-[calc(100vh-64px)]">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">CMO Decision</h2>

                    <div className="space-y-3 mb-6">
                        <button
                            onClick={() => setDecision('APPROVED')}
                            className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${decision === 'APPROVED' ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                            <div className="text-left">
                                <span className="block font-bold">Approve Content</span>
                                <span className="text-xs opacity-75">Move to Production</span>
                            </div>
                            <Check className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => setDecision('REWORK')}
                            className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${decision === 'REWORK' ? 'border-yellow-400 bg-yellow-50 text-yellow-900' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                            <div className="text-left">
                                <span className="block font-bold">Request Rework</span>
                                <span className="text-xs opacity-75">Send back for edits</span>
                            </div>
                            <RotateCcw className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => setDecision('REJECTED')}
                            className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${decision === 'REJECTED' ? 'border-red-600 bg-red-50 text-red-900' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                            <div className="text-left">
                                <span className="block font-bold">Reject</span>
                                <span className="text-xs opacity-75">Terminate workflow</span>
                            </div>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4 animate-fade-in">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Comments {decision === 'REWORK' && '(Required)'}</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full h-32 p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={decision === 'REWORK' ? "What needs to be fixed?" : "Optional notes..."}
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!decision || isSubmitting || (decision === 'REWORK' && !comment)}
                        className={`w-full mt-8 py-4 rounded-xl font-bold text-white shadow-lg transition-all ${decision === 'APPROVED' ? 'bg-blue-600 hover:bg-blue-700' :
                            decision === 'REWORK' ? 'bg-yellow-500 hover:bg-yellow-600' :
                                decision === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' :
                                    'bg-slate-300 cursor-not-allowed'
                            }`}
                    >
                        {isSubmitting ? 'Processing...' : 'Confirm Decision'}
                    </button>

                </div>
            </div>
            {showPopup && (
                        <Popup
    message={popupMessage}
    stageName={stageName}
    onClose={() => {
        setShowPopup(false);
        onComplete(); // Call onComplete when popup is closed
    }}
    duration={popupDuration}
/>
            )}
        </div>
    );
};

export default CmoReviewScreen;