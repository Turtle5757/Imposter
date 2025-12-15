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
  });

  socket.on("joinRoom", ({ name, room }) => {
    if (!rooms[room]) return;

    rooms[room].players[socket.id] = { name };
    socket.join(room);
    io.to(room).emit("roomUpdate", rooms[room]);
  });

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

  socket.on("nextTurn", (room) => {
    const r = rooms[room];
    if (!r || r.state !== "clues") return;

    r.currentTurn++;
    if (r.currentTurn < r.turnOrder.length) {
      io.to(room).emit("turn", r.turnOrder[r.currentTurn]);
    }
  });

  socket.on("startVoting", (room) => {
    const r = rooms[room];
    if (!r) return;

    r.state = "voting";
    r.votes = {};
    io.to(room).emit("votingStart", Object.keys(r.players));
  });

  socket.on("vote", ({ room, target }) => {
    const r = rooms[room];
    if (!r || r.state !== "voting") return;

    r.votes[target] = (r.votes[target] || 0) + 1;
  });

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
  });

  socket.on("chat", ({ room, msg, name }) => {
    if (!rooms[room]) return;
    io.to(room).emit("chat", { name, msg });
  });

  socket.on("disconnect", () => {
    for (const room in rooms) {
      if (rooms[room].players[socket.id]) {
        delete rooms[room].players[socket.id];
        io.to(room).emit("roomUpdate", rooms[room]);
      }
    }
  });

});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
