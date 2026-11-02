interface ExternalLabelProps {
  className?: string;
}

export function ExternalLabel({ className = '' }: ExternalLabelProps) {
  return (
    <span className={`inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold leading-none text-amber-200 ${className}`}>
      Extern
    </span>
  );
}
