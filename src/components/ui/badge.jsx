import React from "react";
export function Badge({ children, variant="default", className="" }) {
  const styles = variant === "secondary"
    ? "bg-gray-100 text-gray-900"
    : variant === "outline"
      ? "border border-gray-300 text-gray-700"
      : "bg-black text-white";
  return <span className={`inline-flex items-center text-xs px-2 py-1 rounded-xl ${styles} ${className}`}>{children}</span>;
}
