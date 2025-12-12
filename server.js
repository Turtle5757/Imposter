const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let rooms = {};

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const WORDS = [
  { category: "Food", words: ["Pizza", "Burger", "Pasta"] },
  { category: "Animal", words: ["Dog", "Lion", "Eagle"] },
  { category: "Vehicle", words: ["Car", "Boat", "Bike"] }
];

io.on("connection", (socket) => {

  socket.on("createRoom", () => {
    const roomId = Math.random().toString(36).substring(2, 7);
    rooms[roomId] = {
      host: socket.id,
      players: {},
      state: "lobby",
      turnOrder: [],
      turnIndex: 0,
      clues: [],
      votes: {}
    };
    socket.join(roomId);
    rooms[roomId].players[socket.id] = { name: "Player", ready: false };
    socket.emit("roomCreated", roomId);
    io.to(roomId).emit("roomUpdate", rooms[roomId]);
  });

  socket.on("joinRoom", ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit("errorMsg", "Room not found");

    socket.join(roomId);
    room.players[socket.id] = { name, ready: false };
    io.to(roomId).emit("roomUpdate", room);
  });

  socket.on("setReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players[socket.id].ready = true;
    io.to(roomId).emit("roomUpdate", room);
  });

  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (socket.id !== room.host) return;

    const pids = Object.keys(room.players);
    if (pids.length < 3) return;

    const choice = getRandom(WORDS);
    const imposter = getRandom(pids);
    const realWord = getRandom(choice.words);

    room.state = "clues";
    room.category = choice.category;
    room.word = realWord;
    room.imposter = imposter;
    room.turnOrder = pids;
    room.turnIndex = 0;
    room.clues = [];

    // Send roles
    pids.forEach(pid => {
      if (pid === imposter) {
        io.to(pid).emit("role", { role: "imposter", category: room.category });
      } else {
        io.to(pid).emit("role", { role: "villager", category: room.category, word: realWord });
      }
    });

    io.to(roomId).emit("newTurn", {
      player: room.turnOrder[room.turnIndex],
      clues: room.clues
    });
  });

  socket.on("sendClue", ({ roomId, clue }) => {
    const room = rooms[roomId];
    if (!room || room.state !== "clues") return;

    room.clues.push({ player: socket.id, text: clue });

    // Advance turn
    room.turnIndex++;
    if (room.turnIndex >= room.turnOrder.length) {
      room.turnIndex = 0;
    }

    io.to(roomId).emit("newTurn", {
      player: room.turnOrder[room.turnIndex],
      clues: room.clues
    });
  });

  socket.on("startVoting", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.host) return;

    room.state = "voting";
    room.votes = {};

    io.to(roomId).emit("votingStarted", {
      players: room.players
    });
  });

  socket.on("submitVote", ({ roomId, voteFor }) => {
    const room = rooms[roomId];
    if (!room || room.state !== "voting") return;

    room.votes[socket.id] = voteFor;

    if (Object.keys(room.votes).length === Object.keys(room.players).length) {
      let tally = {};
      Object.values(room.votes).forEach(v => {
        tally[v] = (tally[v] || 0) + 1;
      });

      let votedOut = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];

      io.to(roomId).emit("results", {
        votedOut,
        imposter: room.imposter
      });
    }
  });

});

server.listen(3000, () => console.log("Server running"));
