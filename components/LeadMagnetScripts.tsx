import React, { useState, useEffect } from 'react';
import { Project, Role, Channel, TaskStatus } from '../types';
import { db } from '../services/supabaseDb';
import { format } from 'date-fns';
import { FileText, Clock, ExternalLink, Search } from 'lucide-react';

interface Props {
    user: { id: string; role: Role };
    projects: Project[];
    onSelectProject: (project: Project) => void;
}

const LeadMagnetScripts: React.FC<Props> = ({ user, projects, onSelectProject }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const leadMagnetProjects = projects.filter(p =>
        p.channel === Channel.LEAD_MAGNET &&
        (searchTerm === '' || p.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black uppercase text-slate-900 flex items-center gap-2">
                        <FileText className="w-8 h-8 text-[#6366F1]" />
                        Lead Magnet Scripts
                    </h2>
                    <p className="text-slate-600 font-medium">
                        Manage all your Lead Magnet content scripts and assets
                    </p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border-2 border-black focus:outline-none focus:ring-0 focus:border-[#6366F1] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leadMagnetProjects.length === 0 ? (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-300 bg-slate-50">
                        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-black uppercase text-slate-400">No Lead Magnet scripts found</h3>
                        <p className="text-slate-500">Try creating a new project with the Lead Magnet channel</p>
                    </div>
                ) : (
                    leadMagnetProjects.map(project => (
                        <div
                            key={project.id}
                            onClick={() => onSelectProject(project)}
                            className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className="px-2 py-1 text-[10px] font-black uppercase border-2 border-black bg-[#6366F1] text-white">
                                    {project.channel}
                                </span>
                                <span className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH' ? 'bg-red-500 text-white' :
                                    project.priority === 'NORMAL' ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'
                                    }`}>
                                    {project.priority}
                                </span>
                            </div>

                            <h3 className="text-xl font-black uppercase text-slate-900 group-hover:text-[#6366F1] transition-colors line-clamp-2">
                                {project.title}
                            </h3>

                            <div className="mt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-bold text-slate-500 uppercase text-xs">Status</span>
                                    <span className={`font-black uppercase text-xs ${project.status === TaskStatus.DONE ? 'text-green-600' :
                                        project.status === TaskStatus.REWORK ? 'text-red-600' : 'text-[#6366F1]'
                                        }`}>
                                        {project.status.replace(/_/g, ' ')}
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="font-bold text-slate-500 uppercase text-xs">Stage</span>
                                    <span className="font-bold text-slate-900 text-xs">
                                        {project.current_stage.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t-2 border-slate-100 flex items-center justify-between">
                                <div className="flex items-center text-xs font-bold text-slate-400 uppercase">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {format(new Date(project.created_at), 'MMM dd, yyyy')}
                                </div>
                                <button className="bg-black text-white p-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(100,100,100,1)] group-hover:bg-[#6366F1] transition-all">
                                    <ExternalLink className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default LeadMagnetScripts;
