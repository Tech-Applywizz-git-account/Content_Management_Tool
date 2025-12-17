import React, { useState, useEffect } from 'react';
import { User, Project, OBSERVER_TITLES } from '../../types';
import { BarChart3, Users, Calendar, FileText, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';

interface ObserverDashboardProps {
    user: User;
    onLogout: () => void;
}

const ObserverDashboard: React.FC<ObserverDashboardProps> = ({ user, onLogout }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<'overview' | 'projects' | 'approvals' | 'calendar'>('overview');
    const [projectFilter, setProjectFilter] = useState<'all' | 'pending' | 'approved' | 'inProduction' | 'posted'>('all');

    useEffect(() => {
        loadData();
    }, []);

    // Realtime: reload projects when projects table changes
    useEffect(() => {
        const subscription = supabase
            .channel('public:projects:observer_refresh')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                loadData();
            })
            .subscribe();

        return () => { try { supabase.removeChannel(subscription); } catch (e) {} };
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const allProjects = await db.projects.getAll();
            setProjects(allProjects);
        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            setLoading(false);
        }
    };

    // Get personalized title and message
    const jobTitle = user.job_title || 'EXECUTIVE';
    const fullTitle = OBSERVER_TITLES[jobTitle] || jobTitle;

    const getIcon = () => {
        if (jobTitle === 'COO') return '👔';
        if (jobTitle === 'CRO') return '💰';
        if (jobTitle === 'CTO') return '💻';
        if (jobTitle === 'CFO') return '📊';
        if (jobTitle === 'BOARD') return '🎯';
        return '👁️';
    };

    const getWelcomeMessage = () => {
        if (jobTitle === 'COO') return 'Track operational efficiency across all content workflows';
        if (jobTitle === 'CRO') return 'Monitor content impact on revenue and lead generation';
        if (jobTitle === 'CTO') return 'Review technical content and product announcements';
        if (jobTitle === 'CFO') return 'Oversee content investment and resource allocation';
        if (jobTitle === 'BOARD') return 'Executive overview of content pipeline and performance';
        return 'Complete visibility into content creation pipeline';
    };

    // Calculate stats
    const stats = {
        pending: projects.filter(p => p.status === 'WAITING_APPROVAL').length,
        approved: projects.filter(p => p.status === 'DONE' && p.created_at.includes(new Date().toISOString().split('T')[0].slice(0, 7))).length,
        inProduction: projects.filter(p => p.status === 'IN_PROGRESS').length,
        posted: projects.filter(p => p.current_stage === 'POSTED').length,
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b-2 border-black shadow-[0_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-purple-600 border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-2xl">
                            {getIcon()}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight">
                                {jobTitle} - Executive Dashboard
                            </h1>
                            <p className="text-sm text-slate-600 font-medium">Content Pipeline Overview</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="text-right">
                            <p className="text-sm font-bold text-slate-900">{user.full_name}</p>
                            <p className="text-xs text-slate-500">{fullTitle}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Logout button clicked in ObserverDashboard');
                            onLogout();
                          }}
                          className="px-6 py-2 bg-black text-white border-2 border-black font-bold uppercase text-sm hover:bg-slate-800 transition-colors shadow-[4px_4px_0px_0px_rgba(100,100,100,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(100,100,100,1)]"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 border-b-2 border-black">
                <div className="max-w-7xl mx-auto px-6 py-8 text-white">
                    <h2 className="text-3xl font-black uppercase mb-2">
                        Welcome back, {user.full_name.split(' ')[0]}! 👋
                    </h2>
                    <p className="text-purple-100 font-medium text-lg">{getWelcomeMessage()}</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Navigation Tabs */}
                <div className="flex space-x-2 mb-8">
                    <button
                        onClick={() => setCurrentView('overview')}
                        className={`px-6 py-3 font-bold uppercase text-sm border-2 border-black transition-all ${currentView === 'overview'
                            ? 'bg-purple-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-white text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        📊 Overview
                    </button>
                    <button
                        onClick={() => setCurrentView('projects')}
                        className={`px-6 py-3 font-bold uppercase text-sm border-2 border-black transition-all ${currentView === 'projects'
                            ? 'bg-purple-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-white text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        🗂️ All Projects
                    </button>
                    <button
                        onClick={() => setCurrentView('approvals')}
                        className={`px-6 py-3 font-bold uppercase text-sm border-2 border-black transition-all ${currentView === 'approvals'
                            ? 'bg-purple-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-white text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        ✅ Approvals
                    </button>
                    <button
                        onClick={() => setCurrentView('calendar')}
                        className={`px-6 py-3 font-bold uppercase text-sm border-2 border-black transition-all ${currentView === 'calendar'
                            ? 'bg-purple-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-white text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        📅 Calendar
                    </button>
                </div>

                {/* Overview Stats */}
                {currentView === 'overview' && (
                    <div>
                        <h3 className="text-xl font-black uppercase mb-6">📈 Quick Insights</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <button
                                onClick={() => {
                                    setProjectFilter('pending');
                                    setCurrentView('projects');
                                }}
                                className="bg-amber-400 border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-left w-full"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <Clock className="w-8 h-8 text-black" />
                                    <span className="text-4xl font-black text-black">{stats.pending}</span>
                                </div>
                                <p className="text-black font-bold uppercase text-sm">Pending Review</p>
                            </button>

                            <button
                                onClick={() => {
                                    setProjectFilter('approved');
                                    setCurrentView('projects');
                                }}
                                className="bg-green-400 border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-left w-full"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <CheckCircle className="w-8 h-8 text-black" />
                                    <span className="text-4xl font-black text-black">{stats.approved}</span>
                                </div>
                                <p className="text-black font-bold uppercase text-sm">Approved Today</p>
                            </button>

                            <button
                                onClick={() => {
                                    setProjectFilter('inProduction');
                                    setCurrentView('projects');
                                }}
                                className="bg-blue-400 border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-left w-full"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <TrendingUp className="w-8 h-8 text-black" />
                                    <span className="text-4xl font-black text-black">{stats.inProduction}</span>
                                </div>
                                <p className="text-black font-bold uppercase text-sm">In Production</p>
                            </button>

                            <button
                                onClick={() => {
                                    setProjectFilter('posted');
                                    setCurrentView('projects');
                                }}
                                className="bg-purple-400 border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-left w-full"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <BarChart3 className="w-8 h-8 text-black" />
                                    <span className="text-4xl font-black text-black">{stats.posted}</span>
                                </div>
                                <p className="text-black font-bold uppercase text-sm">Posted This Week</p>
                            </button>
                        </div>

                        {/* Recent Activity */}
                        <h3 className="text-xl font-black uppercase mb-6">🔔 Recent Activity</h3>
                        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="space-y-4">
                                {projects.slice(0, 5).map((project) => (
                                    <div key={project.id} className="flex items-center justify-between border-b border-slate-200 pb-4 last:border-0">
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-900">{project.title}</h4>
                                            <p className="text-sm text-slate-600">
                                                {project.channel} • {project.current_stage}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-bold uppercase ${project.status === 'DONE' ? 'bg-green-200 text-green-800' :
                                            project.status === 'IN_PROGRESS' ? 'bg-blue-200 text-blue-800' :
                                                project.status === 'WAITING_APPROVAL' ? 'bg-amber-200 text-amber-800' :
                                                    'bg-slate-200 text-slate-800'
                                            }`}>
                                            {project.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* All Projects View */}
                {currentView === 'projects' && (() => {
                    const filteredProjects = projectFilter === 'all' ? projects :
                        projectFilter === 'pending' ? projects.filter(p => p.status === 'WAITING_APPROVAL') :
                            projectFilter === 'approved' ? projects.filter(p => p.status === 'DONE' && p.created_at.includes(new Date().toISOString().split('T')[0].slice(0, 7))) :
                                projectFilter === 'inProduction' ? projects.filter(p => p.status === 'IN_PROGRESS') :
                                    projects.filter(p => p.current_stage === 'POSTED');

                    const filterTitle = projectFilter === 'all' ? 'All Projects' :
                        projectFilter === 'pending' ? 'Pending Review' :
                            projectFilter === 'approved' ? 'Approved Today' :
                                projectFilter === 'inProduction' ? 'In Production' :
                                    'Posted This Week';

                    return (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black uppercase">🗂️ {filterTitle} ({filteredProjects.length})</h3>
                                {projectFilter !== 'all' && (
                                    <button
                                        onClick={() => setProjectFilter('all')}
                                        className="px-4 py-2 bg-slate-900 text-white border-2 border-black font-bold uppercase text-sm hover:bg-slate-700 transition-colors"
                                    >
                                        Show All
                                    </button>
                                )}
                            </div>
                            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-100 border-b-2 border-black">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold uppercase text-sm">Title</th>
                                                <th className="px-4 py-3 text-left font-bold uppercase text-sm">Channel</th>
                                                <th className="px-4 py-3 text-left font-bold uppercase text-sm">Stage</th>
                                                <th className="px-4 py-3 text-left font-bold uppercase text-sm">Status</th>
                                                <th className="px-4 py-3 text-left font-bold uppercase text-sm">Due Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredProjects.map((project, idx) => (
                                                <tr key={project.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                    <td className="px-4 py-3 font-medium">{project.title}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 text-xs font-bold bg-purple-100 text-purple-800 rounded">
                                                            {project.channel}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">{project.current_stage}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 text-xs font-bold rounded ${project.status === 'DONE' ? 'bg-green-100 text-green-800' :
                                                            project.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                                                project.status === 'WAITING_APPROVAL' ? 'bg-amber-100 text-amber-800' :
                                                                    'bg-slate-100 text-slate-800'
                                                            }`}>
                                                            {project.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        {new Date(project.due_date).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Approvals View */}
                {currentView === 'approvals' && (
                    <div>
                        <h3 className="text-xl font-black uppercase mb-6">✅ Approval History</h3>
                        <div className="space-y-4">
                            {projects.filter(p => p.status === 'WAITING_APPROVAL' || p.status === 'DONE').map((project) => (
                                <div key={project.id} className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-lg">{project.title}</h4>
                                            <p className="text-sm text-slate-600">
                                                {project.channel} • Stage: {project.current_stage}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-3 py-1 text-sm font-bold rounded ${project.status === 'DONE' ? 'bg-green-400 text-black' :
                                                'bg-amber-400 text-black'
                                                }`}>
                                                {project.status === 'DONE' ? '✓ Approved' : '⏳ Pending'}
                                            </span>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Due: {new Date(project.due_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {projects.filter(p => p.status === 'WAITING_APPROVAL' || p.status === 'DONE').length === 0 && (
                                <div className="bg-slate-100 border-2 border-black p-8 text-center">
                                    <p className="text-slate-600">No approval history yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Publishing Calendar View */}
                {currentView === 'calendar' && (
                    <div>
                        <h3 className="text-xl font-black uppercase mb-6">📅 Publishing Calendar</h3>
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mb-6">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="bg-slate-900 text-white text-center py-2 font-bold uppercase text-sm border-2 border-black">
                                    {day}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                            {Array.from({ length: 28 }, (_, i) => {
                                const date = new Date();
                                date.setDate(date.getDate() - date.getDay() + i);
                                const dateStr = date.toISOString().split('T')[0];
                                const dayProjects = projects.filter(p =>
                                    p.due_date.split('T')[0] === dateStr ||
                                    (p.post_scheduled_date && p.post_scheduled_date.split('T')[0] === dateStr)
                                );
                                const isToday = new Date().toDateString() === date.toDateString();

                                return (
                                    <div
                                        key={i}
                                        className={`min-h-24 p-2 border-2 border-black ${isToday ? 'bg-purple-100 border-purple-600' : 'bg-white'
                                            }`}
                                    >
                                        <div className={`font-bold text-sm mb-1 ${isToday ? 'text-purple-800' : ''}`}>
                                            {date.getDate()}
                                            {isToday && <span className="ml-1 text-xs">(Today)</span>}
                                        </div>
                                        {dayProjects.map(p => (
                                            <div
                                                key={p.id}
                                                className={`text-xs p-1 mb-1 rounded truncate ${p.channel === 'INSTAGRAM' ? 'bg-pink-200 text-pink-800' :
                                                    p.channel === 'YOUTUBE' ? 'bg-red-200 text-red-800' :
                                                        'bg-blue-200 text-blue-800'
                                                    }`}
                                                title={p.title}
                                            >
                                                {p.title.substring(0, 15)}...
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-6 flex gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-pink-200 border border-pink-400"></div>
                                <span className="text-sm font-medium">Instagram</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-red-200 border border-red-400"></div>
                                <span className="text-sm font-medium">YouTube</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-blue-200 border border-blue-400"></div>
                                <span className="text-sm font-medium">LinkedIn</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ObserverDashboard;
