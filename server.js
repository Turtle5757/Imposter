const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let games = {};

function generateGame() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on("connection", (socket) => {

    // Create a game
    socket.on("createGame", ({ name }, cb) => {
        const code = generateGame();
        games[code] = {
            host: socket.id,
            players: [{ id: socket.id, name }],
            stage: "lobby",
            word: "APPLE",
            category: "Fruits",
            roles: {},
            turn: 0,
            round: 1,
            clues: [],
            chat: [],
            votingChat: []
        };

        socket.join(code);
        cb({ ok: true, code });
        io.to(code).emit("playerList", games[code].players);
    });

    // Join a game
    socket.on("joinGame", ({ name, code }, cb) => {
        const game = games[code];
        if (!game) return cb({ ok: false });

        game.players.push({ id: socket.id, name });
        socket.join(code);

        cb({ ok: true });
        io.to(code).emit("playerList", game.players);
    });

    // Start game
    socket.on("startGame", ({ code }) => {
        const game = games[code];
        if (!game || socket.id !== game.host) return;

        // Pick imposter
        const imp = game.players[Math.floor(Math.random() * game.players.length)].id;
        game.roles = {};
        game.players.forEach(p => {
            game.roles[p.id] = p.id === imp ? "imposter" : "normal";
        });

        game.stage = "clues";
        game.turn = 0;
        game.clues = [];

        // Send roles
        game.players.forEach(p => {
            io.to(p.id).emit("roleInfo", {
                role: game.roles[p.id],
                secretWord: game.roles[p.id] === "normal" ? game.word : null,
                category: game.category
            });
        });

        io.to(code).emit("gameStarted", {
            firstTurn: game.players[0].name
        });
    });

    // Submit a clue
    socket.on("submitClue", ({ code, clue }) => {
        const game = games[code];
        if (!game || game.stage !== "clues") return;

        const player = game.players[game.turn];
        if (socket.id !== player.id) return; // not your turn

        game.clues.push({ name: player.name, clue });

        // Broadcast clue
        io.to(code).emit("clueAdded", { name: player.name, clue });

        // Next turn
        game.turn++;

        if (game.turn === game.players.length) {
            // Round done
            io.to(code).emit("roundOptions", socket.id === game.host);
        } else {
            io.to(code).emit("nextTurn", {
                name: game.players[game.turn].name
            });
        }
    });

    // Host starts another round
    socket.on("nextRound", ({ code }) => {
        const game = games[code];
        if (!game) return;

        game.turn = 0;
        game.round++;
        game.clues = [];

        io.to(code).emit("nextTurn", {
            name: game.players[0].name
        });
    });

    // Host starts voting
    socket.on("startVoting", ({ code }) => {
        const game = games[code];
        if (!game) return;

        game.stage = "voting";

        io.to(code).emit("votingStarted", {
            players: game.players
        });
    });

    // Chat during voting
    socket.on("votingMessage", ({ code, name, msg }) => {
        const game = games[code];
        if (!game) return;

        io.to(code).emit("votingChatUpdate", { name, msg });
    });

    // Disconnect cleanup
    socket.on("disconnect", () => {
        for (let code in games) {
            const game = games[code];
            game.players = game.players.filter(p => p.id !== socket.id);
            io.to(code).emit("playerList", game.players);
        }
    });
});

server.listen(3000, () => console.log("Server running on 3000"));
