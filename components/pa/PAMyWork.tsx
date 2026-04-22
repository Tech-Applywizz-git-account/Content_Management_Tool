
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Send, Video, CheckCircle2, ExternalLink, FileText } from 'lucide-react';
import { Project, WorkflowStage } from '../../types';

interface PAMyWorkProps {
    user: any;
    projects: Project[];
    onReview?: (project: Project) => void;
}

const PAMyWork: React.FC<PAMyWorkProps> = ({ user, projects, onReview }) => {
    const navigate = useNavigate();

    const influencerStats = useMemo(() => {
        const stats: Record<string, { 
            name: string; 
            scriptSent: number; 
            rawReceived: number; 
            editedSent: number, 
            totalProjects: number, 
            influencerProjects: Project[],
            brands: Set<string>
        }> = {};

        projects.forEach(p => {
            // Only process projects marked as PA brands
            if (!p.data?.is_pa_brand) return;

            const influencerName = p.data?.influencer_name || (p as any).metadata?.influencer_name || (p as any).influencer_name;
            if (!influencerName) return;

            const nameKey = influencerName.toLowerCase().trim();

            if (!stats[nameKey]) {
                stats[nameKey] = { 
                    name: influencerName, 
                    scriptSent: 0, 
                    rawReceived: 0, 
                    editedSent: 0, 
                    totalProjects: 0, 
                    influencerProjects: [],
                    brands: new Set<string>()
                };
            }

            stats[nameKey].totalProjects += 1;
            stats[nameKey].influencerProjects.push(p);

            // Track brand
            const brandName = p.brand || p.data?.brand || p.data?.brand_other;
            if (brandName) {
                stats[nameKey].brands.add(brandName);
            }

            // Script sent: stage is beyond PARTNER_REVIEW
            const isScriptSent = p.current_stage !== WorkflowStage.PARTNER_REVIEW;

            // Raw Video Received: past SENT_TO_INFLUENCER and has a link, or stage is explicitly editing/review
            const hasRawVideo = !!p.video_link || [
                WorkflowStage.VIDEO_EDITING,
                WorkflowStage.SUB_EDITOR_ASSIGNMENT,
                WorkflowStage.SUB_EDITOR_PROCESSING,
                WorkflowStage.PA_FINAL_REVIEW,
                WorkflowStage.POSTED,
                WorkflowStage.OPS_SCHEDULING
            ].includes(p.current_stage);

            // Edited Video Sent: POSTED
            const isEditedSent = p.current_stage === WorkflowStage.POSTED;

            if (isScriptSent) stats[nameKey].scriptSent += 1;
            if (hasRawVideo) stats[nameKey].rawReceived += 1;
            if (isEditedSent) stats[nameKey].editedSent += 1;
        });

        return Object.values(stats)
            .map(stat => ({
                ...stat,
                brandList: Array.from(stat.brands).sort()
            }))
            .sort((a, b) => b.totalProjects - a.totalProjects);
    }, [projects]);

    const handleInfluencerClick = (influencerName: string) => {
        // Navigate to the influencer portfolio view
        const influencerProjects = projects.filter(p => {
            if (!p.data?.is_pa_brand) return false;
            const projInfluencerName = p.data?.influencer_name || (p as any).metadata?.influencer_name || (p as any).influencer_name;
            return projInfluencerName && projInfluencerName.toLowerCase().trim() === influencerName.toLowerCase().trim();
        });

        if (influencerProjects.length > 0) {
            // Navigate to the NEW separate portfolio page using the first project as reference
            navigate(`/partner_associate/influencer/${influencerProjects[0].id}`);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2">
                        My Work
                    </h1>
                    <p className="font-bold text-base sm:text-lg text-slate-500">
                        Track influencer performance and deliverables
                    </p>
                </div>
            </div>

            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-slate-100">
                    <div className="bg-[#0085FF] p-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-black uppercase">Influencer Stats ({influencerStats.length})</h2>
                </div>

                {influencerStats.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 font-bold uppercase border-2 border-dashed border-slate-300">
                        No influencers found. Send scripts from Initial Review to add them.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border-2 border-black min-w-[700px]">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="p-4 border-2 border-black font-black uppercase tracking-wide text-sm">Influencer Name</th>
                                    <th className="p-4 border-2 border-black font-black uppercase tracking-wide text-sm bg-orange-50 text-orange-900">Brands</th>
                                    <th className="p-4 border-2 border-black font-black uppercase tracking-wide text-sm bg-purple-100 text-purple-900">
                                        <div className="flex items-center gap-2"><Send className="w-4 h-4" /> Scripts Sent</div>
                                    </th>
                                    <th className="p-4 border-2 border-black font-black uppercase tracking-wide text-sm bg-blue-100 text-blue-900">
                                        <div className="flex items-center gap-2"><Video className="w-4 h-4" /> Raw Received</div>
                                    </th>
                                    <th className="p-4 border-2 border-black font-black uppercase tracking-wide text-sm bg-green-100 text-green-900">
                                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Edited Sent</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {influencerStats.map((stat, idx) => (
                                    <tr
                                        key={idx}
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                        onClick={() => handleInfluencerClick(stat.name)}
                                    >
                                        <td className="p-4 border-2 border-black font-black text-slate-900 uppercase">
                                            <div className="flex items-center gap-2">
                                                <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                                                {stat.name}
                                            </div>
                                        </td>
                                        <td className="p-4 border-2 border-black">
                                            <div className="flex flex-wrap gap-1">
                                                {stat.brandList.length > 0 ? (
                                                    stat.brandList.map((brand, bIdx) => (
                                                        <span 
                                                            key={bIdx} 
                                                            className="px-2 py-0.5 bg-orange-100 border border-orange-300 text-orange-900 text-[10px] font-black uppercase rounded"
                                                        >
                                                            {brand.replace(/_/g, ' ')}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic">No Brands</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 border-2 border-black text-center font-bold text-xl text-purple-700">
                                            {stat.scriptSent}
                                        </td>
                                        <td className="p-4 border-2 border-black text-center font-bold text-xl text-blue-700">
                                            {stat.rawReceived}
                                        </td>
                                        <td className="p-4 border-2 border-black text-center font-bold text-xl text-green-700">
                                            {stat.editedSent}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PAMyWork;
