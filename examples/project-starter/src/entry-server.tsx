import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { App } from './App';

export function render(store: any, url: string) {
  return ReactDOMServer.renderToString(
    <React.StrictMode>
      <App store={store} url={url} />
    </React.StrictMode>
  );
}
