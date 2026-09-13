# Doodle Club

A real-time multiplayer drawing and guessing game built with Next.js, React, and Socket.IO.

## Run

Requires Node.js 20.9 or later.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Open a second browser tab to play as another person. Freeplay pairs available players automatically; private rooms use a six-character code or copied invite link. A private room host starts the game with at least two players.

```sh
npm test
# With the game server running:
npm run test:multiplayer
npm run build
npm start
```

## Game rules

Each player draws once per round. The drawer has 15 seconds to pick one of three words; the server picks automatically if they don't choose. Guessers earn 1–10 points based on speed. Correct guesses are hidden from other guessers. The turn ends when time runs out or all guessers solve it. A five-second reveal separates turns. The host can start another game after the final leaderboard. Private rooms can also enable Truth or Dare, where the winner chooses one prompt from two truth and two dare options for the lowest scorer to answer.

Canvas coordinates are normalized for differently sized screens, with eight colors, four brush sizes, an eraser, and a clear tool. Late joiners receive the existing canvas. A disconnected player is removed, host ownership transfers automatically, and the game returns to its lobby if fewer than two players remain. Rejoining creates a new player and does not restore their score.

## Persistence and deployment

The Node server is the game authority, including word secrets, timers, validation, and scoring. Rooms live in memory. Optional `REDIS_URL` mirrors public room snapshots with a one-hour expiry; Redis is not used for recovery or multi-server coordination. Optional `DATABASE_URL` creates a `games` table and saves final scores to PostgreSQL. Set these variables in the process environment (for example with your hosting provider); Next.js also loads `.env.local` during preparation. See `.env.example`.

Deploy as a long-running Node service with WebSocket support, one server instance, and a reverse proxy configured for Socket.IO. This custom server is not suitable for serverless-only hosting. Server restarts clear live rooms. Add authentication, distributed game ownership, reconnection tokens, and durable recovery before scaling beyond one instance. No external assets are needed for drawings; Google Fonts are optional, with system fallbacks.

## Fix `/socket.io` 404 on Vercel

The default Vercel Next.js deployment serves the frontend but does not run this project's custom `server/index.mjs`. The client previously connected to its own origin, so it requested a nonexistent Socket.IO endpoint on Vercel. Deploy this stateful game server separately; changing the transport to WebSocket alone will not create the missing endpoint.

1. Push these changes to your repository. Create a **Node Web Service** on Render from the same repository (or use the included `render.yaml` Blueprint).
2. Use **Build Command:** `npm ci` and **Start Command:** `npm run start:server`. Set `CLIENT_ORIGINS=https://game-psi-blond.vercel.app`. Run one instance. Add any custom domain or preview origin explicitly, separated by commas, without trailing slashes. Use a service configuration that stays running if uninterrupted games are required.
3. Confirm `https://YOUR-SERVER.onrender.com/health` returns `{"status":"ok"}`.
4. In Vercel → Project → Settings → Environment Variables, add `NEXT_PUBLIC_GAME_SERVER_URL=https://YOUR-SERVER.onrender.com` for Production (and Preview if needed). Use the server's actual HTTPS origin, without `/socket.io`.
5. **Redeploy the Vercel frontend.** `NEXT_PUBLIC_` values are embedded during the build, so changing the variable without redeploying will not update the client.
6. In browser Network tools, Socket.IO requests should now target the game server and succeed. Test with two browser tabs. If you get a CORS error, check `CLIENT_ORIGINS` on the game server against the exact frontend origin.

The standalone command skips Next.js preparation entirely; no frontend build is needed on the game server. Existing local `npm run dev` and combined `npm start` continue to work without `NEXT_PUBLIC_GAME_SERVER_URL`. Keep Redis and PostgreSQL connection strings on the backend only. The database services are optional and do not fix a missing Socket.IO endpoint.
