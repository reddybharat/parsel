import { FormEvent, useEffect, useState } from "react";

import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { LoadingState } from "../components/feedback/LoadingState";
import { createTransaction, downloadImportTemplate, fetchTrackerConfig, importTransactions } from "../api/tracker";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const [amount, setAmount] = useState(0);
  const [isDebit, setIsDebit] = useState(true);
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [tab, setTab] = useState<"manual" | "bulk">("manual");

  useEffect(() => {
    void (async () => {
      try {
        const config = await fetchTrackerConfig();
        setCategories(config.categories);
        setPaymentMethods(config.payment_methods);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tracker config.");
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      await createTransaction({
        amount,
        is_debit: isDebit,
        category,
        payment_method: paymentMethod || null,
        transaction_date: transactionDate,
        description: description.trim() || null,
      });
      setStatus("Transaction saved.");
      setAmount(0);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save transaction.");
    }
  }

  async function onDownloadTemplate() {
    try {
      const blob = await downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "transactions_import_template.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template download failed.");
    }
  }

  async function onImport() {
    if (!file) return;
    setError(null);
    setStatus(null);
    try {
      const result = await importTransactions(file);
      const errorCount = result.errors.length;
      setStatus(`Imported ${result.inserted} transaction(s).${errorCount ? ` ${errorCount} row(s) failed.` : ""}`);
      if (errorCount) {
        setError(result.errors.slice(0, 5).join("\n"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV import failed.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Back to ledger</p>
        <h2 className="mt-2 text-[40px] font-semibold tracking-tight text-parsel-neutral">Unified Entry Flow</h2>
        <p className="text-sm text-parsel-muted">Effortlessly maintain records through manual entry or intelligent CSV processing.</p>
      </div>

      {loadingConfig ? <LoadingState label="Loading tracker configuration..." /> : null}

      {!loadingConfig && categories.length === 0 ? (
        <EmptyState title="No categories available" detail="Configure tracker categories before adding transactions." />
      ) : null}

      {!loadingConfig && categories.length > 0 ? (
        <div className="rounded-xl border border-parsel-border bg-white">
          <div className="grid grid-cols-2 border-b border-parsel-border text-xs font-semibold uppercase tracking-wide">
            <button
              className={`py-3 ${tab === "manual" ? "border-b-2 border-parsel-primary text-parsel-primary" : "text-parsel-secondary"}`}
              type="button"
              onClick={() => setTab("manual")}
            >
              Manual Entry
            </button>
            <button
              className={`py-3 ${tab === "bulk" ? "border-b-2 border-parsel-primary text-parsel-primary" : "text-parsel-secondary"}`}
              type="button"
              onClick={() => setTab("bulk")}
            >
              Bulk Import
            </button>
          </div>
          {tab === "manual" ? (
            <form className="grid gap-3 p-4 md:grid-cols-2" onSubmit={onSubmit}>
              <div className="md:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Transaction Type</p>
                <div className="inline-flex rounded-lg bg-parsel-soft p-1">
                  <button className={`rounded px-4 py-1 text-sm ${isDebit ? "bg-white text-parsel-primary" : "text-parsel-secondary"}`} type="button" onClick={() => setIsDebit(true)}>
                    Debit
                  </button>
                  <button className={`rounded px-4 py-1 text-sm ${!isDebit ? "bg-white text-parsel-primary" : "text-parsel-secondary"}`} type="button" onClick={() => setIsDebit(false)}>
                    Credit
                  </button>
                </div>
              </div>
              <input className="rounded-lg border border-parsel-border p-2" type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              <select className="rounded-lg border border-parsel-border p-2" value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">Select Category</option>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <input className="rounded-lg border border-parsel-border p-2" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} required />
              <select className="rounded-lg border border-parsel-border p-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="">Select Account</option>
                {paymentMethods.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <textarea
                className="rounded-lg border border-parsel-border p-2 md:col-span-2"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was this for?"
              />
              <div className="flex justify-end gap-2 md:col-span-2">
                <button className="rounded-lg bg-[#f0ece6] px-5 py-2 text-sm font-semibold text-parsel-neutral" type="button">
                  Cancel
                </button>
                <button className="rounded-lg bg-parsel-primary px-5 py-2 text-sm font-semibold text-white" type="submit">
                  Save Transaction
                </button>
              </div>
            </form>
          ) : (
            <section className="space-y-3 p-4">
              <p className="text-sm text-parsel-muted">Use the template to ensure valid columns and date format.</p>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border border-parsel-border px-3 py-2" type="button" onClick={() => void onDownloadTemplate()}>
                  Download template
                </button>
                <input className="rounded-lg border border-parsel-border p-2 text-sm" type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button className="rounded-lg bg-parsel-primary px-3 py-2 text-white disabled:opacity-50" type="button" onClick={() => void onImport()} disabled={!file}>
                  Import
                </button>
              </div>
            </section>
          )}
        </div>
      ) : null}

      {status && <p className="whitespace-pre-line text-sm text-emerald-700">{status}</p>}
      {error && <ErrorState message={error} />}
    </div>
  );
}
