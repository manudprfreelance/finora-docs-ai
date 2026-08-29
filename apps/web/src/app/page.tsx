export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6">
        <section className="max-w-3xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
            Finora Bank
          </p>

          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Finora Docs AI
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Intelligent document automation for financial services.
            Secure, traceable and powered by agentic AI.
          </p>

          <button className="mt-8 rounded-xl bg-emerald-500 px-6 py-3 font-medium text-slate-950 transition hover:bg-emerald-400">
            Start a document request
          </button>
        </section>
      </div>
    </main>
  );
}