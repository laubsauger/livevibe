import { Button } from "@/components/ui/button";
import { CompanionStatus } from "@/components/CompanionStatus";
import Link from "next/link";

export default function Home() {
  return (
    <main className="noise min-h-screen bg-background text-foreground">
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-panel-border bg-panel/50 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-full bg-accent" />
          <span className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
            Livevibe Studio
          </span>
        </div>
        <CompanionStatus />
      </header>

      <div className="mx-auto max-w-5xl px-6 pt-24 pb-20">
        <div className="flex flex-col gap-12">
          {/* Hero Section */}
          <div className="space-y-6">
            <p className="max-w-2xl text-xl text-muted-foreground">
              Strudel IDE with sequenced timing, plan-driven AI, and
              companion-powered runtime control.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button variant="outline" size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link href="http://localhost:4321" target="_blank">
                  Launch Session
                </Link>
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Sequencer-first timing",
                body: "Schedule edits at loop, bar, or step boundaries with deterministic playback."
              },
              {
                title: "Assistant with guardrails",
                body: "Plans before execution, audit logs, and explicit approval gates."
              },
              {
                title: "Companion runtime",
                body: "Dedicated process for stable audio, transport control, and player embedding."
              }
            ].map((card) => (
              <div
                key={card.title}
                className="group rounded-2xl border border-panel-border bg-panel p-6 transition-colors hover:border-accent/50"
              >
                <h2 className="text-lg font-semibold text-foreground group-hover:text-accent">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
