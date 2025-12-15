const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const WORDS = [
  { category: "Animal", word: "Elephant" },
  { category: "Food", word: "Pizza" },
  { category: "Place", word: "Beach" },
  { category: "Object", word: "Laptop" }
];

const rooms = {};

io.on("connection", (socket) => {
  // Send available rooms on connection
  socket.emit("roomList", getRoomList());

  // Create a room
  socket.on("createRoom", ({ name, room }) => {
    if (rooms[room]) return;
    rooms[room] = {
      host: socket.id,
      players: {},
      state: "lobby",
      turnOrder: [],
      currentTurn: 0,
      votes: {}
    };
    rooms[room].players[socket.id] = { name };
    socket.join(room);
    io.to(room).emit("roomUpdate", rooms[room]);
    io.emit("roomList", getRoomList());
  });

  // Join a room
  socket.on("joinRoom", ({ name, room }) => {
    if (!rooms[room]) return;
    rooms[room].players[socket.id] = { name };
    socket.join(room);
    io.to(room).emit("roomUpdate", rooms[room]);
    io.emit("roomList", getRoomList());
  });

  // Start game
  socket.on("startGame", (room) => {
    const r = rooms[room];
    if (!r) return;
    const ids = Object.keys(r.players);
    if (ids.length < 3) return;

    const imposter = ids[Math.floor(Math.random() * ids.length)];
    const wordObj = WORDS[Math.floor(Math.random() * WORDS.length)];

    r.imposter = imposter;
    r.word = wordObj.word;
    r.category = wordObj.category;
    r.turnOrder = [...ids];
    r.currentTurn = 0;
    r.state = "clues";

    ids.forEach((id) => {
      io.to(id).emit("role", {
        imposter: id === imposter,
        word: id === imposter ? null : r.word,
        category: r.category
      });
    });

    io.to(room).emit("turn", r.turnOrder[r.currentTurn]);
  });

  // Send clue
  socket.on("sendClue", ({ room, clue }) => {
    const r = rooms[room];
    if (!r || r.state !== "clues") return;
    if (socket.id !== r.turnOrder[r.currentTurn]) return;
    io.to(room).emit("newClue", {
      player: r.players[socket.id].name,
      clue
    });
  });

  // Next turn
  socket.on("nextTurn", (room) => {
    const r = rooms[room];
    if (!r || r.state !== "clues") return;
    r.currentTurn++;
    if (r.currentTurn < r.turnOrder.length) {
      io.to(room).emit("turn", r.turnOrder[r.currentTurn]);
    } else {
      r.state = "voting";
      io.to(room).emit("votingStart", Object.keys(r.players).map(id => ({ id, name: r.players[id].name })));
    }
  });

  // Vote
  socket.on("vote", ({ room, target }) => {
    const r = rooms[room];
    if (!r || r.state !== "voting") return;
    r.votes[target] = (r.votes[target] || 0) + 1;
  });

  // End voting
  socket.on("endVoting", (room) => {
    const r = rooms[room];
    if (!r) return;
    let maxVotes = 0;
    let votedOut = null;
    for (const id in r.votes) {
      if (r.votes[id] > maxVotes) {
        maxVotes = r.votes[id];
        votedOut = id;
      }
    }
    const crewWin = votedOut === r.imposter;
    io.to(room).emit("gameOver", {
      imposter: r.players[r.imposter]?.name || "Unknown",
      word: r.word,
      winner: crewWin ? "Crewmates" : "Imposter"
    });
    r.state = "lobby";
    r.turnOrder = [];
    r.currentTurn = 0;
    r.votes = {};
    io.emit("roomList", getRoomList());
  });

  // Chat
  socket.on("chat", ({ room, msg, name }) => {
    if (!rooms[room]) return;
    io.to(room).emit("chat", { name, msg });
  });

  // Disconnect
  socket.on("disconnect", () => {
    for (const room in rooms) {
      if (rooms[room].players[socket.id]) {
        delete rooms[room].players[socket.id];
        io.to(room).emit("roomUpdate", rooms[room]);
        io.emit("roomList", getRoomList());
      }
    }
  });

  function getRoomList() {
    return Object.keys(rooms).map(r => ({
      name: r,
      players: Object.keys(rooms[r].players).length
    }));
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
