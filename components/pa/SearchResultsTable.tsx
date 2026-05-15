import React from 'react';
import { Search, X } from 'lucide-react';
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
}

interface SearchResultsTableProps {
  rows: InfluencerSearchRow[];
  searchQuery: string;
  isLoading: boolean;
  resultsLabel: string;
  onClearSearch: () => void;
  openPopoverId: string | null;
  onTogglePopover: (id: string) => void;
  onSelectBrand: (brandName: string) => void;
  onViewDetails: (row: InfluencerSearchRow) => void;
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
}) => {
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
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-[2fr_2fr_1.5fr_1fr]">
                  <div className="h-16 rounded-[1.5rem] bg-slate-200" />
                  <div className="h-16 rounded-[1.5rem] bg-slate-200" />
                  <div className="h-16 rounded-[1.5rem] bg-slate-200" />
                  <div className="h-16 rounded-[1.5rem] bg-slate-200" />
                </div>
              </div>
            ))
          ) : rows.length > 0 ? (
            rows.map((row) => (
              <InfluencerRow
                key={row.id}
                row={row}
                isOpen={openPopoverId === row.id}
                onTogglePopover={() => onTogglePopover(row.id)}
                onSelectBrand={onSelectBrand}
                onViewDetails={() => onViewDetails(row)}
              />
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
