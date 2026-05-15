import React from 'react';
import { X, Calendar, DollarSign, ClipboardList, Link, CheckCircle2 } from 'lucide-react';
import type { InfluencerSearchRow } from './SearchResultsTable';

export interface BrandDetails {
  brand_name: string;
  campaign_name?: string;
  budget?: string | number;
  deliverables?: string;
  posting_dates?: string;
  status?: string;
  notes?: string;
  attachments?: string[];
  social_links?: string[];
}

interface BrandDetailsDrawerProps {
  brand: BrandDetails | null;
  influencer: InfluencerSearchRow | null;
  onClose: () => void;
}

const BrandDetailsDrawer: React.FC<BrandDetailsDrawerProps> = ({ brand, influencer, onClose }) => {
  if (!brand && !influencer) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-end bg-slate-950/40 backdrop-blur-sm md:items-center">
      <div className="absolute inset-0" onClick={onClose} />
      <aside className="relative w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white px-6 py-6 shadow-2xl md:rounded-l-3xl md:rounded-r-none md:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-700 transition hover:bg-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-900 text-xl font-black text-white">{(brand && brand.brand_name?.[0]) || (influencer && influencer.profile_initial) || 'B'}</span>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{brand ? 'Brand details' : 'Influencer details'}</p>
              <h2 className="text-3xl font-semibold text-slate-900">{brand?.brand_name || influencer?.influencer_name}</h2>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-slate-500">A premium panel showing the selected {brand ? 'brand summary' : 'influencer row'} with campaign and contact details.</p>
        </div>

        {influencer && (
          <div className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-slate-900 text-2xl font-black text-white">
                {influencer.profile_initial}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Influencer</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900 truncate">{influencer.influencer_name}</h3>
                <p className="mt-1 text-sm text-slate-600 truncate">{influencer.instagram_handle || '—'}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-white p-4 border border-slate-200">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Email</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 truncate">{influencer.influencer_email || '—'}</p>
              </div>
              <div className="rounded-3xl bg-white p-4 border border-slate-200">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Budget</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{influencer.total_budget}</p>
              </div>
              <div className="rounded-3xl bg-white p-4 border border-slate-200">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Brands</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{influencer.brands.length} brand{influencer.brands.length === 1 ? '' : 's'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Campaign</p>
            <p className="mt-3 text-base font-semibold text-slate-900">{brand.campaign_name || 'Campaign details unavailable'}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Budget</p>
            <p className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-slate-900">
              <DollarSign className="h-4 w-4 text-slate-500" />
              {typeof brand.budget === 'number' ? `$${brand.budget.toLocaleString()}` : brand.budget || 'Not set'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <ClipboardList className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.35em]">Deliverables</p>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{brand.deliverables || 'No deliverables listed yet.'}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <Calendar className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.35em]">Posting dates</p>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{brand.posting_dates || 'Dates pending confirmation.'}</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-slate-500">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.35em]">Status</p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white">{brand.status || 'Active'}</span>
          </div>

          <div className="mt-4 text-sm leading-7 text-slate-600">{brand.notes || 'No additional notes have been added to this campaign yet.'}</div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Attachments</p>
            {brand.attachments && brand.attachments.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {brand.attachments.map((file, idx) => (
                  <li key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{file}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No attachments available.</p>
            )}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Social links</p>
            {brand.social_links && brand.social_links.length > 0 ? (
              <div className="mt-3 space-y-3">
                {brand.social_links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    <Link className="h-4 w-4 text-slate-500" />
                    <span className="truncate">{link}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No social links added yet.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default BrandDetailsDrawer;
