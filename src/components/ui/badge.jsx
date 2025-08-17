import React from "react";
export function Badge({ children, variant="default", className="", style, ...props }) {
  // If style prop is provided (for GitHub label colors), don't apply variant styles
  if (style) {
    return (
      <span 
        className={`inline-flex items-center text-xs px-2 py-1 rounded-xl ${className}`}
        style={style}
        {...props}
      >
        {children}
      </span>
    );
  }
  
  // Otherwise, apply variant styles
  const styles = variant === "secondary"
    ? "bg-gray-100 dark:bg-slate-600 text-gray-900 dark:text-slate-200"
    : variant === "outline"
      ? "border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300"
      : "bg-black dark:bg-white text-white dark:text-black";
  return (
    <span 
      className={`inline-flex items-center text-xs px-2 py-1 rounded-xl ${styles} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
