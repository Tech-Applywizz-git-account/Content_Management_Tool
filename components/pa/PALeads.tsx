import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { 
  Search, 
  Globe, 
  Mail, 
  MapPin, 
  Tag, 
  ArrowLeft, 
  Users, 
  RefreshCw,
  Phone,
  Briefcase,
  Calendar,
  DollarSign,
  ChevronRight,
  Database,
  CheckCircle2,
  Clock,
  Target,
  MessageSquare,
  PhoneOff,
  MinusCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  source: string;
  status: string;
  assigned_to: string;
  created_at: string;
  current_stage: string;
  business_id: string;
  incentives: number;
  subscribed: string;
  influencer_paid_status: string;
}

interface PALeadsProps {
  user: User;
}

function getSourceFilterForBrand(decodedBrandName: string): ((source: string) => boolean) | null {
  const brand = decodedBrandName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Job Board (check before generic ApplyWizz so "aw job board" routes correctly)
  if (brand.includes('jobboard')) {
    return (source: string) => {
      const s = source.toLowerCase();
      return s.includes('jobboard') || s.includes('job board');
    };
  }

  // Lead Magnet / RTW
  if (brand.includes('leadmagnet') || brand.includes('rtw')) {
    return (source: string) => {
      const s = source.toLowerCase();
      return s.includes('rtw') || s.includes('lead magnet') || s.includes('leadmagnet') || 
             s.includes('digital resume') || s.includes('resume') || s.includes('resunme');
    };
  }

  // CareerIdentifier
  if (brand.includes('careeridentifier') || brand.includes('careridentifier') || brand.includes('cir')) {
    return (source: string) => {
      const s = source.toLowerCase();
      return s.includes('cir') || s.includes('career identifier') || s.includes('careeridentifier');
    };
  }

  if (brand.includes('applywizz') || brand === 'aw') {
    return (source: string) => {
      const s = source.toLowerCase();
      return s.includes('aw') || s.includes('applywizz') || s.includes('apply wizz');
    };
  }

  return null;
}

const PALeads: React.FC<PALeadsProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const brandFilter = location.state?.brandFilter as string | undefined;
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('OVERALL');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      let start, end;

      if (dateFilter === 'TODAY') {
        start = end = today.toISOString().split('T')[0];
      } else if (dateFilter === 'WEEKLY') {
        const sun = new Date(today);
        sun.setDate(today.getDate() - today.getDay());
        start = sun.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
      } else if (dateFilter === 'MONTHLY') {
        const firstDay = new Date(today.getFullYear(), selectedMonth, 1);
        const lastDay = new Date(today.getFullYear(), selectedMonth + 1, 0);
        start = firstDay.toISOString().split('T')[0];
        end = lastDay.toISOString().split('T')[0];
      } else if (dateFilter === 'CUSTOM') {
        start = customRange.start || '2024-01-01';
        end = customRange.end || today.toISOString().split('T')[0];
      } else {
        start = '2024-01-01';
        end = today.toISOString().split('T')[0];
      }

      const rawUrl = import.meta.env.VITE_LEADS_API_URL || 'http://localhost:3000/api/leads';
      const urlObj = new URL(rawUrl);
      urlObj.searchParams.set('startDate', start);
      urlObj.searchParams.set('endDate', end);
      urlObj.searchParams.set('limit', '20000');

      const response = await fetch(urlObj.toString());
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const result = await response.json();
      const rawLeads = result.data || (Array.isArray(result) ? result : []);
      
      // Filter leads if specific brand context exists
      let leadData = rawLeads;
      if (brandFilter && brandFilter !== 'ALL') {
        const sourceFilter = getSourceFilterForBrand(brandFilter);
        if (sourceFilter) {
          leadData = rawLeads.filter((l: any) => sourceFilter(l.source || ''));
        }
      }
      
      setLeads(leadData);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [dateFilter, selectedMonth, customRange.start, customRange.end]);

  // Grouping logic
  const sources = Array.from(new Set(leads.map(l => l.source || 'Unknown Source'))).sort();
  
  const filteredSources = sources.filter(s => 
    s.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStageColor = (stage: string) => {
    const s = stage?.toLowerCase() || '';
    if (s.includes('sale done')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s.includes('target')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (s.includes('conversation done')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s.includes('dnp')) return 'bg-red-100 text-red-700 border-red-200';
    if (s.includes('out of tg')) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (s.includes('prospect')) return 'bg-slate-50 text-slate-500 border-slate-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'new') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (s === 'assigned') return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-slate-50 text-slate-500 border-slate-200';
  };

  const sourceLeads = leads.filter(l => 
    (selectedSource === null || (l.source || 'Unknown Source') === selectedSource)
  );

  const displayLeads = sourceLeads.filter(l => 
    (selectedStage === null || l.current_stage?.toLowerCase().includes(selectedStage.toLowerCase())) &&
    (l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     l.business_id?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-screen bg-[#F1F5F9] flex flex-col overflow-hidden font-sans">
      {/* Top Header - Clean & Professional */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate(-1)}
            className="group p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-all duration-200"
          >
            <ArrowLeft size={20} className="text-slate-600 group-hover:text-black" />
          </button>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-[#D946EF] to-[#8B5CF6] rounded-lg shadow-md">
                <Globe className="text-white" size={24} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
                  Lead <span className="text-[#D946EF]">Details</span>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <p className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">
                    Real-time Data Stream • {brandFilter || 'Global View'} • {leads.length} Records
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Custom Date Inputs */}
          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-2 animate-slide-up">
              <input 
                type="date" 
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-[#D946EF]/20 outline-none"
              />
              <span className="text-slate-400 text-[10px] font-bold">TO</span>
              <input 
                type="date" 
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-[#D946EF]/20 outline-none"
              />
            </div>
          )}

          {/* Month Selector */}
          {dateFilter === 'MONTHLY' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider focus:ring-2 focus:ring-[#D946EF]/20 outline-none animate-slide-up"
            >
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          )}

          {/* Date Selector Toggles */}
          <div className="flex bg-slate-100/50 border border-slate-200 rounded-lg p-1">
            {['TODAY', 'WEEKLY', 'MONTHLY', 'CUSTOM', 'OVERALL'].map(f => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-4 py-1.5 font-bold uppercase text-[10px] transition-all rounded-md ${
                  dateFilter === f 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-slate-200 mx-1"></div>

          <button 
            onClick={fetchLeads}
            disabled={isLoading}
            className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:text-[#D946EF] transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw size={18} className={`${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Clean & Minimal */}
        <div className="w-60 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm">
          <div className="p-5 border-b border-slate-100 bg-white">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search Sources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D946EF]/20 focus:border-[#D946EF] transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-1">
            {isLoading && sources.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <Database className="mx-auto text-slate-200 animate-pulse" size={40} />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading Feed...</p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setSelectedSource(null)}
                  className={`w-full text-left p-3.5 rounded-lg transition-all flex items-center justify-between group ${
                    selectedSource === null 
                      ? 'bg-[#D946EF]/10 text-[#D946EF] shadow-sm border border-[#D946EF]/20' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users size={16} className={selectedSource === null ? 'text-[#D946EF]' : 'text-slate-400'} />
                    <span className="font-bold text-sm">All Sources</span>
                  </div>
                  <span className={`text-[10px] font-bold ${selectedSource === null ? 'text-[#D946EF]/70' : 'text-slate-300'}`}>
                    {leads.length}
                  </span>
                </button>
                
                <div className="pt-4 pb-2 px-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Campaigns</span>
                </div>

                {filteredSources.map((source, idx) => {
                  const count = leads.filter(l => (l.source || 'Unknown Source') === source).length;
                  return (
                    <button
                      key={source}
                      onClick={() => setSelectedSource(source)}
                      className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between group animate-slide-up ${
                        selectedSource === source 
                          ? 'bg-[#D946EF]/10 text-[#D946EF] shadow-sm border border-[#D946EF]/20' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Database size={14} className={selectedSource === source ? 'text-[#D946EF]' : 'text-slate-400'} />
                        <span className="font-semibold text-sm truncate max-w-[140px]">{source}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${selectedSource === source ? 'text-[#D946EF]/70' : 'text-slate-300'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
          
          <div className="p-5 bg-slate-50 border-t border-slate-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sources</span>
                <span className="text-xs font-bold text-slate-900">{sources.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Leads</span>
                <span className="text-sm font-bold text-[#D946EF]">{leads.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content - Table & Stats */}
        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden p-6">
          {leads.length > 0 || isLoading ? (
            <div className="flex flex-col h-full space-y-6">
              <div className="flex items-end justify-between px-2">
                <div className="animate-slide-up">
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                    {selectedSource || 'All Brand Activity'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#D946EF] rounded-full"></span>
                    Analyzing {displayLeads.length} of {sourceLeads.length} leads in the current feed
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-4 animate-slide-up">
                {[
                  { label: 'Total Leads', stage: 'ALL', color: 'indigo', icon: Users, iconColor: 'text-indigo-500' },
                  { label: 'Prospect', stage: 'Prospect', color: 'slate', icon: Search, iconColor: 'text-violet-500' },
                  { label: 'Target', stage: 'Target', color: 'blue', icon: Target, iconColor: 'text-blue-500' },
                  { label: 'DNP', stage: 'DNP', color: 'red', icon: PhoneOff, iconColor: 'text-red-500' },
                  { label: 'Conversation Done', stage: 'Conversation Done', color: 'amber', icon: MessageSquare, iconColor: 'text-amber-500' },
                  { label: 'Out of TG', stage: 'Out of TG', color: 'zinc', icon: MinusCircle, iconColor: 'text-slate-500' },
                  { label: 'Sale Done', stage: 'Sale Done', color: 'emerald', icon: CheckCircle2, iconColor: 'text-emerald-500' }
                ].map((kpi, i) => {
                  const count = kpi.stage === 'ALL' 
                    ? leads.filter(l => (selectedSource === null || (l.source || 'Unknown Source') === selectedSource)).length
                    : leads.filter(l => 
                        (selectedSource === null || (l.source || 'Unknown Source') === selectedSource) &&
                        l.current_stage?.toLowerCase().includes(kpi.stage.toLowerCase())
                      ).length;
                  
                  const isActive = kpi.stage === 'ALL' ? selectedStage === null : selectedStage === kpi.stage;

                  return (
                    <button 
                      key={i} 
                      onClick={() => setSelectedStage(kpi.stage === 'ALL' ? null : (isActive ? null : kpi.stage))}
                      className={`text-left border transition-all flex flex-col gap-1.5 p-3 rounded-xl group relative overflow-hidden ${
                        isActive 
                          ? 'bg-[#D946EF]/5 border-[#D946EF] shadow-sm' 
                          : 'bg-white border-slate-200 hover:border-[#D946EF]/20'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <kpi.icon size={12} className={isActive ? 'text-[#D946EF]' : kpi.iconColor} />
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${isActive ? 'text-[#D946EF]' : 'text-slate-400 group-hover:text-slate-600'}`}>
                          {kpi.label}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className={`text-xl font-bold ${isActive ? 'text-slate-900' : 'text-slate-900'}`}>{count}</span>
                      </div>
                      {isActive && <div className="absolute top-0 left-0 w-full h-1 bg-[#D946EF]"></div>}
                    </button>
                  );
                })}
              </div>

              {/* Enhanced Data Table */}
              <div className="flex-1 overflow-hidden flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm animate-slide-up">
                <div className="overflow-auto scrollbar-hide flex-1 border border-slate-200 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider w-[5%] text-center">S.No</th>
                        <th className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider w-[12%]">AWL-id</th>
                        <th className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider w-[22%]">Contact Details</th>
                        <th className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider w-[15%]">Location</th>
                        <th className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider w-[18%]">Status & Stage</th>
                        <th className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider w-[15%]">Assignment</th>
                        <th className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider w-[13%] text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoading ? 
                        [...Array(8)].map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="py-4 px-4"><div className="h-3 bg-slate-100 rounded w-4 mx-auto"></div></td>
                            <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                            <td className="py-4 px-4">
                              <div className="space-y-2">
                                <div className="h-4 bg-slate-100 rounded w-32"></div>
                                <div className="h-3 bg-slate-100 rounded w-24"></div>
                              </div>
                            </td>
                            <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                            <td className="py-4 px-4">
                              <div className="space-y-2">
                                <div className="h-3 bg-slate-100 rounded w-12"></div>
                                <div className="h-3 bg-slate-100 rounded w-14"></div>
                              </div>
                            </td>
                            <td className="py-4 px-4"><div className="h-6 bg-slate-100 rounded-full w-24"></div></td>
                            <td className="py-4 px-4 text-right"><div className="h-4 bg-slate-100 rounded w-20 ml-auto"></div></td>
                          </tr>
                        ))
                      : 
                        displayLeads.map((lead, idx) => (
                        <tr key={lead.id} className="hover:bg-slate-50 transition-colors group cursor-pointer border-b border-slate-50">
                          <td className="py-3 px-4 text-center text-[11px] font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-[11px] font-bold text-[#D946EF] truncate">
                                {lead.business_id || 'REF-' + idx}
                              </span>
                              {!selectedSource && (
                                <span className="text-[9px] text-slate-400 font-medium truncate">
                                  {lead.source}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-[12px] font-bold text-slate-900 truncate">{lead.name || 'Anonymous'}</span>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-medium overflow-hidden">
                                <span className="truncate">{lead.email}</span>
                                <span className="text-slate-200 shrink-0">|</span>
                                <span className="shrink-0">{lead.phone}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-slate-600 text-[11px] font-medium overflow-hidden">
                              <MapPin size={11} className="text-red-600 shrink-0" />
                              <span className="truncate">{lead.city || 'Remote'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1.5">
                              <div className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border w-fit ${getStatusColor(lead.status)}`}>
                                {lead.status}
                              </div>
                              <div className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border w-fit ${getStageColor(lead.current_stage)}`}>
                                {lead.current_stage}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-7 h-7 bg-slate-100 rounded flex items-center justify-center font-bold text-[10px] text-slate-600 shrink-0">
                                {lead.assigned_to?.charAt(0) || <Users size={12} />}
                              </div>
                              <span className="text-[11px] font-semibold text-slate-700 truncate">{lead.assigned_to || 'Unassigned'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="text-[11px] font-bold text-slate-600">
                              {new Date(lead.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              <span className="mx-1 text-slate-300">|</span>
                              {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          </td>
                        </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="flex gap-4">
                    <button className="hover:text-slate-900 transition-colors">Export CSV</button>
                    <button className="hover:text-slate-900 transition-colors">Export PDF</button>
                  </div>
                  <span>Showing {displayLeads.length} of {sourceLeads.length} records</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-slide-up">
              <div className="bg-white border border-slate-200 p-12 rounded-3xl shadow-sm text-center">
                <Database size={64} className="text-slate-200 mb-4 mx-auto" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Leads to Display</h3>
                <p className="text-sm text-slate-400 max-w-[240px] mx-auto">
                  Adjust your date filter or select a source to start analyzing leads
                </p>
              </div>
              <button 
                onClick={() => setDateFilter('OVERALL')}
                className="px-6 py-2.5 bg-[#D946EF] text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
              >
                Show All Leads
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PALeads;
