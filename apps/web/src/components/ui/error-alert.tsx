export function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-red-200/90 bg-red-50 px-4 py-3.5 text-sm text-red-950"
    >
      <span className="shrink-0 text-base leading-none text-red-600" aria-hidden>
        !
      </span>
      <p>{message}</p>
    </div>
  );
}
