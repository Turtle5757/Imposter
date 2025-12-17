const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const WORDS = {
  Animal: [
    { word: "Elephant", hint: "Large land mammal" },
    { word: "Giraffe", hint: "Long neck" }
  ],
  Food: [
    { word: "Pizza", hint: "Cheesy slices" },
    { word: "Burger", hint: "Stacked sandwich" }
  ],
  Place: [
    { word: "Beach", hint: "Sand + ocean" },
    { word: "Airport", hint: "Planes everywhere" }
  ]
};

const rooms = {};

const roomList = () =>
  Object.keys(rooms).map(r => ({
    name: r,
    players: Object.keys(rooms[r].players).length
  }));

io.on("connection", socket => {
  socket.emit("roomList", roomList());

  socket.on("createRoom", ({ name, room }) => {
    if (rooms[room]) return;
    rooms[room] = {
      host: socket.id,
      players: {},
      state: "lobby",
      category: null,
      hints: true,
      order: [],
      turn: 0,
      votes: {},
      voted: new Set()
    };
    rooms[room].players[socket.id] = { name };
    socket.join(room);
    io.emit("roomList", roomList());
    io.to(room).emit("roomUpdate", rooms[room]);
  });

  socket.on("joinRoom", ({ name, room }) => {
    if (!rooms[room]) return;
    rooms[room].players[socket.id] = { name };
    socket.join(room);
    io.to(room).emit("roomUpdate", rooms[room]);
    io.emit("roomList", roomList());
  });

  socket.on("settings", ({ room, category, hints }) => {
    if (rooms[room]?.host !== socket.id) return;
    rooms[room].category = category;
    rooms[room].hints = hints;
  });

  socket.on("startGame", room => {
    const r = rooms[room];
    if (!r || r.host !== socket.id) return;

    const ids = Object.keys(r.players);
    const imposter = ids[Math.floor(Math.random() * ids.length)];
    const list = WORDS[r.category];
    const chosen = list[Math.floor(Math.random() * list.length)];

    r.imposter = imposter;
    r.word = chosen.word;
    r.hint = chosen.hint;
    r.order = [...ids];
    r.turn = 0;
    r.state = "clues";
    r.votes = {};
    r.voted = new Set();

    ids.forEach(id => {
      io.to(id).emit("role", {
        imposter: id === imposter,
        word: id === imposter ? null : chosen.word,
        hint: r.hints ? chosen.hint : null,
        category: r.category
      });
    });

    io.to(room).emit("turn", r.order[0]);
  });

  socket.on("sendClue", ({ room, clue }) => {
    const r = rooms[room];
    if (!r || r.order[r.turn] !== socket.id) return;

    io.to(room).emit("newClue", {
      name: r.players[socket.id].name,
      clue
    });

    r.turn++;
    if (r.turn < r.order.length) {
      io.to(room).emit("turn", r.order[r.turn]);
    } else {
      io.to(room).emit("cluesDone");
    }
  });

  socket.on("startVoting", room => {
    const r = rooms[room];
    if (!r || r.host !== socket.id) return;
    r.state = "voting";
    io.to(room).emit(
      "votingStart",
      Object.entries(r.players).map(([id, p]) => ({
        id,
        name: p.name
      }))
    );
  });

  socket.on("vote", ({ room, target }) => {
    const r = rooms[room];
    if (!r || r.voted.has(socket.id)) return;

    r.voted.add(socket.id);
    r.votes[target] = (r.votes[target] || 0) + 1;

    if (r.voted.size === Object.keys(r.players).length) {
      const out = Object.entries(r.votes).sort((a, b) => b[1] - a[1])[0][0];
      io.to(room).emit("gameOver", {
        imposter: r.players[r.imposter].name,
        word: r.word,
        winner: out === r.imposter ? "Crewmates" : "Imposter"
      });
    }
  });

  socket.on("chat", ({ room, name, msg }) => {
    io.to(room).emit("chat", { name, msg });
  });

  socket.on("playAgain", room => {
    const r = rooms[room];
    if (!r || r.host !== socket.id) return;
    r.state = "lobby";
    io.to(room).emit("resetGame");
  });

  socket.on("disconnect", () => {
    for (const r in rooms) {
      delete rooms[r].players[socket.id];
      io.to(r).emit("roomUpdate", rooms[r]);
    }
    io.emit("roomList", roomList());
  });
});

server.listen(3000, () => console.log("Running on 3000"));
