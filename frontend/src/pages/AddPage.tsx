import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, FileSearch, Loader2, Plus, Upload } from "lucide-react";
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
  const [bulkFeedback, setBulkFeedback] = useState<FeedbackMessage | null>(null);
  const [importErrors, setImportErrors] = useState<string | null>(null);
  const [bulkStep, setBulkStep] = useState<BulkStep>("idle");
  const [reviewRows, setReviewRows] = useState<EditableImportRow[]>([]);
  const [previewFileErrors, setPreviewFileErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Lets the stable row callbacks below read the latest rows without re-creating themselves.
  const reviewRowsRef = useRef(reviewRows);
  reviewRowsRef.current = reviewRows;

  const resetBulkPreview = useCallback(() => {
    setBulkStep("idle");
    setReviewRows([]);
    setPreviewFileErrors([]);
    setFileName(null);
    // Allow re-selecting the same file after a reset.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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

  function onAddManualRow() {
    setBulkFeedback(null);
    setImportErrors(null);
    setReviewRows((current) => {
      // Continue the numbering already on screen so typed rows read 1, 2, 3… on their own,
      // and pick up after the last CSV line when mixed with an uploaded file.
      const nextRow = current.reduce((max, row) => Math.max(max, row.source_row), 0) + 1;
      return [...current, recomputeRow(createManualRow(nextRow), categories)];
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
      const approved = collectApprovedNewCategories(selected);
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
            <h1 className="text-sm font-semibold uppercase tracking-wide text-parsel-neutral">Add Transactions</h1>
            <p className="mt-1 text-xs text-parsel-muted">
              Type transactions one at a time or upload a CSV, review them together, then import in one go.
            </p>
          </div>
          <section className={cn("p-6 md:p-8", reviewActive && "flex min-h-0 flex-1 flex-col")}>
            <FieldGroup className={cn(reviewActive && "min-h-0 flex-1 gap-4")}>
              {reviewActive ? null : (
                <>
                <Field>
                  <FieldLabel className={fieldLabelClass}>Enter manually</FieldLabel>
                  <FieldDescription>
                    Add a blank row and type the details. Add as many as you need before importing.
                  </FieldDescription>
                  <Button
                    type="button"
                    className="w-fit gap-1.5"
                    onClick={onAddManualRow}
                    disabled={busyBulk}
                  >
                    <Plus className="size-4" aria-hidden />
                    Add transaction
                  </Button>
                </Field>

                <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-parsel-muted">
                  <span className="h-px flex-1 bg-parsel-border" />
                  or
                  <span className="h-px flex-1 bg-parsel-border" />
                </div>

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
                </>
              )}

              {bulkStep !== "idle" && (fileName !== null || bulkStep === "importing" || bulkStep === "done") ? (
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
                          : `${fileName ? "Read file — " : ""}${reviewRows.length} row${reviewRows.length === 1 ? "" : "s"} · ${readyCount} ready`}
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
                    onRemoveRow={onRemoveRow}
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
        </div>
      ) : null}
    </div>
  );
}
