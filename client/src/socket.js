import { io } from 'socket.io-client';

// No URL = connect to the same origin. In dev, Vite proxies /socket.io to the backend;
// in production, the Express server serves the page, so it's the same server.
export const socket = io({
  // A function is re-run on every (re)connect, so it always reads the latest saved player.
  auth: (cb) => {
    try {
      cb({ playerId: JSON.parse(localStorage.getItem('bday_trivia_player'))?.id ?? null });
    } catch {
      cb({ playerId: null });
    }
  }
});