import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('shows instructions before data is loaded', () => {
  const html = renderToString(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  expect(html).toContain('Enter your organization and token above, then click');
});
