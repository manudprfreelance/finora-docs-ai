"use client";

import { useState } from "react";

import { createEmptyDocumentRequest } from "@/lib/request-types";
import {
  resolveCustomerFromDni,
  updateRequestStatus,
} from "@/lib/request-engine";

export default function RequestEngineDevPage() {
  const [dni, setDni] = useState("");
  const [result, setResult] = useState(
    updateRequestStatus(createEmptyDocumentRequest()),
  );

  const handleResolveCustomer = () => {
    const initialRequest = createEmptyDocumentRequest();

    const resolvedRequest = resolveCustomerFromDni(
      initialRequest,
      dni,
    );

    setResult(resolvedRequest);
  };

  const handleReset = () => {
    setDni("");
    setResult(updateRequestStatus(createEmptyDocumentRequest()));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <section className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
            Finora Docs AI
          </p>

          <p className="mt-8 text-sm font-medium text-slate-500">
            Development tool
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Request engine inspector
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Internal development screen used to verify customer resolution,
            account retrieval and missing-field calculation before connecting
            the real agent and backend.
          </p>

          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <label
              htmlFor="dni"
              className="text-sm font-medium text-slate-200"
            >
              Test customer DNI
            </label>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="dni"
                type="text"
                value={dni}
                onChange={(event) => setDni(event.target.value)}
                placeholder="12345678A"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />

              <button
                type="button"
                onClick={handleResolveCustomer}
                disabled={!dni.trim()}
                className="shrink-0 rounded-xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                Resolve customer
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="shrink-0 rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-200 transition hover:bg-slate-800"
              >
                Reset
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Test identities
              </p>

              <div className="mt-3 space-y-2 text-sm text-slate-400">
                <p>
                  <span className="text-slate-200">12345678A</span>
                  {" — "}
                  customer with two accounts
                </p>

                <p>
                  <span className="text-slate-200">87654321B</span>
                  {" — "}
                  customer with one account
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
                Customer
              </p>

              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="text-sm text-slate-500">Customer ID</dt>
                  <dd className="mt-1 text-slate-200">
                    {result.customer.customerId ?? "Not resolved"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-slate-500">DNI</dt>
                  <dd className="mt-1 text-slate-200">
                    {result.customer.dni ?? "Missing"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-slate-500">Name</dt>
                  <dd className="mt-1 text-slate-200">
                    {result.customer.name ?? "Missing"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
                Engine state
              </p>

              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="text-sm text-slate-500">Status</dt>
                  <dd className="mt-1 text-slate-200">
                    {result.status}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-slate-500">
                    Available accounts
                  </dt>
                  <dd className="mt-1 text-slate-200">
                    {result.availableAccounts.length}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-slate-500">
                    Automatically selected account
                  </dt>
                  <dd className="mt-1 text-slate-200">
                    {result.selectedAccount
                      ? `${result.selectedAccount.accountName} ${result.selectedAccount.maskedAccountNumber}`
                      : "None"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-300">
              Missing information
            </p>

            {result.missingFields.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {result.missingFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-sm text-amber-200"
                  >
                    {field}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-emerald-300">
                No missing fields.
              </p>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Retrieved accounts
            </p>

            {result.availableAccounts.length > 0 ? (
              <div className="mt-4 space-y-3">
                {result.availableAccounts.map((account) => (
                  <div
                    key={account.accountId}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                  >
                    <p className="font-medium text-slate-200">
                      {account.accountName}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {account.maskedAccountNumber}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No accounts retrieved.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}