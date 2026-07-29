import { FormEvent, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, FileSearch, Loader2, Upload } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { EmptyState } from "../components/feedback/EmptyState";
import { InlineProgress } from "../components/feedback/InlineProgress";
import { StatusAlert, type FeedbackMessage } from "../components/feedback/StatusAlert";
import { CategorySelect } from "../components/transactions/CategorySelect";
import { ImportReviewTable } from "../components/transactions/ImportReviewTable";
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
  collectApprovedNewCategories,
  isRowSelectable,
  recomputeRow,
  toEditableRow,
  toReviewedPayload,
  type EditableImportRow,
} from "@/lib/importReview";
import {
  invalidateTrackerConfig,
  trackerConfigQueryOptions,
} from "@/lib/trackerConfigQuery";
import {
  createTransaction,
  downloadImportTemplate,
  importReviewedTransactions,
  previewImportTransactions,
} from "../api/tracker";

const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-parsel-secondary";

type BulkStep = "idle" | "reading" | "preview" | "importing" | "done";

const BULK_PROGRESS: Record<Exclude<BulkStep, "idle">, { value: number; label: string }> = {
  reading: { value: 25, label: "Reading file…" },
  preview: { value: 50, label: "Preview ready" },
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
  const [bulkStep, setBulkStep] = useState<BulkStep>("idle");
  const [reviewRows, setReviewRows] = useState<EditableImportRow[]>([]);
  const [previewFileErrors, setPreviewFileErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setReviewRows([]);
    setPreviewFileErrors([]);
    setFileName(null);
    // Allow re-selecting the same file after a reset.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onFileSelected(next: File | null) {
    setBulkFeedback(null);
    setImportErrors(null);
    if (!next) {
      resetBulkPreview();
      return;
    }
    setFileName(next.name);
    void onPreviewImport(next);
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

  async function onPreviewImport(selectedFile: File) {
    setBulkFeedback(null);
    setImportErrors(null);
    setBulkStep("reading");
    try {
      const result = await previewImportTransactions(selectedFile);
      const editable = result.rows.map(toEditableRow).map((row) => recomputeRow(row, categories));
      setReviewRows(editable);
      setPreviewFileErrors(result.file_errors);
      setBulkStep("preview");
      if (result.file_errors.length) {
        setBulkFeedback({
          variant: "error",
          title: "Could not read file",
          description: result.file_errors.join("\n"),
        });
      } else if (editable.length === 0) {
        setBulkFeedback({
          variant: "error",
          title: "Nothing to import",
          description: "The CSV has no data rows.",
        });
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

  async function onConfirmImport(selected: EditableImportRow[]) {
    setBulkFeedback(null);
    setImportErrors(null);
    setBulkStep("importing");
    try {
      const payloads = selected.map(toReviewedPayload).filter((row) => row !== null);
      if (payloads.length === 0) {
        throw new Error("No valid rows selected for import.");
      }
      const approved = collectApprovedNewCategories(selected, categories);
      const result = await importReviewedTransactions({
        rows: payloads,
        approved_new_categories: approved,
      });
      if (result.errors.length) {
        setBulkStep("preview");
        setImportErrors(result.errors.join("\n"));
        setBulkFeedback({
          variant: "error",
          title: "Import failed",
          description: result.errors.join("\n"),
        });
        return;
      }
      void invalidateDashboardOverview();
      if (result.created_categories.length) {
        void invalidateTrackerConfig();
      }
      setBulkStep("done");
      const createdNote = result.created_categories.length
        ? ` Created ${result.created_categories.length} categor${result.created_categories.length === 1 ? "y" : "ies"}.`
        : "";
      const importedRows = new Set(selected.map((row) => row.source_row));
      setReviewRows((current) =>
        current.map((row) =>
          importedRows.has(row.source_row) ? { ...row, imported: true } : row,
        ),
      );
      setBulkFeedback({
        variant: "success",
        title: "Import complete",
        description: `Imported ${result.inserted} transaction(s).${createdNote} Remaining rows stay here until you leave this screen.`,
      });
    } catch (err) {
      setBulkStep("preview");
      setBulkFeedback({
        variant: "error",
        title: "Import failed",
        description: err instanceof Error ? err.message : "CSV import failed.",
      });
    }
  }

  const busyBulk = bulkStep === "reading" || bulkStep === "importing";
  const readyCount = reviewRows.filter(isRowSelectable).length;
  const reviewActive = bulkStep !== "idle" && bulkStep !== "reading" && reviewRows.length > 0;

  useEffect(() => {
    if (reviewRows.length === 0) return;
    setReviewRows((current) => current.map((row) => recomputeRow(row, categories)));
  }, [categories]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-1.5",
        // During review the table body owns the only scrollbar; otherwise the page scrolls.
        reviewActive ? "overflow-hidden" : "overflow-y-auto",
      )}
    >
      {feedback ? <StatusAlert {...feedback} onDismiss={() => setFeedback(null)} /> : null}
      {configError ? (
        <StatusAlert
          variant="error"
          title="Failed to load configuration"
          description={configErr instanceof Error ? configErr.message : "Failed to load tracker config."}
        />
      ) : null}

      {loadingConfig ? (
        <div className="w-full rounded-none border border-parsel-border bg-parsel-soft p-4">
          <InlineProgress label="Loading categories & payment methods…" />
        </div>
      ) : null}

      {!loadingConfig && categories.length === 0 ? (
        <EmptyState title="No categories available" detail="Configure tracker categories before adding transactions." />
      ) : null}

      {!loadingConfig && categories.length > 0 ? (
        <div
          className={cn(
            "w-full rounded-none border border-parsel-border bg-parsel-surface shadow-none",
            reviewActive && "flex min-h-0 flex-1 flex-col",
          )}
        >
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as "manual" | "bulk")}
            className={cn(reviewActive && "flex min-h-0 flex-1 flex-col")}
          >
            <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 rounded-none border-b border-parsel-border bg-transparent p-0">
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
            <TabsContent
              className={cn("mt-0", reviewActive && "flex min-h-0 flex-1 flex-col")}
              value="bulk"
            >
              <section
                className={cn("p-6 md:p-8", reviewActive && "flex min-h-0 flex-1 flex-col")}
              >
                <FieldGroup className={cn(reviewActive && "min-h-0 flex-1 gap-4")}>
                  {reviewActive ? null : (
                    <Field>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <FieldLabel htmlFor="bulk-csv" className={fieldLabelClass}>
                          CSV File
                        </FieldLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-parsel-primary hover:bg-parsel-soft"
                          onClick={() => void onDownloadTemplate()}
                          disabled={busyBulk}
                        >
                          <Download className="size-3.5" aria-hidden />
                          Download template
                        </Button>
                      </div>
                      <FieldDescription>
                        Rows are parsed on upload so you can review and fix them before importing.
                      </FieldDescription>
                      <input
                        id="bulk-csv"
                        ref={fileInputRef}
                        className="peer sr-only"
                        type="file"
                        accept=".csv"
                        disabled={busyBulk}
                        onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
                      />
                      <label
                        htmlFor="bulk-csv"
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!busyBulk) setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                          if (busyBulk) return;
                          onFileSelected(e.dataTransfer.files?.[0] || null);
                        }}
                        className={cn(
                          "flex flex-wrap items-center gap-3 border border-dashed border-parsel-border bg-parsel-soft/40 p-4 transition-colors",
                          "peer-focus-visible:ring-2 peer-focus-visible:ring-parsel-primary peer-focus-visible:ring-offset-2",
                          busyBulk
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer hover:border-parsel-primary hover:bg-parsel-soft",
                          dragActive && "border-parsel-primary bg-parsel-soft",
                        )}
                      >
                        <span className="inline-flex h-9 shrink-0 items-center gap-2 bg-parsel-primary px-3 text-xs font-semibold uppercase tracking-wide text-white">
                          <Upload className="size-3.5" aria-hidden />
                          Choose CSV
                        </span>
                        <span className="min-w-0 truncate text-xs text-parsel-muted">
                          {fileName ?? "or drop a .csv file here"}
                        </span>
                      </label>
                    </Field>
                  )}

                  {bulkStep !== "idle" ? (
                    <div className="flex shrink-0 flex-col gap-3 border border-parsel-border bg-parsel-soft/40 p-4">
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
                              : `Read file — ${reviewRows.length} row${reviewRows.length === 1 ? "" : "s"} · ${readyCount} ready`}
                          </MarkerContent>
                        </Marker>
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

                  {reviewActive ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-2 border border-parsel-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-parsel-neutral">
                            Review before import
                            {fileName ? (
                              <span className="ml-2 font-normal text-parsel-muted">{fileName}</span>
                            ) : null}
                          </p>
                          <p className="mt-1 text-sm text-parsel-muted">
                            Fix flagged fields inline, verify categories, then import selected rows into your ledger.
                            Imported rows stay listed here and are locked.
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={resetBulkPreview}
                            disabled={busyBulk}
                          >
                            Upload another file
                          </Button>
                          <Button asChild type="button" variant="outline">
                            <Link to="/ledger/search">View ledger</Link>
                          </Button>
                        </div>
                      </div>
                      <ImportReviewTable
                        rows={reviewRows}
                        categories={categories}
                        paymentMethods={paymentMethods}
                        onRowsChange={setReviewRows}
                        onImport={(selected) => void onConfirmImport(selected)}
                        importing={bulkStep === "importing"}
                      />
                    </div>
                  ) : null}

                  {previewFileErrors.length > 0 ? (
                    <StatusAlert
                      variant="error"
                      title="File errors"
                      description={previewFileErrors.join("\n")}
                    />
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
