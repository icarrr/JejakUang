"use client";

import { useState } from "react";

/** Amount input: only digits, keeps caret stable. */
export default function MoneyInput({
  name,
  defaultValue = "",
  required = false,
  autoFocus = false,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-neutral-400">
        Rp
      </span>
      <input
        name={name}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        required={required}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
        placeholder="0"
        className="w-full rounded-lg border border-neutral-300 py-2.5 pl-10 pr-3 text-lg font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </div>
  );
}