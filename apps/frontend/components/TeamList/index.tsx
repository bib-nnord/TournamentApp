"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useFetch } from "@/hooks/useFetch";
import Link from "next/link";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

interface TeamCard {
  id: number;
  name: string;
  description?: string | null;
  bio?: string | null;
  open: boolean;
  members: number;
  disciplines?: string[];
  leader?: {
    id: number;
    username: string;
    displayName: string | null;
  } | null;
  createdAt?: string;
}

interface TeamListProps {
  layout?: "grid" | "carousel";
}

export default function TeamList({ layout = "grid" }: TeamListProps) {
  const { data, loading, error } = useFetch<{ teams: TeamCard[] }>("/teams?limit=4");
  const teams = data?.teams ?? [];
  const getTeamDescription = (team: TeamCard) => team.description ?? team.bio ?? null;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">No teams yet.</p>;
  }

  if (layout === "carousel") {
    return (
      <Carousel
        opts={{ align: "start" }}
        className="w-full px-10"
      >
        <CarouselContent>
          {teams.map((t) => {
            const teamDescription = getTeamDescription(t);
            return (
            <CarouselItem
              key={t.id}
              className="basis-full sm:basis-1/2 lg:basis-1/3"
            >
              <Link
                href={`/teams/${t.id}`}
                className={
                  "flex h-full min-h-[190px] flex-col gap-2.5 rounded-lg border border-border " +
                  "bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-card-foreground">{t.name}</h2>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs font-medium " +
                      (t.open
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {t.open ? "Open" : "Closed"}
                  </span>
                </div>

                {teamDescription && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap [overflow-wrap:anywhere]">{teamDescription}</p>
                )}

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{t.members} members</span>
                  <span>{t.open ? "Recruiting now" : "Invite only"}</span>
                  <span>
                    {t.disciplines && t.disciplines.length > 0
                      ? t.disciplines.slice(0, 2).join(", ")
                      : "No discipline set"}
                  </span>
                  <span>
                    {t.leader
                      ? `Leader: ${t.leader.displayName ?? t.leader.username}`
                      : "Leader not set"}
                  </span>
                  <span className="col-span-2">
                    {t.createdAt
                      ? `Created ${new Date(t.createdAt).toLocaleDateString()}`
                      : "Recently active"}
                  </span>
                </div>

                <span className="mt-auto text-[11px] text-muted-foreground">Open team page</span>
              </Link>
            </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious className="left-0" />
        <CarouselNext className="right-0" />
      </Carousel>
    );
  }

  return (
    <Accordion type="multiple" className="space-y-2">
      {teams.map((t) => {
        const teamDescription = getTeamDescription(t);
        return (
        <AccordionItem key={t.id} value={String(t.id)}>
          <AccordionTrigger className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg">
            <span className="text-sm font-semibold text-card-foreground">{t.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t.members} members</span>
              <span className={
                "rounded-full px-2 py-0.5 text-xs font-medium " +
                (t.open
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-muted text-muted-foreground")
              }>
                {t.open ? "Open" : "Closed"}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="bg-card border-x border-b border-border rounded-b-lg">
            <div className="flex flex-col gap-2 p-3">
              {teamDescription && <p className="text-xs text-muted-foreground whitespace-pre-wrap [overflow-wrap:anywhere]">{teamDescription}</p>}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t.disciplines && t.disciplines.length > 0
                    ? t.disciplines.slice(0, 2).join(", ")
                    : "No discipline set"}
                </span>
                <span>{t.open ? "Recruiting now" : "Invite only"}</span>
                <span>
                  {t.leader
                    ? `Leader: ${t.leader.displayName ?? t.leader.username}`
                    : "Leader not set"}
                </span>
                <span>
                  {t.createdAt
                    ? `Created ${new Date(t.createdAt).toLocaleDateString()}`
                    : "Recently active"}
                </span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        );
      })}
    </Accordion>
  );
}
