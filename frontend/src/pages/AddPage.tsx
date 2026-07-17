import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { EmptyState } from "../components/feedback/EmptyState";
import { LoadingState } from "../components/feedback/LoadingState";
import { StatusAlert, type FeedbackMessage } from "../components/feedback/StatusAlert";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { invalidateDashboardOverview } from "@/lib/dashboardQuery";
import { createTransaction, downloadImportTemplate, fetchTrackerConfig, importTransactions } from "../api/tracker";

const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-parsel-secondary";

function localDateIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AddPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "bulk" ? "bulk" : "manual";
  const [categories, setCategories] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [manualFeedback, setManualFeedback] = useState<FeedbackMessage | null>(null);
  const [bulkFeedback, setBulkFeedback] = useState<FeedbackMessage | null>(null);
  const [importErrors, setImportErrors] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const [amount, setAmount] = useState(0);
  const [isDebit, setIsDebit] = useState(true);
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionDate, setTransactionDate] = useState(localDateIso());
  const [description, setDescription] = useState("");
  const [tab, setTab] = useState<"manual" | "bulk">(initialTab);

  useEffect(() => {
    void (async () => {
      try {
        const config = await fetchTrackerConfig();
        setCategories(config.categories);
        setPaymentMethods(config.payment_methods);
      } catch (err) {
        setFeedback({
          variant: "error",
          title: "Failed to load configuration",
          description: err instanceof Error ? err.message : "Failed to load tracker config.",
        });
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, []);

  function resetManualForm() {
    setAmount(0);
    setIsDebit(true);
    setCategory("");
    setPaymentMethod("");
    setTransactionDate(localDateIso());
    setDescription("");
    setFeedback(null);
    setManualFeedback(null);
    setBulkFeedback(null);
    setImportErrors(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setManualFeedback(null);
    try {
      await createTransaction({
        amount,
        is_debit: isDebit,
        category,
        payment_method: paymentMethod || null,
        transaction_date: transactionDate,
        description: description.trim() || null,
      });
      void invalidateDashboardOverview();
      setManualFeedback({ variant: "success", title: "Transaction saved" });
      setAmount(0);
      setDescription("");
    } catch (err) {
      setManualFeedback({
        variant: "error",
        title: "Save failed",
        description: err instanceof Error ? err.message : "Failed to save transaction.",
      });
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
      setBulkFeedback({
        variant: "error",
        title: "Download failed",
        description: err instanceof Error ? err.message : "Template download failed.",
      });
    }
  }

  async function onImport() {
    if (!file) return;
    setBulkFeedback(null);
    setImportErrors(null);
    try {
      const result = await importTransactions(file);
      void invalidateDashboardOverview();
      const errorCount = result.errors.length;
      setBulkFeedback({
        variant: errorCount ? "info" : "success",
        title: "Import complete",
        description: `Imported ${result.inserted} transaction(s).${errorCount ? ` ${errorCount} row(s) failed.` : ""}`,
      });
      if (errorCount) {
        setImportErrors(result.errors.slice(0, 5).join("\n"));
      }
    } catch (err) {
      setBulkFeedback({
        variant: "error",
        title: "Import failed",
        description: err instanceof Error ? err.message : "CSV import failed.",
      });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <Link
        to="/ledger/search"
        className="inline-flex w-fit items-center gap-1 text-xs font-semibold uppercase tracking-wide text-parsel-secondary hover:text-parsel-primary"
      >
        <span aria-hidden>←</span>
        Back to Ledger
      </Link>

      {feedback ? <StatusAlert {...feedback} onDismiss={() => setFeedback(null)} /> : null}

      {loadingConfig ? <LoadingState label="Loading tracker configuration..." /> : null}

      {!loadingConfig && categories.length === 0 ? (
        <EmptyState title="No categories available" detail="Configure tracker categories before adding transactions." />
      ) : null}

      {!loadingConfig && categories.length > 0 ? (
        <div className="mx-auto w-full max-w-content rounded-xl border border-parsel-border bg-parsel-surface">
          <Tabs value={tab} onValueChange={(value) => setTab(value as "manual" | "bulk")}>
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-b border-parsel-border bg-transparent p-0">
              <TabsTrigger
                className="rounded-none py-3 text-xs font-semibold uppercase tracking-wide data-[state=active]:border-b-2 data-[state=active]:border-parsel-primary data-[state=active]:text-parsel-primary data-[state=active]:shadow-none"
                value="manual"
              >
                Manual Entry
              </TabsTrigger>
              <TabsTrigger
                className="rounded-none py-3 text-xs font-semibold uppercase tracking-wide data-[state=active]:border-b-2 data-[state=active]:border-parsel-primary data-[state=active]:text-parsel-primary data-[state=active]:shadow-none"
                value="bulk"
              >
                Bulk Import
              </TabsTrigger>
            </TabsList>
            <TabsContent className="mt-0" value="manual">
              <form className="p-6 md:p-8" onSubmit={onSubmit}>
                <FieldGroup className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                  <Field className="md:col-span-2">
                    <FieldLabel className={fieldLabelClass}>Transaction Type</FieldLabel>
                    <div className="flex w-fit items-center gap-3">
                      <span className={cn("text-sm", isDebit ? "font-medium text-parsel-primary" : "text-parsel-muted")}>
                        Debit
                      </span>
                      <Switch
                        checked={!isDebit}
                        onCheckedChange={(checked) => setIsDebit(!checked)}
                        aria-label="Transaction type"
                      />
                      <span className={cn("text-sm", !isDebit ? "font-medium text-parsel-primary" : "text-parsel-muted")}>
                        Credit
                      </span>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="add-amount" className={fieldLabelClass}>
                      Amount
                    </FieldLabel>
                    <div className="flex overflow-hidden rounded-md border border-input">
                      <span className="flex items-center bg-parsel-soft px-3 text-sm text-parsel-muted">₹</span>
                      <Input
                        id="add-amount"
                        className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 tabular-nums"
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={amount || ""}
                        onChange={(e) => setAmount(Number(e.target.value))}
                      />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="add-category" className={fieldLabelClass}>
                      Category
                    </FieldLabel>
                    <NativeSelect
                      id="add-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                    >
                      <NativeSelectOption value="">Select Category</NativeSelectOption>
                      {categories.map((item) => (
                        <NativeSelectOption key={item} value={item}>
                          {item}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="add-date" className={fieldLabelClass}>
                      Transaction Date
                    </FieldLabel>
                    <DatePicker
                      id="add-date"
                      value={transactionDate}
                      onChange={setTransactionDate}
                      placeholder="Select date"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="add-payment" className={fieldLabelClass}>
                      Payment Method
                    </FieldLabel>
                    <NativeSelect
                      id="add-payment"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <NativeSelectOption value="">Select Account</NativeSelectOption>
                      {paymentMethods.map((item) => (
                        <NativeSelectOption key={item} value={item}>
                          {item}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field className="md:col-span-2">
                    <FieldLabel htmlFor="add-description" className={fieldLabelClass}>
                      Description / Notes
                    </FieldLabel>
                    <Textarea
                      id="add-description"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What was this for?"
                    />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-2">
                    <div className="min-w-0 flex-1">
                      {manualFeedback ? (
                        <StatusAlert {...manualFeedback} onDismiss={() => setManualFeedback(null)} />
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button asChild variant="secondary" type="button">
                        <Link to="/ledger/search" onClick={resetManualForm}>
                          Cancel
                        </Link>
                      </Button>
                      <Button type="submit">Save Transaction</Button>
                    </div>
                  </div>
                </FieldGroup>
              </form>
            </TabsContent>
            <TabsContent className="mt-0" value="bulk">
              <section className="p-6 md:p-8">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="bulk-csv" className={fieldLabelClass}>
                      CSV File
                    </FieldLabel>
                    <FieldDescription>
                      Use the template to ensure valid columns and date format.
                    </FieldDescription>
                    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          id="bulk-csv"
                          className="max-w-xs"
                          type="file"
                          accept=".csv"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                        <Button type="button" onClick={() => void onImport()} disabled={!file}>
                          Import
                        </Button>
                      </div>
                      <Button type="button" variant="outline" onClick={() => void onDownloadTemplate()}>
                        Download template
                      </Button>
                    </div>
                  </Field>
                  {bulkFeedback ? <StatusAlert {...bulkFeedback} onDismiss={() => setBulkFeedback(null)} /> : null}
                  {importErrors ? (
                    <StatusAlert
                      variant="error"
                      title="Import row errors"
                      description={importErrors}
                      onDismiss={() => setImportErrors(null)}
                    />
                  ) : null}
                </FieldGroup>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </div>
  );
}
