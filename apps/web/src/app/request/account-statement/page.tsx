"use client";

import { useState } from "react";

export default function AccountStatementPage() {
  const [account, setAccount] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const canContinue =
    account.trim() !== "" && dateFrom !== "" && dateTo !== "";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <section className="w-full max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
            Finora Docs AI
          </p>

          <p className="mt-8 text-sm font-medium text-slate-500">
            Account statement
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Complete your request
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            We need a few details before we can prepare your account statement.
          </p>

          <div className="mt-10 space-y-7">
            <div>
              <label
                htmlFor="account"
                className="text-sm font-medium text-slate-200"
              >
                Account
              </label>

              <select
                id="account"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              >
                <option value="">Select an account</option>
                <option value="account-0236">
                  Current account ·•••• 0236
                </option>
                <option value="account-8174">
                  Savings account ·•••• 8174
                </option>
              </select>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="dateFrom"
                  className="text-sm font-medium text-slate-200"
                >
                  From
                </label>

                <input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              <div>
                <label
                  htmlFor="dateTo"
                  className="text-sm font-medium text-slate-200"
                >
                  To
                </label>

                <input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-sm font-medium text-slate-300">
                Why do we need this?
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                The account and date range determine which positions and
                movements will be included in the document.
              </p>
            </div>

            <button
              type="button"
              disabled={!canContinue}
              className="rounded-xl bg-emerald-500 px-6 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              Review request
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}