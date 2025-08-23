import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Navigation from './Navigation';

test('renders all navigation links with correct paths', () => {
  const html = renderToString(
    <MemoryRouter>
      <Navigation />
    </MemoryRouter>
  );

  const expected = [
    'href="/"',
    'href="/by-assignee"',
    'href="/by-tags"',
    'href="/project-board"',
    'href="/sprints"',
    'href="/all-issues"'
  ];

  for (const href of expected) {
    expect(html).toContain(href);
  }
});
