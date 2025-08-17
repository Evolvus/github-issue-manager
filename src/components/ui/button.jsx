import React from "react";
export function Button({ children, className="", ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 hover:opacity-90 disabled:opacity-50 transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
