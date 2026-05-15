import React from 'react';
import { Eye, Instagram, DollarSign, ChevronDown, ArrowRight } from 'lucide-react';
import BrandPopover from './BrandPopover';
import type { InfluencerSearchRow } from './SearchResultsTable';

interface InfluencerRowProps {
  row: InfluencerSearchRow;
  isOpen: boolean;
  onTogglePopover: () => void;
  onSelectBrand: (brandName: string) => void;
  onViewDetails: () => void;
}

const InfluencerRow: React.FC<InfluencerRowProps> = ({ row, isOpen, onTogglePopover, onSelectBrand, onViewDetails }) => {
  return (
    <div className="group relative overflow-visible bg-white px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-25px_rgba(15,23,42,0.35)] md:px-6">
      <div className="grid gap-4 text-slate-800 sm:grid-cols-[2fr_1.5fr_1fr_1fr] sm:items-center">
        <div className="sm:col-span-1">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Name</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 truncate">{row.influencer_name}</p>
        </div>

        <div className="sm:col-span-1">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Instagram</p>
          {row.instagram_handle && !row.instagram_handle.startsWith('@unknown') ? (
            <a
              href={`https://instagram.com/${row.instagram_handle.replace(/^@/, '')}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-900"
            >
              <Instagram className="h-4 w-4 text-pink-500" />
              {row.instagram_handle}
            </a>
          ) : (
            <p className="mt-1 text-sm font-semibold text-slate-500">—</p>
          )}
        </div>

        <div className="sm:col-span-1">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Total Budget</p>
          <p className="mt-1 inline-flex items-center gap-2 rounded-3xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm shadow-slate-900/5">
            <DollarSign className="h-4 w-4 text-slate-500" />
            {row.total_budget}
          </p>
        </div>

        <div className="relative sm:col-span-1">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Brands</p>
          <button
            type="button"
            onClick={onTogglePopover}
            className="mt-1 inline-flex min-w-[10rem] items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-100"
          >
            <span>{row.brands.length} brand{row.brands.length === 1 ? '' : 's'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
          </button>

          <BrandPopover brands={row.brands} open={isOpen} onSelectBrand={onSelectBrand} />
        </div>

      </div>
    </div>
  );
};

export default InfluencerRow;
