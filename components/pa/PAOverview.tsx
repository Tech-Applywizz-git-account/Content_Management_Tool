import React, { useState, useEffect } from 'react';
import { db } from '../../services/supabaseDb';
import { BarChart3, TrendingUp, Building2, Calendar as CalendarIcon, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Project, WorkflowStage } from '../../types';

interface PAOverviewProps {
    user: any;
    allProjects: Project[];
    onSelectProject: (project: Project) => void;
}

const PAOverview: React.FC<PAOverviewProps> = ({ user, allProjects, onSelectProject }) => {
    const [brands, setBrands] = useState<any[]>([]);

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const data = await db.brands.getAll();
                setBrands(data);
            } catch (err) {
                console.error("Failed to load brands:", err);
            }
        };

        fetchBrands();
    }, []);

    // Filter data to only show user's owned brands and projects
    const myBrands = (brands || []).filter(b => b.created_by_user_id === user?.id);
    const myBrandNames = myBrands.map(b => b.brand_name.toLowerCase());
    
    // Include projects that are either:
    // 1. Associated with a brand this PA owns
    // 2. Explicitly assigned to this PA (important when others create projects for PA brands)
    const myProjects = (allProjects || []).filter(p => {
        const isAssignedToUser = p.assigned_to_user_id === user?.id;
        const belongsToMyBrand = p.brand && myBrandNames.includes(p.brand.toLowerCase());
        return isAssignedToUser || belongsToMyBrand;
    });

    // Metrics Calculations
    const approvedByCeo = myProjects.filter(p => p.current_stage === WorkflowStage.PARTNER_REVIEW).length;
    const sentToInfluencers = myProjects.filter(p => p.current_stage === WorkflowStage.SENT_TO_INFLUENCER).length;
    const uploadedVideos = myProjects.filter(p => p.video_link && p.current_stage === WorkflowStage.VIDEO_EDITING).length;
    const sentToEditor = myProjects.filter(p => p.current_stage === WorkflowStage.VIDEO_EDITING).length;
    const receivedFromEditor = myProjects.filter(p => p.current_stage === WorkflowStage.PA_FINAL_REVIEW).length;
    const postedCount = myProjects.filter(p => p.current_stage === WorkflowStage.POSTED).length;
    
    // Sort brands by recency
    const recentBrands = [...myBrands].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 5);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 mb-1">
                        Partnership Overview
                    </h1>
                    <p className="font-bold text-xs sm:text-sm text-slate-500">
                        High-level insights on your brand partnerships & delivery pipeline
                    </p>
                </div>
            </div>

            {/* Unified Metrics Grid - All 6 Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. CEO Approved Scripts */}
                <div className="bg-amber-400 border-4 border-black px-6 py-5 shadow-none hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 flex flex-col justify-between h-[150px] cursor-pointer group hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-2">
                        <FileText className="w-8 h-8 text-black border-2 border-black p-1" />
                        <span className="text-5xl font-black text-black tracking-tighter">{approvedByCeo}</span>
                    </div>
                    <div>
                        <p className="text-black font-black uppercase text-[9px] tracking-[0.15em] opacity-70 mb-0.5">Status: Action Required</p>
                        <p className="text-black font-black uppercase text-lg leading-tight">CEO Approved</p>
                    </div>
                </div>

                {/* 2. Sent to Influencers */}
                <div className="bg-[#D946EF] border-4 border-black px-6 py-5 shadow-none hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 flex flex-col justify-between h-[150px] text-white cursor-pointer group hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="w-8 h-8 border-2 border-white p-1" />
                        <span className="text-5xl font-black tracking-tighter">{sentToInfluencers}</span>
                    </div>
                    <div>
                        <p className="font-black uppercase text-[9px] tracking-[0.15em] opacity-80 mb-0.5">Status: Out for Delivery</p>
                        <p className="font-black uppercase text-lg leading-tight">Sent to Influencers</p>
                    </div>
                </div>

                {/* 3. Influencers Posted */}
                <div className="bg-[#0085FF] border-4 border-black px-6 py-5 shadow-none hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 flex flex-col justify-between h-[150px] text-white cursor-pointer group hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-2">
                        <CheckCircle2 className="w-8 h-8 border-2 border-white p-1" />
                        <span className="text-5xl font-black tracking-tighter">{postedCount}</span>
                    </div>
                    <div>
                        <p className="font-black uppercase text-[9px] tracking-[0.15em] opacity-80 mb-0.5">Status: Live / Complete</p>
                        <p className="font-black uppercase text-lg leading-tight">Influencers Posted</p>
                    </div>
                </div>

                {/* 4. Videos Uploaded (Raw) */}
                <div className="bg-white border-4 border-black px-6 py-5 shadow-none hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 flex flex-col justify-between h-[150px] cursor-pointer group hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-slate-100 border-2 border-black p-1.5">
                            <BarChart3 className="w-5 h-5 text-black" />
                        </div>
                        <span className="text-5xl font-black text-black tracking-tighter">{uploadedVideos}</span>
                    </div>
                    <div>
                        <p className="text-slate-400 font-black uppercase text-[9px] tracking-[0.15em] mb-0.5">Phase 1: Raw Footage</p>
                        <p className="text-black font-black uppercase text-lg leading-tight">Videos Uploaded</p>
                    </div>
                </div>

                {/* 5. Sent to Editor */}
                <div className="bg-white border-4 border-black px-6 py-5 shadow-none hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 flex flex-col justify-between h-[150px] cursor-pointer group hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-slate-100 border-2 border-black p-1.5">
                            <AlertCircle className="w-5 h-5 text-black" />
                        </div>
                        <span className="text-5xl font-black text-black tracking-tighter">{sentToEditor}</span>
                    </div>
                    <div>
                        <p className="text-slate-400 font-black uppercase text-[9px] tracking-[0.15em] mb-0.5">Phase 2: Post-Prod</p>
                        <p className="text-black font-black uppercase text-lg leading-tight">Sent to Editor</p>
                    </div>
                </div>

                {/* 6. Ready for PA Review */}
                <div className="bg-slate-900 border-4 border-black px-6 py-5 shadow-none hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 flex flex-col justify-between h-[150px] text-white cursor-pointer group hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-white/10 border-2 border-white/20 p-1.5 text-[#0085FF]">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="text-5xl font-black text-[#0085FF] tracking-tighter">{receivedFromEditor}</span>
                    </div>
                    <div>
                        <p className="text-[#0085FF] font-black uppercase text-[9px] tracking-[0.15em] mb-0.5">Phase 3: Final Stage</p>
                        <p className="font-black uppercase text-lg leading-tight">Ready for Final</p>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default PAOverview;
