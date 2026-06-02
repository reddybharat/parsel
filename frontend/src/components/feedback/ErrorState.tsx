export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry ? (
        <button className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white" onClick={onRetry} type="button">
          Retry
        </button>
      ) : null}
    </div>
  );
}
