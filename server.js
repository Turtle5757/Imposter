const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let games = {};

function createGame(hostId, hostName) {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    games[code] = {
        hostId,
        players: [{ id: hostId, name: hostName }],
        stage: "lobby",
        chat: [],
        votingChat: [],
        roles: {},
        currentTurnIndex: 0
    };
    return code;
}

io.on("connection", (socket) => {

    // Create game room
    socket.on("createGame", (name, callback) => {
        const code = createGame(socket.id, name);
        socket.join(code);
        callback(code);
        io.to(code).emit("playerList", games[code].players);
    });

    // Join existing game room
    socket.on("joinGame", (code, name, callback) => {
        const game = games[code];
        if (!game) return callback(false);

        game.players.push({ id: socket.id, name });
        socket.join(code);
        callback(true);

        io.to(code).emit("playerList", game.players);
    });

    // Start game
    socket.on("startGame", (code) => {
        const game = games[code];
        if (!game) return;

        // assign roles
        const imp = game.players[Math.floor(Math.random() * game.players.length)];
        game.players.forEach(p => {
            game.roles[p.id] = p.id === imp.id ? "imposter" : "word-holder";
        });

        game.stage = "clues";
        game.currentTurnIndex = 0;
        io.to(code).emit("gameStarted");

        io.to(code).emit("yourRole", game.roles[socket.id]);
        io.to(code).emit("nextTurn", game.players[0].name);
    });

    // Submit clue (turn-based)
    socket.on("submitClue", (code, clue) => {
        const game = games[code];
        if (!game) return;

        const turnPlayer = game.players[game.currentTurnIndex];
        if (turnPlayer.id !== socket.id) return; 

        game.chat.push({ player: turnPlayer.name, message: clue });
        io.to(code).emit("chatUpdate", clue, turnPlayer.name);

        game.currentTurnIndex++;

        if (game.currentTurnIndex >= game.players.length) {
            io.to(code).emit("clueRoundOver");
        } else {
            io.to(code).emit(
                "nextTurn",
                game.players[game.currentTurnIndex].name
            );
        }
    });

    // Host chooses "Next Round"
    socket.on("nextRound", (code) => {
        const game = games[code];
        game.currentTurnIndex = 0;
        io.to(code).emit("nextTurn", game.players[0].name);
    });

    // Host chooses "Start Voting"
    socket.on("startVoting", (code) => {
        const game = games[code];
        game.stage = "voting";
        io.to(code).emit(
            "startVoting",
            game.players.map((p) => ({ id: p.id, name: p.name }))
        );
    });

    // Voting chat
    socket.on("sendVotingMessage", (code, msg) => {
        const game = games[code];
        if (!game) return;

        const player = game.players.find(p => p.id === socket.id);
        game.votingChat.push({ player: player.name, message: msg });

        io.to(code).emit("votingChatUpdate", player.name, msg);
    });

    socket.on("disconnect", () => {
        for (const code in games) {
            const game = games[code];
            game.players = game.players.filter(p => p.id !== socket.id);

            io.to(code).emit("playerList", game.players);
        }
    });
});

server.listen(3000, () => console.log("Server running on port 3000"));
