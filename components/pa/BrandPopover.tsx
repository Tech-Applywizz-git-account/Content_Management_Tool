import React from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';

interface BrandPopoverProps {
  brands: string[];
  open: boolean;
  onSelectBrand: (brandName: string) => void;
}

const BrandPopover: React.FC<BrandPopoverProps> = ({ brands, open, onSelectBrand }) => {
  return (
    <div
      className={`absolute left-0 top-full z-20 mt-3 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 transition-all duration-200 ${
        open ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-95'
      }`}
    >
      <div className="border-b border-slate-200 px-4 py-3 text-xs uppercase tracking-[0.35em] text-slate-500">Brands</div>
      <div className="space-y-2 px-3 py-3">
        {brands.map((brand) => (
          <button
            key={brand}
            type="button"
            onClick={() => onSelectBrand(brand)}
            className="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            <span className="whitespace-normal break-words text-left">{brand}</span>
            <ExternalLink className="mt-1 h-4 w-4 text-slate-500" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default BrandPopover;
