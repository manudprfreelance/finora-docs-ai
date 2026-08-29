export default function RequestPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6">
        <section className="w-full max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
            Finora Docs AI
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Start a document request
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Tell us what document you need. Finora Docs AI will guide you
            through the request securely and step by step.
          </p>

          <div className="mt-10">
            <label
              htmlFor="request"
              className="text-sm font-medium text-slate-200"
            >
              What document do you need?
            </label>

            <textarea
              id="request"
              name="request"
              rows={6}
              placeholder="For example: I need the statement for my account for February 2026."
              className="mt-3 w-full resize-none rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            />

            <button
              type="button"
              className="mt-6 rounded-xl bg-emerald-500 px-6 py-3 font-medium text-slate-950 transition hover:bg-emerald-400"
            >
              Continue
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}