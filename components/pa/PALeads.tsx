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
  Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const PALeads: React.FC<PALeadsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('WEEKLY');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

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
      } else {
        start = '2024-01-01';
        end = today.toISOString().split('T')[0];
      }

      const rawUrl = import.meta.env.VITE_LEADS_API_URL || 'http://localhost:3000/api/leads';
      const urlObj = new URL(rawUrl);
      urlObj.search = ''; 
      urlObj.searchParams.set('startDate', start);
      urlObj.searchParams.set('endDate', end);

      const response = await fetch(urlObj.toString());
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const result = await response.json();
      const leadData = result.data || (Array.isArray(result) ? result : []);
      setLeads(leadData);
      
      // Select first source by default if none selected
      if (leadData.length > 0 && !selectedSource) {
        const sources = Array.from(new Set(leadData.map((l: any) => l.source || 'Unknown'))).sort();
        setSelectedSource(sources[0] as string);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [dateFilter]);

  // Grouping logic
  const sources = Array.from(new Set(leads.map(l => l.source || 'Unknown Source'))).sort();
  
  const filteredSources = sources.filter(s => 
    s.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayLeads = leads.filter(l => 
    (l.source || 'Unknown Source') === selectedSource &&
    (l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     l.business_id?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b-4 border-black p-4 flex items-center justify-between z-10 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-50 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <Globe className="text-[#D946EF]" size={36} />
              Lead Intelligence
              <span className="ml-4 bg-black text-white text-sm px-3 py-1 rounded-full border-2 border-[#D946EF] shadow-[2px_2px_0px_0px_rgba(217,70,239,1)]">
                {leads.length} TOTAL
              </span>
            </h1>
            <p className="text-slate-500 font-bold mt-1 uppercase text-xs tracking-widest">
              Live Monitoring Sync • Real-time Data Feed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 border-2 border-black rounded p-1">
            {['TODAY', 'WEEKLY', 'OVERALL'].map(f => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1 font-black uppercase text-[10px] transition-all rounded ${
                  dateFilter === f ? 'bg-black text-white' : 'text-slate-500 hover:bg-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchLeads}
            className="p-2 bg-[#D946EF] text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Sources */}
        <div className="w-80 bg-white border-r-4 border-black flex flex-col shadow-[4px_0px_0px_0px_rgba(0,0,0,0.05)]">
          <div className="p-4 border-b-2 border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search Sources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-2 border-black font-bold text-sm focus:outline-none focus:bg-white transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-1">
            {isLoading && sources.length === 0 ? (
              <div className="p-10 text-center animate-pulse">
                <Database className="mx-auto text-slate-200 mb-2" size={32} />
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Loading...</span>
              </div>
            ) : filteredSources.map(source => {
              const count = leads.filter(l => (l.source || 'Unknown Source') === source).length;
              return (
                <button
                  key={source}
                  onClick={() => setSelectedSource(source)}
                  className={`w-full text-left p-3 border-2 transition-all flex items-center justify-between group ${
                    selectedSource === source 
                      ? 'bg-black border-black text-white shadow-[4px_4px_0px_0px_rgba(217,70,239,1)]' 
                      : 'border-transparent hover:border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-xs truncate max-w-[180px]">{source}</span>
                    <span className={`text-[9px] font-black uppercase mt-0.5 ${selectedSource === source ? 'text-[#D946EF]' : 'text-slate-400'}`}>
                      {count} {count === 1 ? 'Lead' : 'Leads'}
                    </span>
                  </div>
                  <ChevronRight size={14} className={selectedSource === source ? 'text-[#D946EF]' : 'opacity-0 group-hover:opacity-100'} />
                </button>
              );
            })}
          </div>
          
          <div className="p-4 bg-slate-50 border-t-2 border-black space-y-1">
            <div className="font-black text-[10px] uppercase text-slate-400 flex justify-between">
              <span>Total Sources</span>
              <span className="text-black">{sources.length}</span>
            </div>
            <div className="font-black text-[10px] uppercase text-slate-400 flex justify-between">
              <span>Total Leads</span>
              <span className="text-[#D946EF]">{leads.length}</span>
            </div>
          </div>
        </div>

        {/* Right Content - Table */}
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
          {selectedSource ? (
            <>
              <div className="p-6 bg-white border-b-2 border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                    {selectedSource}
                  </h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Showing {displayLeads.length} Leads from this source
                  </p>
                </div>
                <div className="bg-slate-100 px-4 py-2 border-2 border-black font-black text-xs uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {dateFilter} REPORT
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6 scrollbar-hide">
                <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-sm overflow-hidden min-w-[1200px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black text-white border-b-2 border-black">
                        <th className="p-4 uppercase font-black text-[10px] tracking-widest whitespace-nowrap">ID / Business ID</th>
                        <th className="p-4 uppercase font-black text-[10px] tracking-widest whitespace-nowrap">Lead Contact</th>
                        <th className="p-4 uppercase font-black text-[10px] tracking-widest whitespace-nowrap">Location</th>
                        <th className="p-4 uppercase font-black text-[10px] tracking-widest whitespace-nowrap">Stage & Status</th>
                        <th className="p-4 uppercase font-black text-[10px] tracking-widest whitespace-nowrap">Assigned To</th>
                        <th className="p-4 uppercase font-black text-[10px] tracking-widest whitespace-nowrap">Financials</th>
                        <th className="p-4 uppercase font-black text-[10px] tracking-widest whitespace-nowrap">Created At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-100">
                      {displayLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-[#D946EF]">{lead.business_id || 'NO-ID'}</span>
                              <span className="text-[9px] font-bold text-slate-300 truncate w-24 uppercase">{lead.id.split('-')[0]}...</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-900">{lead.name}</span>
                              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Mail size={10} /> {lead.email}</span>
                              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Phone size={10} /> {lead.phone}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase">
                              <MapPin size={14} className="text-red-500" />
                              {lead.city}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded w-fit">
                                {lead.current_stage}
                              </span>
                              <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded w-fit border border-slate-200">
                                {lead.status}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-slate-200 rounded flex items-center justify-center font-black text-xs text-slate-500">
                                {lead.assigned_to?.charAt(0) || '?'}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-800">{lead.assigned_to || 'Unassigned'}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Partner Lead</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 text-[#059669] font-black text-xs">
                                <DollarSign size={12} />
                                {lead.incentives || 0} INC
                              </div>
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border w-fit ${lead.subscribed === 'yes' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                Sub: {lead.subscribed}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase">Paid: {lead.influencer_paid_status}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-black text-slate-700">
                                {new Date(lead.created_at).toLocaleDateString()}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase">
                                {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <Database size={64} className="mb-4 animate-bounce" />
              <h3 className="text-2xl font-black uppercase">Select a Source</h3>
              <p className="font-bold text-sm">Choose a campaign from the left sidebar to view leads</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PALeads;
