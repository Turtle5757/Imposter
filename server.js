const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

// --- Ultra-hard words and hints ---
const WORDS = [
  // Animals
  { category: "Animal", word: "Elephant", hint: "Earth’s gentle giant with a long reach" },
  { category: "Animal", word: "Tiger", hint: "Striped shadow of the forest" },
  { category: "Animal", word: "Penguin", hint: "Dressed for formal occasions in the cold" },
  { category: "Animal", word: "Kangaroo", hint: "Jumps through life with a hidden pouch" },
  { category: "Animal", word: "Owl", hint: "Night whisperer with wide eyes" },
  { category: "Animal", word: "Dolphin", hint: "Intelligent swimmer in a playful pod" },
  { category: "Animal", word: "Giraffe", hint: "Towering browser of leafy heights" },
  { category: "Animal", word: "Hippopotamus", hint: "River shadow, massive but grounded" },
  { category: "Animal", word: "Cheetah", hint: "Speed in spotted form" },
  { category: "Animal", word: "Octopus", hint: "Master of disguise under the waves" },
  // Food
  { category: "Food", word: "Pizza", hint: "Shared circles of warmth and flavor" },
  { category: "Food", word: "Sushi", hint: "Artful rolls of delicate balance" },
  { category: "Food", word: "Chocolate", hint: "Sweetened essence from distant lands" },
  { category: "Food", word: "Burger", hint: "Layered surprise between soft shields" },
  { category: "Food", word: "Spaghetti", hint: "Strings tangled in saucy mystery" },
  { category: "Food", word: "Taco", hint: "Folded vessel for hidden treasures" },
  { category: "Food", word: "Pancake", hint: "Golden discs for morning rituals" },
  { category: "Food", word: "Salad", hint: "Crisp mosaic of green and crunch" },
  { category: "Food", word: "Cheese", hint: "Curdled essence of pastures" },
  { category: "Food", word: "Apple", hint: "Round temptation of orchard tales" },
  // Places
  { category: "Place", word: "Beach", hint: "Border where sand meets liquid horizon" },
  { category: "Place", word: "Mountain", hint: "Earth rises to kiss the sky" },
  { category: "Place", word: "Desert", hint: "Endless expanse of sun and silence" },
  { category: "Place", word: "Forest", hint: "Vertical maze of green whispers" },
  { category: "Place", word: "City", hint: "Concrete jungle humming with life" },
  { category: "Place", word: "Cave", hint: "Subterranean hollow of echoes" },
  { category: "Place", word: "Island", hint: "Lonely land embraced by water" },
  { category: "Place", word: "Park", hint: "Managed green for fleeting calm" },
  { category: "Place", word: "Zoo", hint: "Encased wilds observed from afar" },
  { category: "Place", word: "Library", hint: "Quiet vaults of stored thoughts" },
  // Objects
  { category: "Object", word: "Laptop", hint: "Foldable brain in a box" },
  { category: "Object", word: "Phone", hint: "Pocketed voice from afar" },
  { category: "Object", word: "Clock", hint: "Spinning hands track invisible flow" },
  { category: "Object", word: "Chair", hint: "Silent support for upright rest" },
  { category: "Object", word: "Umbrella", hint: "Suspended shield from falling sky" },
  { category: "Object", word: "Backpack", hint: "Carry life on your shoulders" },
  { category: "Object", word: "Glasses", hint: "Windows to sharpen perception" },
  { category: "Object", word: "Pen", hint: "Portable thought inscriber" },
  { category: "Object", word: "Book", hint: "Bound portal to unseen worlds" },
  { category: "Object", word: "Key", hint: "Metal whisper unlocking secrets" },
  // Colors
  { category: "Color", word: "Blue", hint: "Vast calm beyond the eye" },
  { category: "Color", word: "Red", hint: "Heat, pulse, and alert" },
  { category: "Color", word: "Green", hint: "Life’s signal, subtle and quiet" },
  { category: "Color", word: "Yellow", hint: "Radiance caught in pigment" },
  { category: "Color", word: "Purple", hint: "Mystery blend of cold and warm" },
  { category: "Color", word: "Orange", hint: "Sunset pressed into hue" },
  { category: "Color", word: "Black", hint: "Depth where light is absent" },
  { category: "Color", word: "White", hint: "Blank canvas, pure reflection" },
  { category: "Color", word: "Pink", hint: "Soft tint of warmth and blush" },
  { category: "Color", word: "Gray", hint: "Balance between extremes" },
  // Sports
  { category: "Sport", word: "Soccer", hint: "Round pursuit on grassy expanse" },
  { category: "Sport", word: "Basketball", hint: "Arc and bounce to victory" },
  { category: "Sport", word: "Tennis", hint: "Racketed back-and-forth duel" },
  { category: "Sport", word: "Baseball", hint: "Diamond game of bat and run" },
  { category: "Sport", word: "Swimming", hint: "Fluid motion against resistance" },
  { category: "Sport", word: "Boxing", hint: "Gloved contest in a confined ring" },
  { category: "Sport", word: "Cycling", hint: "Two wheels, endless pedaling" },
  { category: "Sport", word: "Skiing", hint: "Slide along frozen slopes" },
  { category: "Sport", word: "Volleyball", hint: "Net battle with hands aloft" },
  { category: "Sport", word: "Golf", hint: "Small object, long journey to hole" }
];

const rooms = {};

io.on("connection", (socket) => {

  socket.on("createRoom", (roomName, callback) => {
    if (rooms[roomName]) return callback(false);
    const playerName = socket.handshake.query.name || "Host";
    rooms[roomName] = { host: socket.id, players: {}, state: "waiting" };
    socket.join(roomName);
    rooms[roomName].players[socket.id] = { name: playerName };
    callback(true);
    io.emit("roomList", Object.keys(rooms));
  });

  socket.on("joinRoom", (roomName, playerName, callback) => {
    const room = rooms[roomName];
    if (!room) return callback(false);
    socket.join(roomName);
    room.players[socket.id] = { name: playerName };
    callback(true);
    io.to(roomName).emit("playerList", Object.values(room.players).map(p => p.name));
  });

  socket.on("startGame", ({ room, category, hintsOn }) => {
    const r = rooms[room];
    if (!r || socket.id !== r.host) return;
    const ids = Object.keys(r.players);
    if (ids.length < 2) return;

    let categoryWords;
    if (category && category !== "Random") {
      categoryWords = WORDS.filter(w => w.category === category);
    } else {
      const categories = [...new Set(WORDS.map(w => w.category))];
      const randomCat = categories[Math.floor(Math.random() * categories.length)];
      categoryWords = WORDS.filter(w => w.category === randomCat);
      category = randomCat;
    }

    const wordObj = categoryWords[Math.floor(Math.random() * categoryWords.length)];
    const imposter = ids[Math.floor(Math.random() * ids.length)];

    r.imposter = imposter;
    r.word = wordObj.word;
    r.category = wordObj.category;
    r.hint = hintsOn ? wordObj.hint : null;
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
        category: wordObj.category,
        hint: id === imposter ? r.hint : null
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
    r.clues.push({ player: r.turnOrder[r.currentTurn], clue });
    io.to(room).emit("newClue", { player: r.turnOrder[r.currentTurn], clue });
    r.currentTurn = (r.currentTurn + 1) % r.turnOrder.length;
    io.to(room).emit("turn", r.turnOrder[r.currentTurn]);
  });

  socket.on("startVote", (room) => {
    const r = rooms[room];
    if (!r) return;
    r.state = "voting";
    r.votes = {};
    r.votedPlayers = new Set();
    io.to(room).emit("votingPhase", Object.values(r.players).map(p => p.name));
  });

  socket.on("castVote", ({ room, votedName }) => {
    const r = rooms[room];
    if (!r || r.state !== "voting") return;
    if (r.votedPlayers.has(socket.id)) return;
    r.votedPlayers.add(socket.id);
    r.votes[votedName] = (r.votes[votedName] || 0) + 1;

    if (r.votedPlayers.size === Object.keys(r.players).length) {
      let maxVotes = 0;
      let ejected = null;
      for (let name in r.votes) {
        if (r.votes[name] > maxVotes) {
          maxVotes = r.votes[name];
          ejected = name;
        }
      }
      const imposterName = r.players[r.imposter].name;
      const winner = (ejected === imposterName) ? "Crewmates" : "Imposter";
      io.to(room).emit("gameEnd", { imposter: imposterName, word: r.word, winner });
      r.state = "waiting";
    }
  });

  socket.on("playAgain", (room) => {
    const r = rooms[room];
    if (!r) return;
    io.to(room).emit("resetGame");
  });

});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
