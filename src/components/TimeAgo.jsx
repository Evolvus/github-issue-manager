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
  } else if (minutes < 10080) { // < 7 days
    const days = Math.floor(minutes / 1440);
    text = `${days}d ago`;
  } else if (minutes < 43800) { // < ~1 month (30.4 days)
    const weeks = Math.floor(minutes / 10080);
    text = `${weeks}w ago`;
  } else {
    const months = Math.floor(minutes / 43800);
    text = `${months}mo ago`;
  }
  return (
    <time dateTime={iso} title={date.toLocaleString()}>{text}</time>
  );
}
