import React from "react";
export function Table({ children }) { return <table className="w-full text-sm">{children}</table>; }
export function TableHeader({ children }) { return <thead className="bg-gray-50">{children}</thead>; }
export function TableBody({ children }) { return <tbody className="divide-y">{children}</tbody>; }
export function TableRow({ children }) { return <tr className="border-b last:border-b-0">{children}</tr>; }
export function TableHead({ children }) { return <th className="text-left px-4 py-2 font-medium text-gray-600">{children}</th>; }
export function TableCell({ children, colSpan }) { return <td colSpan={colSpan} className="px-4 py-2 align-top">{children}</td>; }
