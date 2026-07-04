const STATUS_STYLES: Record<string, string> = {
  captured: "bg-amber-50 text-amber-700",
  reviewed: "bg-sky-50 text-sky-700",
  scripted: "bg-violet-50 text-violet-700",
  drafted: "bg-fuchsia-50 text-fuchsia-700",
  scheduled: "bg-teal-50 text-teal-700",
  posted: "bg-green-50 text-green-700",
  archived: "bg-neutral-100 text-neutral-500",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600"
      }`}
    >
      {status}
    </span>
  );
}

const BRAND_LABELS: Record<string, { label: string; style: string }> = {
  real_one: { label: "The Real One", style: "bg-rose-50 text-rose-700" },
  operator: { label: "The Operator", style: "bg-indigo-50 text-indigo-700" },
  both: { label: "Both brands", style: "bg-emerald-50 text-emerald-700" },
  unsure: { label: "Brand?", style: "bg-neutral-100 text-neutral-500" },
};

export function BrandChip({ brand }: { brand: string }) {
  const b = BRAND_LABELS[brand] ?? BRAND_LABELS.unsure;
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${b.style}`}>
      {b.label}
    </span>
  );
}
