# Frontend

This directory contains the BCK Manager Web frontend application.

## Stack

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Zustand
- xterm.js

## Requirements

- Node.js 20.19+ or newer
- npm

## Development

```bash
npm install
npm run dev
```

The Vite dev server proxies API and WebSocket traffic to the backend.

## Validation

```bash
npx tsc --noEmit
npm run build
```

## Notes

- Authentication is cookie-based and handled by the backend.
- Fleet, logs, and terminal features depend on backend and WebSocket availability.
- This README is intentionally scoped to frontend development. For full project setup, use the root [README.md](../README.md).
