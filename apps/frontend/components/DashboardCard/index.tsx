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
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className ?? ""}`}>
      <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
        {dotColor && <span className={`w-2 h-2 rounded-full ${dotColor} inline-block`} />}
        {title}
      </h2>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : empty ? (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        children
      )}
    </div>
  );
}
