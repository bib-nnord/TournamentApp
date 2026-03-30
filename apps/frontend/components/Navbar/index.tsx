"use client";

import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";
import { getUserInitial } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { logoutAsync } from "@/store/authSlice";
import type { RootState, AppDispatch } from "@/store/store";
import { ChevronDown, ChevronUp, Mail } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const sharedLinks = [
  { href: "/tournaments", label: "Tournaments" },
  { href: "/users", label: "Users" },
] as const;

const authedLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/teams", label: "Teams" },
  { href: "/friends", label: "Friends" },
] as const;

function NavLink({
  href,
  children,
  index,
}: {
  href: string;
  children: React.ReactNode;
  index: number;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <NavigationMenuItem className="flex-1">
      <NavigationMenuLink asChild>
        <Link
          href={href}
          className={cn(
            "relative inline-flex w-full items-center justify-center font-bold tracking-wide transition-colors md:h-9 md:px-4",
            index > 0,
            active
              ? "bg-card text-primary-foreground"
              : "bg-card text-foreground/60 hover:bg-muted/70 hover:text-foreground"
          )}
        >
          {active && (
            <span className="pointer-events-none absolute inset-x-1.5 inset-y-0 rounded-[2px] bg-primary/90" />
          )}
          <span className="relative">{children}</span>
        </Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

export default function Navbar() {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const pathname = usePathname();
  const user = useSelector((state: RootState) => state.user.current);
  const isLoggedIn = !!user;

  const fetchUnread = useCallback(async () => {
    try {
      const res = await apiFetch("/messages/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    const handleUpdate = () => fetchUnread();
    window.addEventListener("unread-count-changed", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("unread-count-changed", handleUpdate);
    };
  }, [isLoggedIn, fetchUnread]);

  function handleLogout() {
    dispatch(logoutAsync());
    sessionStorage.removeItem("ai-chat-history");
    router.push("/");
  }

  const links = isLoggedIn ? [...sharedLinks, ...authedLinks] : [...sharedLinks];
  const effectiveUnread = isLoggedIn ? unreadCount : 0;
  const messagesActive = pathname === "/messages" || pathname.startsWith("/messages/");

  if (collapsed) {
    return (
      <div className="fixed top-0 right-6 z-50">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-1 rounded-b border border-t-0 border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="h-3 w-3" />
          Show nav
        </button>
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[110rem] items-center gap-2 px-4 md:px-5">
        <Link href="/" className="shrink-0 rounded-sm border border-border bg-background px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground md:text-sm">
          Tournament App
        </Link>

        <NavigationMenu className="hidden max-w-none flex-1 md:flex">
          <NavigationMenuList className="w-full justify-stretch space-x-0">
            {links.map((link, index) => (
              <NavLink
                key={link.href}
                href={link.href}
                index={index}
              >
                {link.label}
              </NavLink>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

      <div className="flex items-center gap-1.5">
          {isLoggedIn && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className={cn(
                "relative h-8 rounded-md px-2.5 bg-white text-foreground border-primary"
              )}
            >
              <Link href="/messages" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Messages
                {effectiveUnread > 0 && (
                  <Badge className="ml-1 h-4 min-w-4 rounded-sm bg-white px-1 text-[10px] text-primary border border-primary">
                    {effectiveUnread > 99 ? "99+" : effectiveUnread}
                  </Badge>
                )}
              </Link>
            </Button>
          )}

          <Separator orientation="vertical" className="mx-0.5 hidden h-6 md:block" />

          {isLoggedIn && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-48 justify-between rounded-md px-2 bg-white text-foreground data-[state=open]:rounded-b-none data-[state=open]:border-b-transparent md:w-52"
                >
                  <Avatar className="h-5 w-5 rounded-md border border-border">
                    <AvatarFallback className="rounded-md bg-secondary text-[10px] font-semibold text-secondary-foreground">
                      {getUserInitial(user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-24 truncate text-xs font-medium md:text-sm">{user.username}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={0}
                className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-0 rounded-b-md rounded-t-none border-t-0 bg-white"
              >
                <DropdownMenuItem asChild>
                  <Link href={`/profile/${user.username}`}>Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center md:flex">
              <Button asChild variant="outline" size="sm" className="h-8 rounded-l-sm rounded-r-none ">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm" className="h-8 rounded-r-sm rounded-l-none px-3">
                <Link href="/register">Register</Link>
              </Button>
            </div>
          )}

          <Button onClick={() => setCollapsed(true)} variant="ghost" size="icon" className="h-7 w-7 rounded-sm" title="Collapse navbar">
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
