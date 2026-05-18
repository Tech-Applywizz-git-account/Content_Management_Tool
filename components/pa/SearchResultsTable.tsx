import React from 'react';
import { Search, X, Building2, Users, DollarSign, ArrowRight, Tag, Activity, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import InfluencerRow from './InfluencerRow';

export interface InfluencerSearchRow {
  id: string;
  influencer_name: string;
  instagram_handle: string;
  influencer_email: string;
  total_budget: string;
  brands: string[];
  profile_initial: string;
  profile_color: string;
  primary_brand: string;
  influencer_links: Array<{ link: string }>;
  niche?: string;
  location?: string;
  contact_details?: string;
  total_leads?: number;
}

interface SearchResultsTableProps {
  rows: InfluencerSearchRow[];
  searchQuery: string;
  isLoading: boolean;
  resultsLabel: string;
  onClearSearch: () => void;
  openPopoverId: string | null;
  onTogglePopover: (id: string) => void;
  onSelectBrand: (brandName: string, rowId: string) => void;
  onViewDetails: (row: InfluencerSearchRow) => void;
  expandedRowId?: string | null;
  expandedBrandData?: any | null;
  onCloseExpanded?: () => void;
  userRole?: string;
}

const SearchResultsTable: React.FC<SearchResultsTableProps> = ({
  rows,
  searchQuery,
  isLoading,
  resultsLabel,
  onClearSearch,
  openPopoverId,
  onTogglePopover,
  onSelectBrand,
  onViewDetails,
  expandedRowId,
  expandedBrandData,
  onCloseExpanded,
  userRole,
}) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="sticky top-4 z-30 rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-sm shadow-slate-200/60 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Search</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{resultsLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">{rows.length} result{rows.length === 1 ? '' : 's'} for “{searchQuery}”.</p>
          </div>

          <button
            type="button"
            onClick={onClearSearch}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
            Clear Search
          </button>
        </div>
      </div>

      <div className="overflow-visible rounded-[1.75rem] border border-slate-200 bg-slate-50 shadow-[0_22px_80px_-40px_rgba(15,23,42,0.25)]">
        <div className="divide-y divide-slate-200">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="animate-pulse px-5 py-6 md:px-6">
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-[2fr_2fr_1.5fr_1fr_1fr]">
                  <div className="h-16 rounded-[1.5rem] bg-slate-200" />
                  <div className="h-16 rounded-[1.5rem] bg-slate-200" />
                  <div className="h-16 rounded-[1.5rem] bg-slate-200" />
                  <div className="h-16 rounded-[1.5rem] bg-slate-200" />
                  <div className="h-16 rounded-[1.5rem] bg-slate-200" />
                </div>
              </div>
            ))
          ) : rows.length > 0 ? (
            rows.map((row) => (
              <React.Fragment key={row.id}>
                <InfluencerRow
                  row={row}
                  isOpen={openPopoverId === row.id}
                  onTogglePopover={() => onTogglePopover(row.id)}
                  onSelectBrand={onSelectBrand}
                  onViewDetails={() => onViewDetails(row)}
                />
                {expandedRowId === row.id && expandedBrandData && (
                  <div className="bg-slate-50 border-t border-slate-200 p-6 animate-in slide-in-from-top-2 fade-in duration-300 relative">
                    {expandedBrandData._loading && (
                      <div className="flex flex-col gap-3 animate-pulse">
                        <div className="h-5 w-40 bg-slate-200 rounded-xl" />
                        <div className="grid grid-cols-5 gap-4">
                          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-200 rounded-2xl" />)}
                        </div>
                      </div>
                    )}
                    {!expandedBrandData._loading && (<>
                    <button 
                      onClick={onCloseExpanded}
                      className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 bg-white rounded-full border border-slate-200 transition-all shadow-sm hover:shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-white rounded-2xl border-2 border-indigo-100 flex items-center justify-center shadow-sm">
                        <Building2 className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black uppercase tracking-tight text-slate-900">{expandedBrandData.brand_name}</h4>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{expandedBrandData.campaign_name}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Niche & Collab</p>
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="text-sm font-black text-slate-900 truncate" title={`${expandedBrandData.niche} • ${expandedBrandData.collab_type}`}>{expandedBrandData.niche} • {expandedBrandData.collab_type}</span>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Budget</p>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="text-lg font-black text-slate-900 truncate">{expandedBrandData.influencer_budget}</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Leads Generated</p>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-xl font-black text-slate-900">{expandedBrandData.influencer_brand_leads}</span>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm md:col-span-2 flex flex-col justify-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Latest Action</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-500 shrink-0" />
                            <span className="text-sm font-black text-slate-900 truncate">{expandedBrandData.latest_action}</span>
                          </div>
                          {expandedBrandData.proof_link && (
                            <a
                              href={expandedBrandData.proof_link.startsWith('http') ? expandedBrandData.proof_link : `https://${expandedBrandData.proof_link}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-colors shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View Proof
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                           const rolePath = userRole === 'SUB_EDITOR' ? 'sub_editor' : (userRole || 'partner_associate').toLowerCase();
                           navigate(`/${rolePath}/brand-details/${encodeURIComponent(expandedBrandData.brand_name)}`);
                        }}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5"
                      >
                        View Full Details
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    </>)}
                  </div>
                )}
              </React.Fragment>
            ))
          ) : (
            <div className="px-5 py-16 text-center sm:px-6">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">No results found</p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-900">Try a broader query or adjust filters</h3>
              <p className="mt-2 text-sm text-slate-500">Search influencer names, Instagram handles, budgets, or brand names.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchResultsTable;
