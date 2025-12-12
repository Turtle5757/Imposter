const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let games = {};
const categoryWords = {
    Food: ['Pizza','Burger','Sushi','Cake','Pasta'],
    Animals: ['Dog','Cat','Elephant','Lion','Tiger'],
    Objects: ['Chair','Table','Phone','Book','Car']
};

// Socket events
io.on('connection', socket => {
    console.log('User connected', socket.id);

    socket.on('createGame', (playerName, category, callback) => {
        const gameId = Math.random().toString(36).substr(2,6).toUpperCase();
        const secretWord = categoryWords[category][Math.floor(Math.random()*categoryWords[category].length)];
        games[gameId] = {
            host: socket.id,
            category,
            secretWord,
            players: [{id: socket.id, name: playerName, isImposter:false}],
            stage: 'waiting',
            votes: {},
            chat: [],
            currentTurnIndex: 0,
            round: 1
        };
        socket.join(gameId);
        callback(gameId);
        io.to(gameId).emit('updatePlayers', games[gameId].players);
    });

    socket.on('joinGame', (gameId, playerName, callback) => {
        const game = games[gameId];
        if(game && game.players.length < 10){
            game.players.push({id: socket.id, name: playerName, isImposter:false});
            socket.join(gameId);
            io.to(gameId).emit('updatePlayers', game.players);
            callback({success:true});
        } else callback({success:false, message:'Game full or not found'});
    });

    socket.on('getActiveGames', callback => {
        const rooms = Object.keys(games).map(gameId => ({
            id: gameId,
            playerCount: games[gameId].players.length
        }));
        callback(rooms);
    });

    // Start game
    socket.on('startGame', (gameId) => {
        const game = games[gameId];
        if(!game || socket.id !== game.host) return;

        const imposterIndex = Math.floor(Math.random()*game.players.length);
        game.players[imposterIndex].isImposter = true;
        game.stage = 'clues';
        game.currentTurnIndex = 0;
        game.round = 1;

        // Send secret word/imposter to each player **once**
        game.players.forEach(p => {
            if(p.isImposter){
                io.to(p.id).emit('secretWord', `You are the Imposter! Category: ${game.category}`);
            } else {
                io.to(p.id).emit('secretWord', game.secretWord);
            }
        });

        io.to(gameId).emit('gameStarted');
        io.to(gameId).emit('nextTurn', game.players[0].name);
    });

    // Submit clue
    socket.on('submitClue', (gameId, clue) => {
        const game = games[gameId];
        if(!game || game.stage !== 'clues') return;

        const player = game.players.find(p => p.id === socket.id);
        if(!player) return;

        // Turn enforcement
        if(game.players[game.currentTurnIndex].id !== socket.id) return;

        game.chat.push({player: player.name, message: clue});
        io.to(gameId).emit('chatUpdate', {player: player.name, message: clue});

        game.currentTurnIndex++;
        if(game.currentTurnIndex >= game.players.length){
            // All players gave clue this round
            io.to(game.host).emit('roundComplete', gameId);
        } else {
            io.to(gameId).emit('nextTurn', game.players[game.currentTurnIndex].name);
        }
    });

    // Start next clue round
    socket.on('startNextRound', gameId => {
        const game = games[gameId];
        if(!game) return;
        game.currentTurnIndex = 0;
        game.round++;
        io.to(gameId).emit('nextTurn', game.players[0].name);
    });

    // Start voting
    socket.on('startVoting', gameId => {
        const game = games[gameId];
        if(!game) return;
        game.stage = 'voting';
        io.to(gameId).emit('startVoting', game.players.map(p=>p.name));
    });

    // Vote
    socket.on('vote', (gameId, votedName) => {
        const game = games[gameId];
        if(game.stage !== 'voting') return;
        game.votes[socket.id] = votedName;

        if(Object.keys(game.votes).length === game.players.length){
            const voteCounts = {};
            Object.values(game.votes).forEach(v => voteCounts[v] = (voteCounts[v]||0)+1);
            const maxVotes = Math.max(...Object.values(voteCounts));
            const votedPlayer = Object.keys(voteCounts).find(k => voteCounts[k] === maxVotes);
            const imposter = game.players.find(p => p.isImposter);

            io.to(gameId).emit('gameResult', {
                imposter: imposter.name,
                votedPlayer,
                word: game.secretWord,
                chat: game.chat
            });
        }
    });

    socket.on('disconnect', () => {
        for(const gameId in games){
            let game = games[gameId];
            game.players = game.players.filter(p => p.id !== socket.id);
            io.to(gameId).emit('updatePlayers', game.players);
            if(game.players.length === 0) delete games[gameId];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
