import AuthButtons from "@/components/AuthButtons";
import TeamList from "@/components/TeamList";
import TournamentList from "@/components/TournamentList";
import { LABEL_ALL_TEAMS } from "@/constants/labels";
import Link from "next/link";
export default function Home() {
  return (
    <div className="landing-page min-h-screen bg-background">
      <div className="badminton-scroll-bg" aria-hidden="true" />

      {/* Hero */}
      <div className="hero-badminton-wrap border-b border-border bg-card/70">
        <div className="hero-badminton-scene" aria-hidden="true">
          <div className="hero-badminton-glow" />
          <div className="hero-badminton-court" />
          <div className="hero-badminton-net" />
          <div className="hero-badminton-racket hero-badminton-racket-left">
            <span className="hero-badminton-handle" />
          </div>
          <div className="hero-badminton-racket hero-badminton-racket-right">
            <span className="hero-badminton-handle" />
          </div>
          <div className="hero-badminton-shuttle" />
        </div>
        <div
          className={
            "relative mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 " +
            "py-12 text-center"
          }
        >
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Host your Tournaments.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            Create and join tournaments. Track results, manage teams or plan matches.
          </p>
          <AuthButtons />
        </div>
      </div>

      {/* Tournaments */}
      <div className="mx-auto max-w-5xl px-4 py-5">
        <section className="rounded-xl border border-border/80 bg-card/75 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Current Tournaments</h2>
            <Link
              href="/tournaments?filter=active"
              className={
                "inline-flex items-center rounded-md border border-border/80 px-2.5 py-1 " +
                "text-sm font-medium text-primary hover:bg-muted/65 hover:text-primary/80"
              }
            >
              See more
            </Link>
          </div>
          <TournamentList
            defaultFilter={["active"]}
            hideFilters
            sortBy="participants"
            layout="carousel"
          />
        </section>
      </div>

      {/* Teams */}
      <div className="mx-auto max-w-5xl px-4 pb-6">
        <section className="rounded-xl border border-border/80 bg-card/75 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Teams</h2>
            <Link
              href="/teams"
              className={
                "inline-flex items-center rounded-md border border-border/80 px-2.5 py-1 " +
                "text-sm font-medium text-primary hover:bg-muted/65 hover:text-primary/80"
              }
            >
              {LABEL_ALL_TEAMS}
            </Link>
          </div>
          <TeamList layout="carousel" />
        </section>
      </div>

    </div>
  );
}
