import React from "react";
export function Avatar({ className="", children, ...props }) {
  return (
    <div
      className={`rounded-full overflow-hidden bg-gray-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
export function AvatarImage({ src, alt="" }) {
  return <img src={src} alt={alt} className="w-full h-full object-cover" />;
}
export function AvatarFallback({ children }) {
  return <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">{children}</div>;
}
