# Star Byte — starter pack

This is the first implementation slice for your IRC-based private chat platform.

## What is already here

- Fastify + TypeScript backend
- SQLite bootstrap with `better-sqlite3`
- JWT auth
- chat + message tables
- default `#general` style room
- WebSocket live message broadcast
- React + Vite + PWA frontend
- login / register UI
- chat list + message list + send message UI
- service worker update prompt
- IRC bridge **stub** so you can wire Ergo next without rewriting the app layer

## What is not wired yet

- real IRC connection to Ergo
- file uploads
- embeds
- custom emoji
- reply UI
- mentions parser
- moderation
- voice / P2P privacy mode

## Recommended runtime

Use **Node 22 LTS** so you stay comfortably inside current Vite requirements and avoid random toolchain pain.

## First run

```bash
cp apps/server/.env.example apps/server/.env
npm install
npm run dev
```

- backend: `http://localhost:3001`
- frontend: `http://localhost:5173`

## Suggested next implementation order

1. Wire the IRC bridge to Ergo
2. Add file uploads
3. Add reply + mention metadata to messages
4. Add room creation / member invites
5. Add embed preview worker
6. Add custom emoji packs

## Notes

The backend stores messages in SQLite first and broadcasts them over WebSocket.
The IRC bridge is currently a no-op adapter. That is deliberate: it lets you build the app layer cleanly before binding it to a specific IRC server behavior.
