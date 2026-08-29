type FinoraLogoProps = {
  compact?: boolean;
};

export function FinoraLogo({ compact = false }: FinoraLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl
                   bg-gradient-to-br from-emerald-400 to-cyan-500
                   shadow-[0_0_30px_rgba(52,211,153,0.18)]"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-slate-950"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 18V6h10M7 12h8"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {!compact && (
        <div className="leading-none">
          <div className="text-[15px] font-semibold tracking-tight text-white">
            Finora
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-400">
            Docs AI
          </div>
        </div>
      )}
    </div>
  );
}