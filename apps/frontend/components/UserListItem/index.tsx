import { getUserInitial } from "@/lib/helpers";
import Link from "next/link";

interface UserListItemProps {
  username: string;
  online?: boolean;
  showStatus?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export default function UserListItem({
  username,
  online,
  showStatus = false,
  actions,
  className,
}: UserListItemProps) {
  return (
    <div className={`flex items-center px-3 py-2 rounded-lg hover:bg-gray-50 ${className ?? ""}`}> 
      <div className="flex items-center gap-2 flex-1">
        <div className="relative">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
            {getUserInitial(username)}
          </div>
          {showStatus && (
            <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${online ? "bg-green-500" : "bg-gray-300"}`} />
          )}
        </div>
        <Link href={`/profile/${username}`} className="text-sm text-blue-700 hover:underline focus:underline">
          {username}
        </Link>
        {online && <span className="text-xs text-gray-400">Online</span>}
      </div>
      {actions && <span className="ml-auto">{actions}</span>}
    </div>
  );
}
