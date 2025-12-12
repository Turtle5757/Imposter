const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

const WORDS = [
  { category: "Food", words: ["Pizza", "Burger", "Pasta"] },
  { category: "Animal", words: ["Dog", "Cat", "Lion"] },
  { category: "Vehicle", words: ["Car", "Bike", "Boat"] }
];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

io.on("connection", (socket) => {

  socket.on("createRoom", (name) => {
    const roomId = generateRoomCode();
    rooms[roomId] = {
      host: socket.id,
      players: {},
      state: "lobby",
      clues: [],
      turnOrder: [],
      turnIndex: 0,
      votes: {}
    };
    rooms[roomId].players[socket.id] = { name: name || "Host" };
    socket.join(roomId);
    socket.emit("roomCreated", roomId);
    io.to(roomId).emit("roomUpdate", rooms[roomId]);
  });

  socket.on("joinRoom", ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit("errorMsg", "Room not found");
    room.players[socket.id] = { name };
    socket.join(roomId);
    io.to(roomId).emit("roomUpdate", room);
  });

  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const pids = Object.keys(room.players);
    if (pids.length < 3) return;

    const choice = getRandom(WORDS);
    const imposter = getRandom(pids);
    const realWord = getRandom(choice.words);

    room.state = "clues";
    room.word = realWord;
    room.category = choice.category;
    room.imposter = imposter;
    room.turnOrder = pids;
    room.turnIndex = 0;
    room.clues = [];

    pids.forEach(pid => {
      if (pid === imposter) {
        io.to(pid).emit("role", { role: "imposter", category: choice.category });
      } else {
        io.to(pid).emit("role", { role: "player", word: realWord, category: choice.category });
      }
    });

    io.to(roomId).emit("newTurn", {
      player: room.players[room.turnOrder[room.turnIndex]].name,
      clues: room.clues
    });
  });

  socket.on("sendClue", ({ roomId, clue }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.clues.push({ player: room.players[socket.id].name, text: clue });
    room.turnIndex = (room.turnIndex + 1) % room.turnOrder.length;
    io.to(roomId).emit("newTurn", {
      player: room.players[room.turnOrder[room.turnIndex]].name,
      clues: room.clues
    });
  });

  socket.on("startVoting", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.state = "voting";
    room.votes = {};
    io.to(roomId).emit("votingStarted", { players: room.players });
  });

  socket.on("submitVote", ({ roomId, voteFor }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.votes[socket.id] = voteFor;

    if (Object.keys(room.votes).length === Object.keys(room.players).length) {
      const tally = {};
      Object.values(room.votes).forEach(v => tally[v] = (tally[v] || 0) + 1);
      const votedOut = Object.entries(tally).sort((a,b)=>b[1]-a[1])[0][0];
      io.to(roomId).emit("results", { votedOut, imposter: room.imposter });
    }
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
