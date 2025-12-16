const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const words = require('./words');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', socket => {

  socket.on('create-room', name => {
    const roomId = Math.random().toString(36).slice(2, 8);

    rooms[roomId] = {
      id: roomId,
      hostId: socket.id,
      phase: 'lobby',
      players: {},
      imposterId: null,
      word: null,
      category: null,
      turnIndex: 0,
      votes: {}
    };

    rooms[roomId].players[socket.id] = {
      id: socket.id,
      name
    };

    socket.join(roomId);
    socket.emit('joined', roomId);
    io.emit('rooms', Object.values(rooms));
  });

  socket.on('join-room', ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id] = {
      id: socket.id,
      name
    };

    socket.join(roomId);
    io.to(roomId).emit('update', room);
  });

  socket.on('start-game', roomId => {
    const room = rooms[roomId];
    if (!room) return;

    const playerIds = Object.keys(room.players);
    room.imposterId = playerIds[Math.floor(Math.random() * playerIds.length)];

    const pick = words[Math.floor(Math.random() * words.length)];
    room.word = pick.word;
    room.category = pick.category;
    room.phase = 'reveal';

    playerIds.forEach(id => {
      io.to(id).emit(
        'role',
        id === room.imposterId
          ? { imposter: true, category: room.category }
          : { imposter: false, word: room.word }
      );
    });

    setTimeout(() => {
      room.phase = 'clues';
      room.turnIndex = 0;
      io.to(roomId).emit('start-clues', room);
    }, 5000);
  });

  socket.on('clue', ({ roomId, text }) => {
    const room = rooms[roomId];
    if (!room) return;

    io.to(roomId).emit('clue', {
      name: room.players[socket.id].name,
      text
    });

    const count = Object.keys(room.players).length;
    room.turnIndex = (room.turnIndex + 1) % count;
    io.to(roomId).emit('turn', room.turnIndex);
  });

  socket.on('start-vote', roomId => {
    const room = rooms[roomId];
    if (!room) return;

    room.phase = 'voting';
    room.votes = {};
    io.to(roomId).emit('start-vote', Object.values(room.players));
  });

  socket.on('vote', ({ roomId, target }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.votes[target] = (room.votes[target] || 0) + 1;
  });

  socket.on('end-vote', roomId => {
    const room = rooms[roomId];
    if (!room) return;

    const votedOut = Object.entries(room.votes)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    const crewmatesWin = votedOut === room.imposterId;

    io.to(roomId).emit('result', {
      winner: crewmatesWin ? 'Crewmates' : 'Imposter',
      imposter: room.players[room.imposterId].name,
      word: room.word
    });

    room.phase = 'lobby';
  });

});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server running');
});
