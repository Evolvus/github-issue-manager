import React, { createContext, useContext, useState } from "react";
const TabsCtx = createContext(null);
export function Tabs({ defaultValue, children }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsCtx.Provider value={{ value, setValue }}>{children}</TabsCtx.Provider>;
}
export function TabsList({ children, className="" }) {
  return <div className={`inline-grid gap-2 bg-gray-100 p-1 rounded-2xl ${className}`}>{children}</div>;
}
export function TabsTrigger({ value, children }) {
  const { value: v, setValue } = useContext(TabsCtx);
  const active = v === value;
  return (
    <button
      onClick={() => setValue(value)}
      className={`px-3 py-2 rounded-xl text-sm ${active ? "bg-white shadow font-semibold" : "text-gray-600"}`}
    >
      {children}
    </button>
  );
}
export function TabsContent({ value, children, className="" }) {
  const { value: v } = useContext(TabsCtx);
  return v === value ? <div className={className}>{children}</div> : null;
}
