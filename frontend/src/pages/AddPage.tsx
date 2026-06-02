import { FormEvent, useEffect, useState } from "react";

import { createTransaction, downloadImportTemplate, fetchTrackerConfig, importTransactions } from "../api/tracker";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [amount, setAmount] = useState(0);
  const [isDebit, setIsDebit] = useState(true);
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [description, setDescription] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const config = await fetchTrackerConfig();
        setCategories(config.categories);
        setPaymentMethods(config.payment_methods);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tracker config.");
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
      <h2 className="text-lg font-semibold">Ledger Add</h2>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
        <select className="rounded border p-2" value={isDebit ? "Debit" : "Credit"} onChange={(e) => setIsDebit(e.target.value === "Debit")}>
          <option>Debit</option>
          <option>Credit</option>
        </select>
        <input className="rounded border p-2" type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <select className="rounded border p-2" value={category} onChange={(e) => setCategory(e.target.value)} required>
          <option value="">Select category</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className="rounded border p-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="">Select payment method</option>
          {paymentMethods.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <input className="rounded border p-2" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} required />
        <input className="rounded border p-2" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
        <button className="rounded bg-blue-600 px-3 py-2 text-white md:col-span-2" type="submit">
          Save transaction
        </button>
      </form>

      <section className="space-y-2 rounded border border-gray-200 p-3">
        <h3 className="font-medium">Import from CSV</h3>
        <div className="flex flex-wrap gap-2">
          <button className="rounded border px-3 py-2" type="button" onClick={() => void onDownloadTemplate()}>
            Download template
          </button>
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="rounded bg-blue-600 px-3 py-2 text-white" type="button" onClick={() => void onImport()} disabled={!file}>
            Import
          </button>
        </div>
      </section>

      {status && <p className="whitespace-pre-line text-sm text-green-700">{status}</p>}
      {error && <p className="whitespace-pre-line text-sm text-red-600">{error}</p>}
    </div>
  );
}
