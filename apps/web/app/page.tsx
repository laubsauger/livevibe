import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="noise min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col gap-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-panel-border bg-panel px-4 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Live Performance Workspace
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Livevibe Studio
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Dark-first Strudel IDE with sequenced timing, plan-driven AI, and
              companion-powered runtime control.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg">Launch Session</Button>
              <Button size="lg" variant="outline">
                View baseline plan
              </Button>
            </div>
          </div>

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
                className="rounded-3xl border border-panel-border bg-panel/80 p-6 shadow-glow"
              >
                <h2 className="text-xl font-semibold">{card.title}</h2>
                <p className="mt-3 text-sm text-muted-foreground">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-panel-border bg-panel p-8">
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span className="font-mono uppercase tracking-[0.2em]">
                Status
              </span>
              <span>
                Companion: waiting on `apps/companion` connection.
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
