import { Button } from "@/components/ui/button"

function App() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(32,94,148,0.28),_transparent_42%),linear-gradient(180deg,_#07111b,_#03070d)] px-6 py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="inline-flex w-fit items-center gap-3 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-cyan-200">
          BountyNet
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
          Webv3 Scaffold
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur">
            <p className="mb-3 text-xs uppercase tracking-[0.32em] text-slate-400">
              Foundation
            </p>
            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-white">
              Vite + Tailwind v4 + shadcn is ready for the next dashboard pass.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              This app is a clean workspace for the BountyNet control plane rewrite,
              with path aliases, Tailwind v4, and shadcn component scaffolding.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Button size="lg">Open Control Plane</Button>
              <Button variant="outline" size="lg">
                Inspect Registry
              </Button>
            </div>
          </section>
          <section className="rounded-3xl border border-amber-300/15 bg-amber-300/5 p-8">
            <p className="text-xs uppercase tracking-[0.32em] text-amber-200/80">
              Status
            </p>
            <ul className="mt-5 space-y-3 text-sm text-slate-200">
              <li className="flex items-center justify-between rounded-2xl border border-white/8 px-4 py-3">
                <span>Tailwind v4</span>
                <span className="text-emerald-300">installed</span>
              </li>
              <li className="flex items-center justify-between rounded-2xl border border-white/8 px-4 py-3">
                <span>Alias `@/*`</span>
                <span className="text-emerald-300">configured</span>
              </li>
              <li className="flex items-center justify-between rounded-2xl border border-white/8 px-4 py-3">
                <span>shadcn/ui</span>
                <span className="text-amber-300">initializing</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  )
}

export default App
