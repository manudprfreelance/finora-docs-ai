"use client";

import { useState } from "react";

type DocumentType =
  | "account_statement"
  | "loan_amortization"
  | "swift_confirmation"
  | "unknown";

type AnalysisResult = {
  type: DocumentType;
  title: string;
  description: string;
};

function analyzeRequest(request: string): AnalysisResult {
  const normalized = request.toLowerCase();

  if (
    normalized.includes("extracto") ||
    normalized.includes("statement") ||
    normalized.includes("posición") ||
    normalized.includes("posicion")
  ) {
    return {
      type: "account_statement",
      title: "Account statement",
      description:
        "The request appears to be for an account statement or position statement.",
    };
  }

  if (
    normalized.includes("amortización") ||
    normalized.includes("amortizacion") ||
    normalized.includes("préstamo") ||
    normalized.includes("prestamo") ||
    normalized.includes("loan")
  ) {
    return {
      type: "loan_amortization",
      title: "Loan amortization schedule",
      description:
        "The request appears to be for a loan amortization schedule.",
    };
  }

  if (
    normalized.includes("swift") ||
    normalized.includes("transferencia internacional") ||
    normalized.includes("international transfer")
  ) {
    return {
      type: "swift_confirmation",
      title: "SWIFT payment confirmation",
      description:
        "The request appears to be for confirmation of an international SWIFT payment.",
    };
  }

  return {
    type: "unknown",
    title: "Document type not identified",
    description:
      "We need a little more information before we can identify the requested document.",
  };
}

export default function RequestPage() {
  const [request, setRequest] = useState("");
  const [submittedRequest, setSubmittedRequest] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const handleContinue = () => {
    const cleanRequest = request.trim();

    if (!cleanRequest) {
      return;
    }

    setSubmittedRequest(cleanRequest);
    setAnalysis(null);
  };

  const handleEdit = () => {
    setSubmittedRequest(null);
    setAnalysis(null);
  };

  const handleAnalyze = () => {
    if (!submittedRequest) {
      return;
    }

    setAnalysis(analyzeRequest(submittedRequest));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
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

          {!submittedRequest ? (
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
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                placeholder="For example: I need the statement for my account for February 2026."
                className="mt-3 w-full resize-none rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />

              <div className="mt-3 flex items-center justify-between gap-6">
                <p className="text-sm text-slate-500">
                  Describe your request naturally. You do not need to know the
                  exact document name.
                </p>

                <span className="shrink-0 text-sm text-slate-600">
                  {request.length} characters
                </span>
              </div>

              <button
                type="button"
                onClick={handleContinue}
                disabled={!request.trim()}
                className="mt-6 rounded-xl bg-emerald-500 px-6 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
                  {analysis ? "Request analyzed" : "Request received"}
                </p>
              </div>

              {!analysis ? (
                <>
                  <h2 className="mt-5 text-2xl font-semibold">
                    We&apos;re ready to analyze your request
                  </h2>

                  <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-5">
                    <p className="text-sm text-slate-500">Your request</p>

                    <p className="mt-2 leading-7 text-slate-200">
                      {submittedRequest}
                    </p>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-slate-400">
                    Finora Docs AI will identify the document type and
                    determine what information is required to process it.
                  </p>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                    >
                      Edit request
                    </button>

                    <button
                      type="button"
                      onClick={handleAnalyze}
                      className="rounded-xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-400"
                    >
                      Analyze request
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-5 text-2xl font-semibold">
                    {analysis.title}
                  </h2>

                  <p className="mt-3 leading-7 text-slate-300">
                    {analysis.description}
                  </p>

                  <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-5">
                    <p className="text-sm text-slate-500">
                      Original request
                    </p>

                    <p className="mt-2 leading-7 text-slate-200">
                      {submittedRequest}
                    </p>
                  </div>

                  {analysis.type !== "unknown" ? (
                    <div className="mt-6">
                      <p className="text-sm text-slate-400">
                        Document type successfully identified.
                      </p>

                      <button
                        type="button"
                        className="mt-5 rounded-xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-400"
                      >
                        Continue with request
                      </button>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <p className="text-sm text-amber-300">
                        Please edit your request and provide a little more
                        detail.
                      </p>

                      <button
                        type="button"
                        onClick={handleEdit}
                        className="mt-5 rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                      >
                        Edit request
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}