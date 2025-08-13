import React from "react";
export function Input({ className="", ...props }) {
  return <input className={`rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 ${className}`} {...props} />;
}
