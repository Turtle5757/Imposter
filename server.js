const express = require('express');
category: null,
turnIndex: 0,
votes: {}
};
rooms[id].players[socket.id] = { id: socket.id, name };
socket.join(id);
io.emit('rooms', Object.values(rooms));
socket.emit('joined', id);
});


socket.on('join-room', ({ roomId, name }) => {
const room = rooms[roomId];
if (!room) return;
room.players[socket.id] = { id: socket.id, name };
socket.join(roomId);
io.to(roomId).emit('update', room);
});


socket.on('start-game', roomId => {
const room = rooms[roomId];
const ids = Object.keys(room.players);
room.imposter = ids[Math.floor(Math.random() * ids.length)];
const pick = words[Math.floor(Math.random() * words.length)];
room.word = pick.word;
room.category = pick.category;
room.phase = 'reveal';


ids.forEach(id => {
io.to(id).emit('role', id === room.imposter
? { imposter: true, category: room.category }
: { imposter: false, word: room.word }
);
});


setTimeout(() => {
room.phase = 'clues';
io.to(roomId).emit('start-clues', room);
}, 5000);
});


socket.on('clue', ({ roomId, text }) => {
const room = rooms[roomId];
io.to(roomId).emit('clue', { name: room.players[socket.id].name, text });
room.turnIndex = (room.turnIndex + 1) % Object.keys(room.players).length;
io.to(roomId).emit('turn', room.turnIndex);
});


socket.on('start-vote', roomId => {
const room = rooms[roomId];
room.phase = 'voting';
room.votes = {};
io.to(roomId).emit('start-vote', Object.values(room.players));
});


socket.on('vote', ({ roomId, target }) => {
const room = rooms[roomId];
room.votes[target] = (room.votes[target] || 0) + 1;
});


socket.on('end-vote', roomId => {
const room = rooms[roomId];
const out = Object.entries(room.votes).sort((a,b)=>b[1]-a[1])[0]?.[0];
const win = out === room.imposter ? 'Crewmates' : 'Imposter';
io.to(roomId).emit('result', {
winner: win,
imposter: room.players[room.imposter].name,
word: room.word
});
room.phase = 'lobby';
});


});


server.listen(process.env.PORT || 3000);
