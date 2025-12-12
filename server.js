const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

let games = {};

const categories = {
  Fruits: ["Apple","Banana","Orange","Grapes","Mango"],
  Animals: ["Dog","Cat","Elephant","Tiger","Horse"],
  Colors: ["Red","Blue","Green","Yellow","Purple"]
};

function randomChoice(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

io.on("connection", socket => {

  socket.on("createGame", ({name}, cb) => {
    const code = Math.random().toString(36).substring(2,7).toUpperCase();
    const category = randomChoice(Object.keys(categories));
    const word = randomChoice(categories[category]);
    games[code] = {
      host: socket.id,
      players: [{id: socket.id, name}],
      stage: "lobby",
      roles: {},
      currentTurn: 0,
      clues: [],
      round: 1,
      word,
      category,
      votes: {}
    };
    socket.join(code);
    cb({ok:true, code});
    io.to(code).emit("playerList", games[code].players);
  });

  socket.on("joinGame", ({name, code}, cb) => {
    const game = games[code];
    if(!game) return cb({ok:false});
    game.players.push({id:socket.id, name});
    socket.join(code);
    cb({ok:true});
    io.to(code).emit("playerList", game.players);
  });

  socket.on("startGame", ({code}) => {
    const game = games[code];
    if(!game || socket.id !== game.host) return;

    const impIndex = Math.floor(Math.random()*game.players.length);
    game.players.forEach((p,i) => {
      game.roles[p.id] = i===impIndex ? "imposter" : "normal";
      io.to(p.id).emit("roleInfo", {
        role: game.roles[p.id],
        secretWord: game.roles[p.id]==="normal"?game.word:null,
        category: game.category
      });
    });

    game.stage = "clues";
    game.currentTurn = 0;
    io.to(code).emit("gameStarted", {firstTurn: game.players[0].name});
  });

  socket.on("submitClue", ({code, clue}) => {
    const game = games[code];
    if(!game || game.stage!=="clues") return;
    const player = game.players[game.currentTurn];
    if(socket.id !== player.id) return;

    game.clues.push({name: player.name, clue});
    io.to(code).emit("clueAdded", {name: player.name, clue});

    game.currentTurn++;
    if(game.currentTurn >= game.players.length){
      io.to(code).emit("roundOptions", socket.id === game.host);
    } else {
      io.to(code).emit("nextTurn", {name: game.players[game.currentTurn].name});
    }
  });

  socket.on("nextRound", ({code}) => {
    const game = games[code];
    if(!game) return;
    game.currentTurn = 0;
    game.round++;
    game.clues = [];
    io.to(code).emit("nextTurn", {name: game.players[0].name});
  });

  socket.on("startVoting", ({code}) => {
    const game = games[code];
    if(!game) return;
    game.stage = "voting";
    io.to(code).emit("votingStarted", {players: game.players});
  });

  socket.on("votingMessage", ({code,name,msg}) => {
    io.to(code).emit("votingChatUpdate", {name,msg});
  });

  socket.on("vote", ({code,voter,target}) => {
    const game = games[code];
    if(!game) return;
    game.votes[voter] = target;

    if(Object.keys(game.votes).length === game.players.length){
      let tally = {};
      Object.values(game.votes).forEach(t => { tally[t] = (tally[t]||0)+1 });
      let maxVotes = 0, eliminated = "";
      for(let p in tally){ if(tally[p] > maxVotes){ maxVotes = tally[p]; eliminated = p; } }
      const imp = game.players.find(p => game.roles[p.id]==="imposter").name;
      io.to(code).emit("votingResult", {eliminated, imposter: imp});
    }
  });

  socket.on("disconnect", () => {
    for(let code in games){
      const game = games[code];
      game.players = game.players.filter(p => p.id !== socket.id);
      io.to(code).emit("playerList", game.players);
    }
  });

});

server.listen(PORT, () => console.log("Server running on port", PORT));
