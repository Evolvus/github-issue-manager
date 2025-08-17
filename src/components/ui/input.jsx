import React from "react";
export function Input({ className="", ...props }) {
  return <input className={`rounded-xl border dark:border-slate-600 px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 placeholder-gray-500 dark:placeholder-slate-400 ${className}`} {...props} />;
}
