const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let games = {}; // key: gameId, value: game state

io.on('connection', socket => {
    console.log('A user connected:', socket.id);

    socket.on('createGame', (playerName, callback) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        games[gameId] = {
            host: socket.id,
            players: [{id: socket.id, name: playerName, isImposter: false, clue: ''}],
            secretWord: null,
            imposterIndex: null,
            clues: [],
            stage: 'waiting'
        };
        socket.join(gameId);
        callback(gameId);
        io.to(gameId).emit('updatePlayers', games[gameId].players);
    });

    socket.on('joinGame', (gameId, playerName, callback) => {
        const game = games[gameId];
        if(game && game.players.length < 10) {
            game.players.push({id: socket.id, name: playerName, isImposter: false, clue: ''});
            socket.join(gameId);
            io.to(gameId).emit('updatePlayers', game.players);
            callback({success:true});
        } else {
            callback({success:false, message: 'Game full or not found'});
        }
    });

    socket.on('startGame', (gameId) => {
        const game = games[gameId];
        if(game && socket.id === game.host) {
            const words = ['apple', 'banana', 'car', 'dog', 'pizza', 'mountain', 'guitar', 'ocean'];
            game.secretWord = words[Math.floor(Math.random()*words.length)];
            game.imposterIndex = Math.floor(Math.random()*game.players.length);
            game.players[game.imposterIndex].isImposter = true;
            game.stage = 'clues';
            
            game.players.forEach(p => {
                if(p.isImposter){
                    io.to(p.id).emit('secretWord', 'You are the Imposter!');
                } else {
                    io.to(p.id).emit('secretWord', game.secretWord);
                }
            });
            io.to(gameId).emit('gameStarted');
        }
    });

    socket.on('submitClue', (gameId, clue) => {
        const game = games[gameId];
        const player = game.players.find(p => p.id === socket.id);
        player.clue = clue;
        game.clues.push({player: player.name, clue});
        
        if(game.clues.length === game.players.length){
            game.stage = 'voting';
            io.to(gameId).emit('startVoting', game.players.map(p => p.name));
        }
    });

    socket.on('vote', (gameId, votedName) => {
        const game = games[gameId];
        if(!game.votes) game.votes = {};
        game.votes[socket.id] = votedName;

        if(Object.keys(game.votes).length === game.players.length){
            const voteCounts = {};
            Object.values(game.votes).forEach(v => voteCounts[v] = (voteCounts[v]||0)+1);
            const maxVotes = Math.max(...Object.values(voteCounts));
            const votedPlayerName = Object.keys(voteCounts).find(k => voteCounts[k]===maxVotes);
            const imposter = game.players.find(p => p.isImposter);

            io.to(gameId).emit('gameResult', {
                imposter: imposter.name,
                votedPlayer: votedPlayerName,
                word: game.secretWord,
                clues: game.clues
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for(let gameId in games){
            let game = games[gameId];
            game.players = game.players.filter(p => p.id !== socket.id);
            io.to(gameId).emit('updatePlayers', game.players);
            if(game.players.length === 0) delete games[gameId];
        }
    });
});

server.listen(3000, () => console.log('Server running on port 3000'));
