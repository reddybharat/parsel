import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileSearch, FolderPlus, Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { EmptyState } from "../components/feedback/EmptyState";
import { InlineProgress } from "../components/feedback/InlineProgress";
import { StatusAlert, type FeedbackMessage } from "../components/feedback/StatusAlert";
import { CategorySelect } from "../components/transactions/CategorySelect";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { invalidateDashboardOverview } from "@/lib/dashboardQuery";
import {
  invalidateTrackerConfig,
  trackerConfigQueryOptions,
} from "@/lib/trackerConfigQuery";
import {
  createTransaction,
  downloadImportTemplate,
  importTransactions,
  previewImportTransactions,
} from "../api/tracker";

const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-parsel-secondary";

type BulkStep = "idle" | "reading" | "preview" | "creating" | "importing" | "done";

const BULK_PROGRESS: Record<Exclude<BulkStep, "idle">, { value: number; label: string }> = {
  reading: { value: 25, label: "Reading file…" },
  preview: { value: 50, label: "Preview ready" },
  creating: { value: 70, label: "Creating categories…" },
  importing: { value: 85, label: "Importing transactions…" },
  done: { value: 100, label: "Import finished" },
};

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
  const {
    data: trackerConfig,
    isPending: loadingConfig,
    isError: configError,
    error: configErr,
  } = useQuery(trackerConfigQueryOptions());
  const categories = trackerConfig?.categories ?? [];
  const paymentMethods = trackerConfig?.payment_methods ?? [];
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [manualFeedback, setManualFeedback] = useState<FeedbackMessage | null>(null);
  const [bulkFeedback, setBulkFeedback] = useState<FeedbackMessage | null>(null);
  const [importErrors, setImportErrors] = useState<string | null>(null);
  const [savingManual, setSavingManual] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [bulkStep, setBulkStep] = useState<BulkStep>("idle");
  const [previewValidRows, setPreviewValidRows] = useState(0);
  const [previewNewCategories, setPreviewNewCategories] = useState<string[]>([]);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);

  const [amount, setAmount] = useState(0);
  const [isDebit, setIsDebit] = useState(true);
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionDate, setTransactionDate] = useState(localDateIso());
  const [description, setDescription] = useState("");
  const [tab, setTab] = useState<"manual" | "bulk">(initialTab);

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

  function resetBulkPreview() {
    setBulkStep("idle");
    setPreviewValidRows(0);
    setPreviewNewCategories([]);
    setPreviewErrors([]);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setManualFeedback(null);
    setSavingManual(true);
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
    } finally {
      setSavingManual(false);
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

  async function onPreviewImport() {
    if (!file) return;
    setBulkFeedback(null);
    setImportErrors(null);
    setBulkStep("reading");
    try {
      const result = await previewImportTransactions(file);
      setPreviewValidRows(result.valid_row_count);
      setPreviewNewCategories(result.new_categories);
      setPreviewErrors(result.errors);
      setBulkStep("preview");
      if (result.valid_row_count === 0 && result.errors.length) {
        setBulkFeedback({
          variant: "error",
          title: "Nothing to import",
          description: "Fix the row errors below, then try again.",
        });
        setImportErrors(result.errors.slice(0, 8).join("\n"));
      }
    } catch (err) {
      resetBulkPreview();
      setBulkFeedback({
        variant: "error",
        title: "Could not read file",
        description: err instanceof Error ? err.message : "CSV preview failed.",
      });
    }
  }

  async function onConfirmImport() {
    if (!file) return;
    setBulkFeedback(null);
    setImportErrors(null);
    const needsCreate = previewNewCategories.length > 0;
    setBulkStep(needsCreate ? "creating" : "importing");
    try {
      if (needsCreate) {
        // Brief status beat before the network call for the Marker trail.
        await new Promise((r) => window.setTimeout(r, 250));
        setBulkStep("importing");
      }
      const result = await importTransactions(file, { createMissingCategories: true });
      void invalidateDashboardOverview();
      if (result.created_categories.length) {
        void invalidateTrackerConfig();
      }
      setBulkStep("done");
      const errorCount = result.errors.length;
      const createdNote = result.created_categories.length
        ? ` Created ${result.created_categories.length} categor${result.created_categories.length === 1 ? "y" : "ies"}.`
        : "";
      setBulkFeedback({
        variant: errorCount ? "info" : "success",
        title: "Import complete",
        description: `Imported ${result.inserted} transaction(s).${createdNote}${
          errorCount ? ` ${errorCount} row(s) failed.` : ""
        }`,
      });
      if (errorCount) {
        setImportErrors(result.errors.slice(0, 8).join("\n"));
      }
      if (result.created_categories.length) {
        setPreviewNewCategories(result.created_categories);
      }
      setFile(null);
    } catch (err) {
      setBulkStep("preview");
      setBulkFeedback({
        variant: "error",
        title: "Import failed",
        description: err instanceof Error ? err.message : "CSV import failed.",
      });
    }
  }

  const busyBulk = bulkStep === "reading" || bulkStep === "creating" || bulkStep === "importing";

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-y-auto">
      <Link
        to="/ledger/search"
        className="inline-flex w-fit items-center gap-1 text-xs font-semibold uppercase tracking-wide text-parsel-secondary hover:text-parsel-primary"
      >
        <span aria-hidden>←</span>
        Back to Ledger
      </Link>

      {feedback ? <StatusAlert {...feedback} onDismiss={() => setFeedback(null)} /> : null}
      {configError ? (
        <StatusAlert
          variant="error"
          title="Failed to load configuration"
          description={configErr instanceof Error ? configErr.message : "Failed to load tracker config."}
        />
      ) : null}

      {loadingConfig ? (
        <div className="mx-auto w-full max-w-content rounded-none border border-parsel-border bg-parsel-soft p-4">
          <InlineProgress label="Loading categories & payment methods…" />
        </div>
      ) : null}

      {!loadingConfig && categories.length === 0 ? (
        <EmptyState title="No categories available" detail="Configure tracker categories before adding transactions." />
      ) : null}

      {!loadingConfig && categories.length > 0 ? (
        <div className="mx-auto w-full max-w-content rounded-none border border-parsel-border bg-parsel-surface shadow-none">
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
                    <div className="flex overflow-hidden rounded-none border border-input">
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
                    <CategorySelect
                      id="add-category"
                      value={category}
                      categories={categories}
                      onChange={setCategory}
                      required
                    />
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
                      <Button type="submit" disabled={savingManual}>
                        {savingManual ? "Saving…" : "Save Transaction"}
                      </Button>
                    </div>
                  </div>
                  {savingManual ? (
                    <div className="md:col-span-2">
                      <InlineProgress label="Saving transaction…" />
                    </div>
                  ) : null}
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
                      Use the template for columns and date format. New categories are previewed before import.
                    </FieldDescription>
                    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          id="bulk-csv"
                          className="max-w-xs"
                          type="file"
                          accept=".csv"
                          disabled={busyBulk}
                          onChange={(e) => {
                            setFile(e.target.files?.[0] || null);
                            resetBulkPreview();
                            setBulkFeedback(null);
                            setImportErrors(null);
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => void onPreviewImport()}
                          disabled={!file || busyBulk}
                        >
                          {bulkStep === "reading" ? "Reading…" : "Review import"}
                        </Button>
                      </div>
                      <Button type="button" variant="outline" onClick={() => void onDownloadTemplate()} disabled={busyBulk}>
                        Download template
                      </Button>
                    </div>
                  </Field>

                  {bulkStep !== "idle" ? (
                    <div className="flex flex-col gap-3 border border-parsel-border bg-parsel-soft/40 p-4">
                      <InlineProgress
                        label={BULK_PROGRESS[bulkStep].label}
                        value={BULK_PROGRESS[bulkStep].value}
                      />
                      <div className="flex flex-col gap-2">
                        <Marker role="status" aria-live="polite">
                          <MarkerIcon>
                            {bulkStep === "reading" ? (
                              <Loader2 className="size-4 animate-spin text-parsel-primary" />
                            ) : (
                              <FileSearch className="size-4 text-parsel-primary" />
                            )}
                          </MarkerIcon>
                          <MarkerContent>
                            {bulkStep === "reading"
                              ? "Reading file…"
                              : `Read file — ${previewValidRows} valid row${previewValidRows === 1 ? "" : "s"}`}
                          </MarkerContent>
                        </Marker>
                        {(bulkStep === "preview" ||
                          bulkStep === "creating" ||
                          bulkStep === "importing" ||
                          bulkStep === "done") && (
                          <Marker role="status" aria-live="polite">
                            <MarkerIcon>
                              {bulkStep === "creating" ? (
                                <Loader2 className="size-4 animate-spin text-parsel-primary" />
                              ) : (
                                <FolderPlus className="size-4 text-parsel-primary" />
                              )}
                            </MarkerIcon>
                            <MarkerContent>
                              {bulkStep === "creating"
                                ? `Creating ${previewNewCategories.length} categor${previewNewCategories.length === 1 ? "y" : "ies"}…`
                                : previewNewCategories.length
                                  ? `${previewNewCategories.length} new categor${previewNewCategories.length === 1 ? "y" : "ies"} to add`
                                  : "All categories already exist"}
                            </MarkerContent>
                          </Marker>
                        )}
                        {(bulkStep === "importing" || bulkStep === "done") && (
                          <Marker role="status" aria-live="polite">
                            <MarkerIcon>
                              {bulkStep === "importing" ? (
                                <Loader2 className="size-4 animate-spin text-parsel-primary" />
                              ) : (
                                <CheckCircle2 className="size-4 text-parsel-inflow" />
                              )}
                            </MarkerIcon>
                            <MarkerContent>
                              {bulkStep === "importing" ? "Importing transactions…" : "Import finished"}
                            </MarkerContent>
                          </Marker>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {bulkStep === "preview" && previewValidRows > 0 ? (
                    <div className="flex flex-col gap-3 border border-parsel-border p-4">
                      <div>
                        <p className="text-sm font-semibold text-parsel-neutral">Ready to import</p>
                        <p className="mt-1 text-sm text-parsel-muted">
                          {previewValidRows} valid row{previewValidRows === 1 ? "" : "s"}
                          {previewErrors.length
                            ? ` · ${previewErrors.length} row${previewErrors.length === 1 ? "" : "s"} will be skipped`
                            : ""}
                          .
                        </p>
                      </div>
                      {previewNewCategories.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary">
                            New categories
                          </p>
                          <p className="mt-1 text-sm text-parsel-muted">
                            These are not in your list yet and will be added if you continue:
                          </p>
                          <ul className="mt-2 list-disc pl-5 text-sm text-parsel-neutral">
                            {previewNewCategories.map((name) => (
                              <li key={name}>{name}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-sm text-parsel-muted">All categories in this file already exist.</p>
                      )}
                      {previewErrors.length > 0 ? (
                        <StatusAlert
                          variant="error"
                          title="Some rows have errors"
                          description={previewErrors.slice(0, 8).join("\n")}
                        />
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="ghost" onClick={resetBulkPreview}>
                          Cancel
                        </Button>
                        <Button type="button" onClick={() => void onConfirmImport()}>
                          Continue import
                        </Button>
                      </div>
                    </div>
                  ) : null}

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
