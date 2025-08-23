import React from 'react';
import { renderToString } from 'react-dom/server';
import { vi } from 'vitest';
import TimeAgo from './TimeAgo';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});

test('shows minutes for times less than an hour', () => {
  const html = renderToString(<TimeAgo iso="2023-12-31T23:55:00Z" />);
  expect(html).toContain('5m ago');
});

test('shows hours for times less than a day', () => {
  const html = renderToString(<TimeAgo iso="2023-12-31T22:00:00Z" />);
  expect(html).toContain('2h ago');
});

test('shows days for times greater than a day', () => {
  const html = renderToString(<TimeAgo iso="2023-12-30T00:00:00Z" />);
  expect(html).toContain('2d ago');
});
