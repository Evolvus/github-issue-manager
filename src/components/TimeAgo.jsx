import React from "react";

export default function TimeAgo({ iso }) {
  if (!iso) return null;
  const date = new Date(iso);
  const now = new Date();
  const diff = now - date; // ms
  const minutes = Math.floor(diff / 60000);
  let text;
  if (minutes < 60) {
    text = `${minutes}m ago`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    text = `${hours}h ago`;
  } else {
    const days = Math.floor(minutes / 1440);
    text = `${days}d ago`;
  }
  return (
    <time dateTime={iso} title={date.toLocaleString()}>{text}</time>
  );
}
