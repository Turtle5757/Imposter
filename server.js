const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Basic in-memory rooms store
const rooms = {}; // roomCode -> { players: {socketId: {name, ready, id}}, impostorId, word, category, state, votes }

function makeRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i=0;i<4;i++) code += letters[Math.floor(Math.random()*letters.length)];
  return code;
}

// small sample words by category
const WORD_BANK = {
  "Fruit": ["apple","banana","pineapple","orange","grape"],
  "Occupation": ["chef","teacher","engineer","pilot","barista"],
  "Animal": ["elephant","tiger","dolphin","kangaroo","parrot"],
  "Tool": ["hammer","scissors","wrench","drill","screwdriver"],
  "Transport": ["bicycle","airplane","boat","train","scooter"]
};

function randFrom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

io.on('connection', socket => {
  console.log('conn', socket.id);

  socket.on('createRoom', ({name}, cb) => {
    let code;
    do { code = makeRoomCode(); } while (rooms[code]);
    rooms[code] = {
      players: {},
      state: 'lobby', // lobby, playing, ended
      impostorId: null,
      word: null,
      category: null,
      votes: {}, // targetId -> [voterIds]
      timer: null,
      roundEndAt: null
    };
    socket.join(code);
    rooms[code].players[socket.id] = { name: name || 'Player', ready: false, id: socket.id };
    cb({ ok: true, room: code });
    io.to(code).emit('roomUpdate', rooms[code]);
  });

  socket.on('joinRoom', ({name, room}, cb) => {
    if (!rooms[room]) return cb({ ok:false, err:'Room not found' });
    socket.join(room);
    rooms[room].players[socket.id] = { name: name || 'Player', ready: false, id: socket.id };
    cb({ ok:true, room });
    io.to(room).emit('roomUpdate', rooms[room]);
  });

  socket.on('toggleReady', ({room}) => {
    const r = rooms[room];
    if (!r) return;
    if (!r.players[socket.id]) return;
    r.players[socket.id].ready = !r.players[socket.id].ready;
    io.to(room).emit('roomUpdate', r);
  });

  socket.on('startGame', ({room}) => {
    const r = rooms[room];
    if (!r) return;
    const pids = Object.keys(r.players);
    if (pids.length < 3) {
      socket.emit('message', { system: true, text: 'Need at least 3 players to start.'});
      return;
    }
    // assign impostor
    const impostorId = randFrom(pids);
    const category = randFrom(Object.keys(WORD_BANK));
    const word = randFrom(WORD_BANK[category]);

    r.impostorId = impostorId;
    r.category = category;
    r.word = word;
    r.state = 'playing';
    r.votes = {};
    // clear ready flags
    for (const id of pids) r.players[id].ready = false;

    // send private messages
    for (const id of pids) {
      if (id === impostorId) {
        io.to(id).emit('role', { role: 'impostor', category });
      } else {
        io.to(id).emit('role', { role: 'crewmate', word });
      }
    }

    // broadcast game start
    io.to(room).emit('gameStarted', { countdown: 60, roundSeconds: 60, category }); // example 60s round
    // simple timer
    r.roundEndAt = Date.now() + 60*1000;
    if (r.timer) clearTimeout(r.timer);
    r.timer = setTimeout(() => endRound(room, 'time'), 60*1000);
    io.to(room).emit('roomUpdate', r);
  });

  socket.on('sendChat', ({room, text}) => {
    if (!rooms[room]) return;
    const player = rooms[room].players[socket.id];
    if (!player) return;
    io.to(room).emit('chat', { from: player.name, id: socket.id, text, when: Date.now() });
  });

  socket.on('vote', ({room, targetId}) => {
    const r = rooms[room];
    if (!r || r.state !== 'playing') return;
    // record vote
    if (!r.votes[targetId]) r.votes[targetId] = [];
    // prevent double-vote (simple)
    // remove this voter's previous votes
    for (const t in r.votes) {
      r.votes[t] = r.votes[t].filter(v => v !== socket.id);
    }
    r.votes[targetId].push(socket.id);
    io.to(room).emit('votesUpdate', r.votes);
    // check majority
    const total = Object.keys(r.players).length;
    const maxVotes = Math.max(...Object.values(r.votes).map(a=>a.length), 0);
    if (maxVotes > total/2) {
      // eject the one with majority
      const ejectId = Object.keys(r.votes).reduce((a,b) => (r.votes[a].length>r.votes[b].length? a:b));
      io.to(room).emit('message', { system:true, text: `${r.players[ejectId].name} was ejected.`});
      // if impostor ejected -> crewmates win
      const impostorEjected = ejectId === r.impostorId;
      endRound(room, impostorEjected ? 'impostor_ejected' : 'impostor_survived', {ejectId});
    }
  });

  socket.on('reveal', ({room}) => {
    // force reveal / reset by host (not implemented ownership, simple allow)
    endRound(room, 'manual_reveal');
  });

  socket.on('disconnect', () => {
    // remove from any room
    for (const code of Object.keys(rooms)) {
      if (rooms[code].players[socket.id]) {
        delete rooms[code].players[socket.id];
        io.to(code).emit('roomUpdate', rooms[code]);
        // if room empty, delete
        if (Object.keys(rooms[code].players).length === 0) {
          if (rooms[code].timer) clearTimeout(rooms[code].timer);
          delete rooms[code];
        } else {
          // if game ongoing and impostor left, end round
          if (rooms[code].state === 'playing' && socket.id === rooms[code].impostorId) {
            endRound(code, 'impostor_left');
          }
        }
      }
    }
  });

  function endRound(room, reason, extra={}) {
    const r = rooms[room];
    if (!r) return;
    if (r.timer) { clearTimeout(r.timer); r.timer = null; r.roundEndAt = null; }
    r.state = 'ended';
    io.to(room).emit('roundEnded', {
      reason,
      impostorId: r.impostorId,
      impostorName: r.players[r.impostorId]?.name || 'Unknown',
      word: r.word,
      category: r.category,
      extra
    });
    // reset after short time to lobby (or keep ended until host restarts)
    setTimeout(()=> {
      if (!rooms[room]) return;
      r.state = 'lobby';
      r.impostorId = null;
      r.word = null;
      r.category = null;
      r.votes = {};
      io.to(room).emit('roomUpdate', r);
    }, 8000);
  }
});
server.listen(PORT, ()=> console.log('listening', PORT));
