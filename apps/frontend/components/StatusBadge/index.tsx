interface StatusBadgeProps {
  label: string;
  colorClass: string;
  className?: string;
}

export default function StatusBadge({ label, colorClass, className = "" }: StatusBadgeProps) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass} ${className}`}>
      {label}
    </span>
  );
}
