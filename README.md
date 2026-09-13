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

Each player draws once per round. The drawer has 15 seconds to pick one of three words; the server picks automatically if they don't choose. Guessers earn 100–500 points based on speed. The drawer earns 75 points per successful guess. Correct guesses are hidden from other guessers. The turn ends when time runs out or all guessers solve it. A five-second reveal separates turns. The host can start another game after the final leaderboard.

Canvas coordinates are normalized for differently sized screens, with eight colors, four brush sizes, an eraser, and a clear tool. Late joiners receive the existing canvas. A disconnected player is removed, host ownership transfers automatically, and the game returns to its lobby if fewer than two players remain. Rejoining creates a new player and does not restore their score.

## Persistence and deployment

The Node server is the game authority, including word secrets, timers, validation, and scoring. Rooms live in memory. Optional `REDIS_URL` mirrors public room snapshots with a one-hour expiry; Redis is not used for recovery or multi-server coordination. Optional `DATABASE_URL` creates a `games` table and saves final scores to PostgreSQL. Set these variables in the process environment (for example with your hosting provider); Next.js also loads `.env.local` during preparation. See `.env.example`.

Deploy as a long-running Node service with WebSocket support, one server instance, and a reverse proxy configured for Socket.IO. This custom server is not suitable for serverless-only hosting. Server restarts clear live rooms. Add authentication, distributed game ownership, reconnection tokens, and durable recovery before scaling beyond one instance. No external assets are needed for drawings; Google Fonts are optional, with system fallbacks.
