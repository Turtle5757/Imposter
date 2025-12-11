const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let games = {}; // gameId -> game state

const categoryWords = {
    Food: ['Pizza','Burger','Sushi','Cake','Pasta'],
    Animals: ['Dog','Cat','Elephant','Lion','Tiger'],
    Objects: ['Chair','Table','Phone','Book','Car']
};

// Create game
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
            chat: []
        };
        socket.join(gameId);
        callback(gameId);
        io.to(gameId).emit('updatePlayers', games[gameId].players);
    });

    // Join game
    socket.on('joinGame', (gameId, playerName, callback) => {
        const game = games[gameId];
        if(game && game.players.length < 10){
            game.players.push({id: socket.id, name: playerName, isImposter:false});
            socket.join(gameId);
            io.to(gameId).emit('updatePlayers', game.players);
            callback({success:true});
        } else {
            callback({success:false, message:'Game full or not found'});
        }
    });

    // Get active games
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

        // Send secret word / imposter category
        game.players.forEach(p => {
            if(p.isImposter){
                io.to(p.id).emit('secretWord', `You are the Imposter! Category: ${game.category}`);
            } else {
                io.to(p.id).emit('secretWord', game.secretWord);
            }
        });

        io.to(gameId).emit('gameStarted');
    });

    // Submit clue (multiple per player allowed)
    socket.on('submitClue', (gameId, clue) => {
        const game = games[gameId];
        if(!game || game.stage !== 'clues') return;

        const player = game.players.find(p => p.id === socket.id);
        if(!player) return;

        game.chat.push({player: player.name, message: clue});
        io.to(gameId).emit('chatUpdate', {player: player.name, message: clue});
    });

    // Start voting (host click or timer)
    socket.on('startVoting', gameId => {
        const game = games[gameId];
        if(!game) return;
        game.stage = 'voting';
        io.to(gameId).emit('startVoting', game.players.map(p=>p.name));
    });

    // Voting
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

    // Disconnect
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
