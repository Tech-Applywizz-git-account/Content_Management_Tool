import React from 'react';
import { Project, Role, STAGE_LABELS } from '../../types';
import { ArrowLeft, Clock, User, FileText, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
    project: Project;
    onBack: () => void;
}

const WriterProjectDetail: React.FC<Props> = ({ project, onBack }) => {
    return (
        <div className="min-h-screen bg-white font-sans flex flex-col animate-fade-in">
            <header className="h-16 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white/95 backdrop-blur z-20 shadow-[0_4px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 border-2 border-transparent hover:border-black"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-black uppercase text-slate-900">{project.title}</h1>
                    <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                            project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                'bg-[#D946EF] text-white'
                        }`}>
                        {project.channel}
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-8 space-y-8">

                    {/* Current Status Card */}
                    <div className="bg-gradient-to-br from-blue-50 to-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-black uppercase text-slate-900 mb-2">Current Status</h2>
                                <p className="text-sm font-bold text-slate-500 uppercase">Submitted {formatDistanceToNow(new Date(project.created_at))} ago</p>
                            </div>
                            <div className="bg-blue-600 text-white px-4 py-2 border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                In Review
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 border-2 border-black">
                                <div className="flex items-center space-x-2 mb-2">
                                    <User className="w-5 h-5 text-blue-600" />
                                    <span className="text-xs font-bold uppercase text-slate-500">Current Reviewer</span>
                                </div>
                                <p className="font-black text-lg uppercase">
                                    {project.assigned_to_role === Role.CMO ? 'CMO Review' :
                                        project.assigned_to_role === Role.CEO ? 'CEO Review' :
                                            STAGE_LABELS[project.current_stage]}
                                </p>
                            </div>

                            <div className="bg-white p-6 border-2 border-black">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Clock className="w-5 h-5 text-blue-600" />
                                    <span className="text-xs font-bold uppercase text-slate-500">Stage</span>
                                </div>
                                <p className="font-black text-lg uppercase">{STAGE_LABELS[project.current_stage]}</p>
                            </div>

                            <div className="bg-white p-6 border-2 border-black">
                                <div className="flex items-center space-x-2 mb-2">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    <span className="text-xs font-bold uppercase text-slate-500">Status</span>
                                </div>
                                <p className="font-black text-lg uppercase">{project.status}</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase text-slate-500">Workflow Progress</span>
                                <span className="text-xs font-bold uppercase text-slate-900">
                                    {project.assigned_to_role === Role.CMO ? 'Level 1 Review' :
                                        project.assigned_to_role === Role.CEO ? 'Level 2 Review' : 'Processing'}
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 h-3 border-2 border-black overflow-hidden">
                                <div
                                    className="bg-blue-600 h-full transition-all duration-500"
                                    style={{ width: project.assigned_to_role === Role.CEO ? '75%' : '50%' }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Script Content */}
                    <div className="bg-slate-50 p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-xl font-black uppercase mb-6 text-slate-900">Script Content</h3>
                        <div className="prose prose-slate max-w-none">
                            <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap bg-white p-6 border-2 border-slate-200">
                                {project.data.script_content || 'No content available'}
                            </div>
                        </div>
                    </div>

                    {/* Project Details */}
                    <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-xl font-black uppercase mb-6 text-slate-900">Project Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {project.data.brief && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Brief</span>
                                    <p className="text-slate-700 font-medium">{project.data.brief}</p>
                                </div>
                            )}
                            {project.data.keywords && (
                                <div>
                                    <span className="text-xs font-bold uppercase text-slate-500 block mb-2">Keywords</span>
                                    <p className="text-slate-700 font-medium">{project.data.keywords}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Review History */}
                    <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex items-center space-x-2 mb-6">
                            <MessageSquare className="w-6 h-6" />
                            <h3 className="text-xl font-black uppercase text-slate-900">Review History</h3>
                        </div>

                        <div className="space-y-4">
                            {/* Timeline */}
                            <div className="flex items-start space-x-4">
                                <div className="w-3 h-3 bg-blue-600 border-2 border-black rounded-full mt-2"></div>
                                <div className="flex-1 pb-8 border-l-2 border-dashed border-slate-300 pl-6">
                                    <span className="text-xs font-bold uppercase text-slate-500">
                                        {formatDistanceToNow(new Date(project.created_at))} ago
                                    </span>
                                    <p className="font-black text-slate-900 uppercase mt-1">Script Submitted</p>
                                    <p className="text-sm text-slate-600 mt-2">Script submitted for review by Writer</p>
                                </div>
                            </div>

                            {project.assigned_to_role === Role.CEO && (
                                <div className="flex items-start space-x-4">
                                    <div className="w-3 h-3 bg-green-600 border-2 border-black rounded-full mt-2"></div>
                                    <div className="flex-1 pb-8 border-l-2 border-dashed border-slate-300 pl-6">
                                        <span className="text-xs font-bold uppercase text-slate-500">Recently</span>
                                        <p className="font-black text-slate-900 uppercase mt-1">CMO Approved</p>
                                        <p className="text-sm text-slate-600 mt-2">Passed initial review, now with CEO</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start space-x-4">
                                <div className="w-3 h-3 bg-slate-300 border-2 border-black rounded-full mt-2 animate-pulse"></div>
                                <div className="flex-1 pl-6">
                                    <span className="text-xs font-bold uppercase text-slate-500">Current</span>
                                    <p className="font-black text-slate-900 uppercase mt-1">
                                        {project.assigned_to_role === Role.CMO ? 'With CMO' :
                                            project.assigned_to_role === Role.CEO ? 'With CEO' : 'In Process'}
                                    </p>
                                    <p className="text-sm text-slate-600 mt-2">Awaiting review decision</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Note */}
                    <div className="bg-yellow-50 border-2 border-yellow-400 p-6">
                        <p className="text-sm font-bold text-yellow-900">
                            <strong className="uppercase">Note:</strong> You will be notified once the review is complete.
                            If changes are requested, the project will return to your Drafts/Rework section.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default WriterProjectDetail;
