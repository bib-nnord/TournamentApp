interface DashboardCardProps {
  title: string;
  dotColor?: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
  children: React.ReactNode;
}

export default function DashboardCard({
  title,
  dotColor,
  loading,
  empty,
  emptyMessage = "Nothing here yet.",
  className,
  children,
}: DashboardCardProps) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 shadow-sm ${className ?? ""}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
        {dotColor && <span className={`w-2 h-2 rounded-full ${dotColor} inline-block`} />}
        {title}
      </h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : empty ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        children
      )}
    </div>
  );
}
