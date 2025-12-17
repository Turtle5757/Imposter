const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Words per category with harder hints
const WORDS = {
  Animal: [
    { word: "Elephant", hints: ["Large memory", "Trunked mammal", "Gray giant"] },
    { word: "Dolphin", hints: ["Aquatic mammal", "Intelligent swimmer", "Not a fish"] },
    { word: "Kangaroo", hints: ["Jumps far", "Pouch mammal", "Native to Australia"] }
  ],
  Food: [
    { word: "Pizza", hints: ["Round and cheesy", "Popular Italian dish", "Slices served"] },
    { word: "Sushi", hints: ["Raw ingredient dish", "Japanese cuisine", "Rice and fish"] },
    { word: "Taco", hints: ["Mexican wrap", "Folded meal", "Often spicy"] }
  ],
  Place: [
    { word: "Beach", hints: ["Sandy area", "Sun and waves", "Near ocean"] },
    { word: "Mountains", hints: ["High elevation", "Peaks and slopes", "Hikers like me"] },
    { word: "Desert", hints: ["Dry place", "Cactus habitat", "Very hot"] }
  ],
  Object: [
    { word: "Laptop", hints: ["Portable device", "Closes like a book", "Has keyboard"] },
    { word: "Chair", hints: ["Sitting furniture", "Four legs", "Back support"] },
    { word: "Umbrella", hints: ["Protects from rain", "Opens and closes", "Handle attached"] }
  ]
};

const rooms = {};

io.on("connection", socket => {
  socket.emit("roomList", getRoomList());

  socket.on("createRoom", ({ name, room }) => {
    if (rooms[room]) return;
    rooms[room] = {
      host: socket.id,
      players: {},
      state: "lobby",
      turnOrder: [],
      currentTurn: 0,
      votes: {},
      clues: [],
      votedPlayers: new Set(),
      category: null,
      hintsOn: true
    };
    rooms[room].players[socket.id] = { name };
    socket.join(room);
    io.to(room).emit("roomUpdate", rooms[room]);
    io.emit("roomList", getRoomList());
  });

  socket.on("joinRoom", ({ name, room }) => {
    if (!rooms[room]) return;
    rooms[room].players[socket.id] = { name };
    socket.join(room);
    io.to(room).emit("roomUpdate", rooms[room]);
    io.emit("roomList", getRoomList());
  });

  socket.on("selectCategory", ({ room, category, hintsOn }) => {
    const r = rooms[room];
    if (!r) return;
    if (socket.id !== r.host) return;
    r.category = category || null;
    r.hintsOn = hintsOn;
  });

  socket.on("startGame", room => {
    const r = rooms[room];
    if (!r || socket.id !== r.host) return;
    const ids = Object.keys(r.players);
    if (ids.length < 2) return;

    // Pick imposter
    const imposter = ids[Math.floor(Math.random() * ids.length)];

    // Pick word
    let category = r.category;
    if (!category) {
      const cats = Object.keys(WORDS);
      category = cats[Math.floor(Math.random() * cats.length)];
    }
    const words = WORDS[category];
    const wordObj = words[Math.floor(Math.random() * words.length)];

    r.imposter = imposter;
    r.word = wordObj.word;
    r.category = category;
    r.wordHints = wordObj.hints;
    r.turnOrder = [...ids];
    r.currentTurn = 0;
    r.state = "reveal";
    r.votes = {};
    r.clues = [];
    r.votedPlayers = new Set();

    ids.forEach(id => {
      io.to(id).emit("role", {
        imposter: id === imposter,
        word: id === imposter ? null : r.word,
        category: category,
        hints: r.hintsOn && id !== imposter ? wordObj.hints : []
      });
    });

    io.to(room).emit("revealPhase");

    setTimeout(() => {
      r.state = "clues";
      io.to(room).emit("cluePhase");
      io.to(room).emit("turn", r.turnOrder[r.currentTurn]);
    }, 5000);
  });

  socket.on("sendClue", ({ room, clue }) => {
    const r = rooms[room];
    if (!r || r.state !== "clues") return;
    if (socket.id !== r.turnOrder[r.currentTurn]) return;

    r.clues.push({ player: r.players[socket.id].name, clue });
    io.to(room).emit("newClue", { player: r.players[socket.id].name, clue });

    r.currentTurn++;
    if (r.currentTurn < r.turnOrder.length) {
      io.to(room).emit("turn", r.turnOrder[r.currentTurn]);
    } else {
      io.to(room).emit("allTurnsDone");
    }
  });

  socket.on("startVoting", room => {
    const r = rooms[room];
    if (!r || r.state !== "clues") return;
    if (socket.id !== r.host) return;

    r.state = "voting";
    r.votes = {};
    r.votedPlayers = new Set();
    io.to(room).emit("votingStart", Object.keys(r.players).map(id => ({ id, name: r.players[id].name })));
  });

  socket.on("vote", ({ room, target }) => {
    const r = rooms[room];
    if (!r || r.state !== "voting") return;
    if (r.votedPlayers.has(socket.id)) return;

    r.votes[target] = (r.votes[target] || 0) + 1;
    r.votedPlayers.add(socket.id);

    if (r.votedPlayers.size === Object.keys(r.players).length) {
      // Determine voted out
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

      // Reset for next game without kicking players
      r.state = "lobby";
      r.turnOrder = [];
      r.currentTurn = 0;
      r.votes = {};
      r.clues = [];
      r.votedPlayers = new Set();
      r.imposter = null;
      r.word = null;
      r.category = null;
      r.wordHints = [];
      io.to(room).emit("roomUpdate", r);
    }
  });

  socket.on("chat", ({ room, msg, name }) => {
    const r = rooms[room];
    if (!r || r.state !== "voting") return;
    io.to(room).emit("chat", { name, msg });
  });

  socket.on("disconnect", () => {
    for (const room in rooms) {
      if (rooms[room].players[socket.id]) {
        delete rooms[room].players[socket.id];

        // Transfer host if needed
        const ids = Object.keys(rooms[room].players);
        if (rooms[room].host === socket.id && ids.length > 0) {
          rooms[room].host = ids[0];
        }

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

server.listen(process.env.PORT || 3000, () => console.log("Server running"));
