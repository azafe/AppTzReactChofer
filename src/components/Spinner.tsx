export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-tz-yellow ${className}`}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border border-tz-red/30 bg-tz-red/5 p-6 text-center">
      <p className="text-sm text-tz-red">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-xl border border-tz-red/40 px-4 py-1.5 text-sm text-tz-red hover:bg-tz-red/10 transition-colors"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[20vh] items-center justify-center">
      <p className="text-sm text-[var(--muted)]">{message}</p>
    </div>
  );
}
