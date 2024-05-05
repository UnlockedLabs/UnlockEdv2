export function CloseX({ close }: { close: () => void }) {
  return (
    <form method="dialog">
      <button
        className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        onClick={() => close()}
      >
        ✕
      </button>
    </form>
  );
}
