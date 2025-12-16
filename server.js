const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuid } = require('uuid');
const { createRoom, rooms } = require('./rooms');


const app = express();
const server = http.createServer(app);
const io = new Server(server);


app.use(express.static('public'));


io.on('connection', socket => {
socket.on('create-room', ({ name }) => {
const roomId = uuid().slice(0, 6);
createRoom(roomId, socket.id, name);
socket.join(roomId);
socket.emit('room-joined', rooms[roomId]);
io.emit('rooms-update', Object.values(rooms));
});


socket.on('join-room', ({ roomId, name }) => {
const room = rooms[roomId];
if (!room) return;
room.players[socket.id] = { id: socket.id, name };
socket.join(roomId);
io.to(roomId).emit('room-update', room);
});


socket.on('start-game', roomId => {
const room = rooms[roomId];
room.startGame();
io.to(roomId).emit('game-started', room.getPublicState());
});


socket.on('clue', ({ roomId, text }) => {
io.to(roomId).emit('clue', text);
});


socket.on('start-vote', roomId => {
io.to(roomId).emit('voting-started');
});


socket.on('vote', ({ roomId, target }) => {
const room = rooms[roomId];
room.votes[target] = (room.votes[target] || 0) + 1;
});


socket.on('end-vote', roomId => {
const room = rooms[roomId];
room.finishVote();
io.to(roomId).emit('game-ended', room.result);
});
});


server.listen(process.env.PORT || 3000);
