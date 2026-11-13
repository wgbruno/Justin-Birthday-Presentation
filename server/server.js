import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

import questions from './questions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server); // same origin in dev (Vite proxy) and prod, so no CORS needed
const PORT = process.env.PORT;

if (!PORT) throw new Error('PORT is not defined');

// Serve the built React app. Adjust the path if your folders differ.
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.use((_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

const RESULTS_DELAY_MS = 6000; // how long the results screen shows before the next question

const players = new Map();
let hostId = null;
let gameState = 'lobby'; // lobby | question | results | finished
let currentQuestionIndex = -1;
let questionStartedAt = 0;
let questionTimer = null;
let lastEnded = null; // the last question_ended payload, replayed to reconnecting players

// playerId -> { answerIndex, points } for the current question
const answers = new Map();

const playerList = () => Array.from(players.values());
const broadcastLobby = () => io.emit('lobby_updated', { players: playerList(), hostId });

// Indexes of the right answer(s). A question with allCorrect: true accepts any option.
const correctIndexes = (q) => (q.allCorrect ? q.options.map((_, i) => i) : [q.correctAnswer]);

const buildLeaderboard = () =>
  playerList()
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      roundPoints: answers.get(p.id)?.points || 0
    }))
    .sort((a, b) => b.score - a.score);

// What clients receive about the current question. Never includes the answer.
function questionPayload() {
  const q = questions[currentQuestionIndex];
  return {
    question: { id: q.id, text: q.text, options: q.options, timeLimit: q.timeLimit },
    questionNumber: currentQuestionIndex + 1,
    totalQuestions: questions.length,
    remainingMs: Math.max(0, questionStartedAt + q.timeLimit * 1000 - Date.now())
  };
}

function startQuestion() {
  const q = questions[currentQuestionIndex];
  gameState = 'question';
  answers.clear();
  questionStartedAt = Date.now();

  io.emit('question_started', questionPayload());
  questionTimer = setTimeout(endQuestion, q.timeLimit * 1000); // 20s cap
}

// Called by the timer OR when everyone has answered. Then it WAITS for the host.
function endQuestion() {
  if (gameState !== 'question') return;
  clearTimeout(questionTimer);
  gameState = 'results';

  const q = questions[currentQuestionIndex];
  lastEnded = {
    correctAnswers: correctIndexes(q),
    leaderboard: buildLeaderboard(),
    isLast: currentQuestionIndex >= questions.length - 1,
    hostId // lets the client know whether to show the Next button
  };
  io.emit('question_ended', lastEnded);
}

io.on('connection', (socket) => {
  const savedPlayerId = socket.handshake.auth.playerId;

  if (savedPlayerId && players.has(savedPlayerId)) {
    const player = players.get(savedPlayerId);
    player.socketId = socket.id;
    player.connected = true;

    socket.emit('session_restored', player);
    // Catch a reconnecting player up to wherever the game currently is.
    if (gameState === 'question') socket.emit('question_started', questionPayload());
    if (gameState === 'results') {
      socket.emit('question_started', questionPayload());
      socket.emit('question_ended', lastEnded);
    }
    if (gameState === 'finished') socket.emit('game_over', { leaderboard: buildLeaderboard() });
    broadcastLobby();
  } else if (savedPlayerId) {
    socket.emit('session_expired');
  }

  socket.on('get_players', () => {
    socket.emit('lobby_updated', { players: playerList(), hostId });
  });

  socket.on('join_game', ({ nickname }) => {
    const playerId = crypto.randomUUID();
    const newPlayer = { id: playerId, socketId: socket.id, nickname, score: 0, connected: true };

    if (!hostId || players.size === 0) hostId = playerId; // first player is host

    players.set(playerId, newPlayer);
    socket.emit('session_created', newPlayer);
    broadcastLobby();
  });

  socket.on('reset_game', () => {
    clearTimeout(questionTimer);
    players.clear();
    answers.clear();
    hostId = null;
    lastEnded = null;
    gameState = 'lobby';
    currentQuestionIndex = -1;
    io.emit('session_expired');
    io.emit('lobby_updated', { players: [], hostId: null });
  });

  socket.on('start_game', ({ playerId }) => {
    if (playerId !== hostId || gameState !== 'lobby') return;
    currentQuestionIndex = 0;
    startQuestion();
  });

  // Host-only: move on from the results screen.
  socket.on('next_question', ({ playerId }) => {
    if (playerId !== hostId || gameState !== 'results') return;
    if (lastEnded.isLast) {
      gameState = 'finished';
      io.emit('game_over', { leaderboard: buildLeaderboard() });
    } else {
      currentQuestionIndex++;
      startQuestion();
    }
  });

  // Client sends only WHICH option they picked. The server decides the score.
  socket.on('submit_answer', ({ playerId, answerIndex }) => {
    const player = players.get(playerId);
    if (!player || gameState !== 'question' || answers.has(playerId)) return;

    const q = questions[currentQuestionIndex];
    const limitMs = q.timeLimit * 1000;
    const elapsed = Date.now() - questionStartedAt;
    if (elapsed > limitMs) return;

    // Wrong answers get 0. Correct answers get 1000 (instant) down to 500 (last second).
    const points = correctIndexes(q).includes(answerIndex)
      ? Math.round(1000 * (1 - elapsed / limitMs))
      : 0;

    answers.set(playerId, { answerIndex, points });
    player.score += points;

    // End early once every connected player has answered.
    const connectedCount = playerList().filter((p) => p.connected).length;
    if (answers.size >= connectedCount) endQuestion();
  });

  socket.on('disconnect', () => {
    for (const player of players.values()) {
      if (player.socketId === socket.id) {
        player.connected = false;
        broadcastLobby();
        break;
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));