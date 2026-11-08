import type { GraphiQLOptions } from 'graphql-yoga'

/**
 * GraphiQL v6 no longer mirrors editor state into the page URL, but older
 * bookmarks (and Yoga's previous GraphiQL bundle) may still contain `?query=`.
 * Removing those parameters keeps the address bar clean on refresh without
 * touching the document that is stored in the editor.
 */
export const GRAPHIQL_URL_CLEANUP_SCRIPT = `(function () {
  try {
    var current = new URL(location.href);
    var changed = false;
    ['query', 'variables', 'operationName', 'extensions'].forEach(function (name) {
      if (current.searchParams.has(name)) {
        current.searchParams.delete(name);
        changed = true;
      }
    });
    if (changed) {
      history.replaceState(null, '', current.href);
    }
  } catch (error) {
    // URL cleanup is best effort; the editor still works without it.
  }
})();`

/** Make a value safe to embed inside a `<script>` element. */
function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const ASSET_BASE = '/assets'

const LOADING_MARKUP = `<div class="loading" role="status">
        <svg
          aria-hidden="true"
          width="64"
          height="64"
          xmlns="http://www.w3.org/2000/svg"
          fill="#4d148c"
          viewBox="0 0 400 400"
        >
          <path d="m57.468 302.66-14.376-8.3 160.15-277.38 14.376 8.3z" />
          <path d="M39.8 272.2h320.3v16.6H39.8z" />
          <path
            d="m206.348 374.026-160.21-92.5 8.3-14.376 160.21 92.5zm139.174-241.079-160.21-92.5 8.3-14.376 160.21 92.5z"
          />
          <path d="m54.482 132.883-8.3-14.375 160.21-92.5 8.3 14.376z" />
          <path
            d="m342.568 302.663-160.15-277.38 14.376-8.3 160.15 277.38zM52.5 107.5h16.6v185H52.5zm278.4 0h16.6v185h-16.6z"
          />
          <path d="m203.522 367-7.25-12.558 139.34-80.45 7.25 12.557z" />
          <path
            d="M369.5 297.9c-9.6 16.7-31 22.4-47.7 12.8s-22.4-31-12.8-47.7 31-22.4 47.7-12.8c16.8 9.7 22.5 31 12.8 47.7M90.9 137c-9.6 16.7-31 22.4-47.7 12.8s-22.4-31-12.8-47.7 31-22.4 47.7-12.8c16.7 9.7 22.4 31 12.8 47.7M30.5 297.9c-9.6-16.7-3.9-38 12.8-47.7 16.7-9.6 38-3.9 47.7 12.8 9.6 16.7 3.9 38-12.8 47.7-16.8 9.6-38.1 3.9-47.7-12.8M309.1 137c-9.6-16.7-3.9-38 12.8-47.7 16.7-9.6 38-3.9 47.7 12.8 9.6 16.7 3.9 38-12.8 47.7-16.7 9.6-38.1 3.9-47.7-12.8M200 395.8c-19.3 0-34.9-15.6-34.9-34.9S180.7 326 200 326s34.9 15.6 34.9 34.9c0 19.2-15.6 34.9-34.9 34.9M200 74c-19.3 0-34.9-15.6-34.9-34.9S180.7 4.2 200 4.2s34.9 15.6 34.9 34.9S219.3 74 200 74"
          />
        </svg>
        <span class="loading-status">Loading GraphiQL.</span>
      </div>`

/**
 * Render the GraphiQL v6 page. Every frontend module is served locally from
 * `/assets`, so the UI works without internet access. Operations are always
 * sent with POST so the editor never moves a query or mutation into the page URL.
 */
export function renderGraphiQLPage(options: GraphiQLOptions = {}): string {
  const title = escapeHtml(options.title ?? 'FedEx GraphQL')
  const endpoint = options.endpoint ?? '/graphql'
  const favicon = options.favicon
    ? `\n    <link rel="icon" href="${escapeHtml(options.favicon)}" />`
    : `\n    <link rel="icon" href="data:," />`

  const runtimeConfig = {
    endpoint,
    workers: {
      editor: `${ASSET_BASE}/workers/editor.worker.js`,
      json: `${ASSET_BASE}/workers/json.worker.js`,
      graphql: `${ASSET_BASE}/workers/graphql.worker.js`,
    },
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${title}</title>${favicon}
    <style>
      body {
        margin: 0;
      }

      #graphiql {
        height: 100dvh;
      }

      .loading {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
        color-scheme: light dark;
        background: Canvas;
        color: CanvasText;
        font:
          14px/1.5 system-ui,
          sans-serif;
      }

      .loading-status {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .loading-status::before {
        content: '';
        width: 14px;
        height: 14px;
        border: 2px solid #4d148c33;
        border-top-color: #ff6600;
        border-radius: 50%;
      }

      @media (prefers-reduced-motion: no-preference) {
        .loading-status::before {
          animation: graphiql-loading-spin 0.8s linear infinite;
        }
      }

      @keyframes graphiql-loading-spin {
        to {
          transform: rotate(360deg);
        }
      }
    </style>
    <link rel="stylesheet" href="${ASSET_BASE}/graphiql.css" />
    <script>window.__FEDEX_GRAPHIQL_CONFIG__ = ${serializeForScript(runtimeConfig)};</script>
    <script>${GRAPHIQL_URL_CLEANUP_SCRIPT}</script>
    <script type="module" src="${ASSET_BASE}/graphiql.js"></script>
  </head>
  <body>
    <div id="graphiql">
      ${LOADING_MARKUP}
    </div>
  </body>
</html>
`
}
