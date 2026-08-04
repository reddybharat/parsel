import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, Loader2, Plus, Upload } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/feedback/EmptyState";
import { InlineProgress } from "../components/feedback/InlineProgress";
import { StatusAlert, type FeedbackMessage } from "../components/feedback/StatusAlert";
import { ImportReviewTable } from "../components/transactions/ImportReviewTable";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { cn } from "@/lib/utils";
import { invalidateDashboardOverview } from "@/lib/dashboardQuery";
import {
  collectApprovedNewCategories,
  createManualRow,
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

export function AddPage() {
  const {
    data: trackerConfig,
    isPending: loadingConfig,
    isError: configError,
    error: configErr,
  } = useQuery(trackerConfigQueryOptions());
  const categories = trackerConfig?.categories ?? [];
  const paymentMethods = trackerConfig?.payment_methods ?? [];
  const banks = trackerConfig?.banks ?? [];
  const [bulkFeedback, setBulkFeedback] = useState<FeedbackMessage | null>(null);
  const [bulkStep, setBulkStep] = useState<BulkStep>("idle");
  const [reviewRows, setReviewRows] = useState<EditableImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importBank, setImportBank] = useState("");
  const [filePassword, setFilePassword] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Lets the stable row callbacks below read the latest rows without re-creating themselves.
  const reviewRowsRef = useRef(reviewRows);
  reviewRowsRef.current = reviewRows;

  const resetBulkPreview = useCallback(() => {
    setBulkStep("idle");
    setReviewRows([]);
    setFileName(null);
    setPendingFile(null);
    // Allow re-selecting the same file after a reset.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  function onFileSelected(next: File | null) {
    setBulkFeedback(null);
    if (!next) {
      setPendingFile(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!importBank) {
      setBulkFeedback({
        variant: "error",
        title: "Bank required",
        description: "Select a bank before uploading a file.",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPendingFile(next);
    setFileName(next.name);
  }

  function onStartFileImport() {
    if (!pendingFile) {
      setBulkFeedback({
        variant: "error",
        title: "No file selected",
        description: "Choose a CSV or Excel file first.",
      });
      return;
    }
    if (!importBank) {
      setBulkFeedback({
        variant: "error",
        title: "Bank required",
        description: "Select a bank before importing.",
      });
      return;
    }
    void onPreviewImport(pendingFile);
  }

  function onAddManualRow() {
    setBulkFeedback(null);
    if (!importBank) {
      setBulkFeedback({
        variant: "error",
        title: "Bank required",
        description: "Select a bank before adding transactions.",
      });
      return;
    }
    setReviewRows((current) => {
      // Continue the numbering already on screen so typed rows read 1, 2, 3… on their own,
      // and pick up after the last CSV line when mixed with an uploaded file.
      const nextRow = current.reduce((max, row) => Math.max(max, row.source_row), 0) + 1;
      return [
        ...current,
        recomputeRow(createManualRow(nextRow, { bank: importBank }), categories, banks),
      ];
    });
    setBulkStep((step) => (step === "importing" ? step : "preview"));
  }

  const onRemoveRow = useCallback(
    (sourceRow: number) => {
      const next = reviewRowsRef.current.filter((row) => row.source_row !== sourceRow);
      setReviewRows(next);
      if (next.length === 0) resetBulkPreview();
    },
    [resetBulkPreview],
  );

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
    setBulkStep("reading");
    try {
      const result = await previewImportTransactions(selectedFile, {
        bank: importBank,
        password: filePassword,
      });
      if (result.file_errors.length) {
        setReviewRows([]);
        setBulkStep("idle");
        setBulkFeedback({
          variant: "error",
          title: "Could not read file",
          description: result.file_errors.join("\n"),
        });
        // Keep the file name visible; clear the input so the same file can be re-chosen after password.
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const editable = result.rows
        .map(toEditableRow)
        .map((row) => recomputeRow(row, categories, banks));
      setReviewRows(editable);
      setBulkStep("preview");
      if (editable.length === 0) {
        setBulkFeedback({
          variant: "error",
          title: "Nothing to import",
          description: "The file has no data rows.",
        });
      }
    } catch (err) {
      resetBulkPreview();
      setBulkFeedback({
        variant: "error",
        title: "Could not read file",
        description: err instanceof Error ? err.message : "File preview failed.",
      });
    }
  }

  async function onConfirmImport(selected: EditableImportRow[]) {
    setBulkFeedback(null);
    setBulkStep("importing");
    try {
      const payloads = selected
        .map((row) => toReviewedPayload(row, banks))
        .filter((row) => row !== null);
      if (payloads.length === 0) {
        throw new Error("No valid rows selected for import.");
      }
      const approved = collectApprovedNewCategories(selected);
      const result = await importReviewedTransactions({
        rows: payloads,
        approved_new_categories: approved,
      });
      if (result.errors.length) {
        setBulkStep("preview");
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
      const skippedNote = result.skipped_duplicates
        ? ` Skipped ${result.skipped_duplicates} duplicate${result.skipped_duplicates === 1 ? "" : "s"}.`
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
        description: `Imported ${result.inserted} transaction(s).${skippedNote}${createdNote} Remaining rows stay here until you leave this screen.`,
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
    setReviewRows((current) => current.map((row) => recomputeRow(row, categories, banks)));
  }, [banks, categories]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-1.5",
        // During review the table body owns the only scrollbar; otherwise the page scrolls.
        reviewActive ? "overflow-hidden" : "overflow-y-auto",
      )}
    >
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
        <EmptyState title="No categories available" detail="Configure tracker categories before importing transactions." />
      ) : null}

      {!loadingConfig && categories.length > 0 ? (
        <div
          className={cn(
            "w-full rounded-none border border-parsel-border bg-parsel-surface shadow-none",
            reviewActive && "flex min-h-0 flex-1 flex-col",
          )}
        >
          <div className="border-b border-parsel-border px-6 py-4">
            <h1 className="text-sm font-semibold uppercase tracking-wide text-parsel-neutral">
              Add transactions
            </h1>
            <p className="mt-1 text-xs text-parsel-muted">
              {reviewActive
                ? "Nothing is saved until you import. Fill categories, fix red fields, then import selected rows."
                : "Choose a bank, then type rows or upload a file — you always review before saving."}
            </p>
          </div>
          <section className={cn("p-6 md:p-8", reviewActive && "flex min-h-0 flex-1 flex-col")}>
            <FieldGroup className={cn(reviewActive && "min-h-0 flex-1 gap-4")}>
              {reviewActive ? null : (
                <>
                  <Field>
                    <FieldLabel htmlFor="import-bank" className={fieldLabelClass}>
                      1 · Bank
                    </FieldLabel>
                    <FieldDescription>
                      Required. Tags every row you add or upload.
                    </FieldDescription>
                    <NativeSelect
                      id="import-bank"
                      value={importBank}
                      onChange={(e) => {
                        setImportBank(e.target.value);
                        setBulkFeedback(null);
                      }}
                      disabled={busyBulk}
                      required
                      className="max-w-xs"
                    >
                      <NativeSelectOption value="">Select bank</NativeSelectOption>
                      {banks.map((item) => (
                        <NativeSelectOption key={item} value={item}>
                          {item}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>

                  <div
                    className={cn(
                      "flex flex-col gap-5 border border-parsel-border p-4",
                      !importBank && "opacity-60",
                    )}
                  >
                    <div className="min-w-0">
                      <p className={fieldLabelClass}>2 · Add rows</p>
                      <p className="mt-1 text-xs text-parsel-muted">
                        {importBank
                          ? "Pick one path — type manually, or upload a file."
                          : "Select a bank above to continue."}
                      </p>
                    </div>

                    <Field>
                      <FieldLabel className={fieldLabelClass}>Type manually</FieldLabel>
                      <FieldDescription>
                        Opens a blank row in the review table. Add as many as you need.
                      </FieldDescription>
                      <div>
                        <Button
                          type="button"
                          className="w-fit gap-1.5"
                          onClick={onAddManualRow}
                          disabled={busyBulk || !importBank}
                        >
                          <Plus className="size-4" aria-hidden />
                          Add blank row
                        </Button>
                      </div>
                    </Field>

                    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-parsel-muted">
                      <span className="h-px flex-1 bg-parsel-border" />
                      or upload a file
                      <span className="h-px flex-1 bg-parsel-border" />
                    </div>

                    <Field>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <FieldLabel htmlFor="bulk-csv" className={fieldLabelClass}>
                          CSV, Excel, or PDF
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
                          Download CSV Template
                        </Button>
                      </div>

                      <div className="mb-3 max-w-xs">
                        <label
                          htmlFor="file-password"
                          className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-parsel-muted"
                        >
                          File password (if locked)
                        </label>
                        <Input
                          id="file-password"
                          type="password"
                          autoComplete="off"
                          value={filePassword}
                          onChange={(e) => setFilePassword(e.target.value)}
                          disabled={busyBulk || !importBank}
                          placeholder="Optional"
                        />
                      </div>

                      <input
                        id="bulk-csv"
                        ref={fileInputRef}
                        className="peer sr-only"
                        type="file"
                        accept=".csv,.xlsx,.pdf"
                        disabled={busyBulk || !importBank}
                        onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
                      />
                      <label
                        htmlFor="bulk-csv"
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!busyBulk && importBank) setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                          if (busyBulk || !importBank) return;
                          onFileSelected(e.dataTransfer.files?.[0] || null);
                        }}
                        className={cn(
                          "flex flex-wrap items-center gap-3 border border-dashed border-parsel-border bg-parsel-soft/40 p-4 transition-colors",
                          "peer-focus-visible:ring-2 peer-focus-visible:ring-parsel-primary peer-focus-visible:ring-offset-2",
                          busyBulk || !importBank
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer hover:border-parsel-primary hover:bg-parsel-soft",
                          dragActive && "border-parsel-primary bg-parsel-soft",
                        )}
                      >
                        <span className="inline-flex h-9 shrink-0 items-center gap-2 bg-parsel-primary px-3 text-xs font-semibold uppercase tracking-wide text-white">
                          <Upload className="size-3.5" aria-hidden />
                          Choose file
                        </span>
                        <span className="min-w-0 truncate text-xs text-parsel-muted">
                          {fileName ?? "Drop .csv, .xlsx, or .pdf here"}
                        </span>
                      </label>
                      <div className="mt-3">
                        <Button
                          type="button"
                          className="w-fit gap-1.5"
                          onClick={onStartFileImport}
                          disabled={busyBulk || !importBank || !pendingFile}
                        >
                          <Upload className="size-4" aria-hidden />
                          Import
                        </Button>
                      </div>
                    </Field>
                  </div>
                </>
              )}

              {bulkStep === "reading" ? (
                <div className="flex shrink-0 flex-col gap-3 border border-parsel-border bg-parsel-soft/40 p-4">
                  <InlineProgress
                    label={BULK_PROGRESS.reading.label}
                    value={BULK_PROGRESS.reading.value}
                  />
                  <Marker role="status" aria-live="polite">
                    <MarkerIcon>
                      <Loader2 className="size-4 animate-spin text-parsel-primary" />
                    </MarkerIcon>
                    <MarkerContent>
                      Reading {fileName ?? "file"}…
                    </MarkerContent>
                  </Marker>
                </div>
              ) : null}

              {reviewActive ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3 border border-parsel-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-parsel-neutral">
                        Review · {importBank || "Bank"}
                        {fileName ? (
                          <span className="ml-2 font-normal text-parsel-muted">{fileName}</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-parsel-muted">
                        {readyCount === 0
                          ? "Set a category on each row (required). Red fields need a fix before you can import."
                          : `${readyCount} row${readyCount === 1 ? "" : "s"} ready — select what to keep, then import.`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-1.5"
                        onClick={onAddManualRow}
                        disabled={busyBulk}
                      >
                        <Plus className="size-4" aria-hidden />
                        Add row
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={resetBulkPreview}
                        disabled={busyBulk}
                      >
                        Start over
                      </Button>
                      {(bulkStep === "importing" || bulkStep === "done") && (
                        <Button asChild type="button" variant="outline">
                          <Link to="/ledger/search">View ledger</Link>
                        </Button>
                      )}
                    </div>
                  </div>

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
                        {bulkStep === "importing" ? "Importing selected rows…" : "Import finished — imported rows are locked below."}
                      </MarkerContent>
                    </Marker>
                  )}

                  <ImportReviewTable
                    rows={reviewRows}
                    categories={categories}
                    banks={banks}
                    paymentMethods={paymentMethods}
                    onRowsChange={setReviewRows}
                    onImport={(selected) => void onConfirmImport(selected)}
                    onRemoveRow={onRemoveRow}
                    importing={bulkStep === "importing"}
                  />
                </div>
              ) : null}

              {bulkFeedback ? <StatusAlert {...bulkFeedback} onDismiss={() => setBulkFeedback(null)} /> : null}
            </FieldGroup>
          </section>
        </div>
      ) : null}
    </div>
  );
}
