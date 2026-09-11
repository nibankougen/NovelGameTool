import { useEffect, useRef } from "react";

export function RenameInput({ initial, onCommit, onCancel }: { initial: string; onCommit: (v: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = (ok: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const v = ref.current?.value.trim() ?? "";
    if (ok && v) onCommit(v);
    else onCancel();
  };

  return (
    <input
      ref={ref}
      type="text"
      defaultValue={initial}
      className="w-full px-1.5 py-0.5 text-sm"
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") commit(true);
        if (e.key === "Escape") commit(false);
        e.stopPropagation();
      }}
      onBlur={() => commit(true)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
