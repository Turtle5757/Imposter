const socket = io();
let currentRoom = null;
let me = { id: null, name: null };
let roomState = null;
let roleInfo = null;
let roundTimerInterval = null;

// UI refs
const nameInput = document.getElementById('name');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomInput');
const roomArea = document.getElementById('roomArea');
const roomCodeSpan = document.getElementById('roomCode');
const playersList = document.getElementById('playersList');
const readyBtn = document.getElementById('readyBtn');
const startBtn = document.getElementById('startBtn');
const notifications = document.getElementById('notifications');

const lobbyPanel = document.getElementById('lobby');
const gamePanel = document.getElementById('game');
const roleInfoDiv = document.getElementById('roleInfo');
const gameStatus = document.getElementById('gameStatus');
const timerDiv = document.getElementById('timer');
const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatIn = document.getElementById('chatIn');
const votingDiv = document.getElementById('voting');
const voteList = document.getElementById('voteList');
const revealBtn = document.getElementById('revealBtn');

createBtn.onclick = () => {
  const name = nameInput.value || 'Player';
  socket.emit('createRoom', { name }, res => {
    if (!res.ok) return alert(res.err || 'error');
    onJoinedRoom(res.room, name);
  });
};
joinBtn.onclick = () => {
  const name = nameInput.value || 'Player';
  const code = (roomInput.value || '').toUpperCase();
  if (!code) return alert('Enter a room code or create a room.');
  socket.emit('joinRoom', { name, room: code }, res => {
    if (!res.ok) return alert(res.err || 'Room not found');
    onJoinedRoom(code, name);
  });
};

function onJoinedRoom(code, name) {
  currentRoom = code;
  me.name = name;
  roomCodeSpan.textContent = code;
  roomArea.style.display = '';
  // hide initial join area
  document.getElementById('joinCreate').style.display = 'none';
  notify(`Joined room ${code}`);
}

readyBtn.onclick = () => {
  socket.emit('toggleReady', { room: currentRoom });
};
startBtn.onclick = () => {
  socket.emit('startGame', { room: currentRoom });
};

socket.on('roomUpdate', r => {
  roomState = r;
  renderPlayers(r);
});
socket.on('message', m => {
  appendChat({ system: m.system, text: m.text });
});
socket.on('chat', m => {
  appendChat({ from: m.from, text: m.text });
});
chatForm.onsubmit = e => {
  e.preventDefault();
  const txt = chatIn.value.trim();
  if (!txt) return;
  socket.emit('sendChat', { room: currentRoom, text: txt });
  chatIn.value = '';
};
socket.on('role', info => {
  roleInfo = info;
  // show in game panel
  lobbyPanel.style.display = 'none';
  gamePanel.style.display = '';
  if (info.role === 'impostor') {
    roleInfoDiv.innerHTML = `<strong>You are the IMPOSTOR</strong><br/>Category: <em>${info.category}</em><br/>Give clues but don't get caught.`;
  } else {
    roleInfoDiv.innerHTML = `<strong>You are a CREWMATE</strong><br/>Word: <em>${info.word}</em><br/>Give clues to identify the impostor.`;
  }
});

socket.on('gameStarted', ({countdown, roundSeconds, category}) => {
  gameStatus.textContent = 'Round started — give clues!';
  votingDiv.style.display = '';
  startRoundTimer(roundSeconds);
  appendChat({ system: true, text: `Round started! ${roundSeconds}s — category: ${category}`});
});

socket.on('votesUpdate', votes => {
  renderVotes(votes);
});

socket.on('roundEnded', info => {
  gameStatus.textContent = 'Round ended';
  let txt = `Round ended: ${info.reason}. Impostor: ${info.impostorName}. Word: ${info.word} (Category: ${info.category})`;
  appendChat({ system:true, text: txt });
  // clear role info and show back to lobby after server resets
  roleInfo = null;
  roleInfoDiv.innerHTML = '';
  votingDiv.style.display = 'none';
  stopRoundTimer();
});

socket.on('connect', () => {
  me.id = socket.id;
});

function renderPlayers(r) {
  playersList.innerHTML = '';
  for (const id of Object.keys(r.players)) {
    const p = r.players[id];
    const div = document.createElement('div');
    div.className = 'player' + (p.ready ? ' ready' : '');
    div.textContent = p.name + (id === socket.id ? ' (you)' : '');
    playersList.appendChild(div);
  }
}

function appendChat(m) {
  const d = document.createElement('div');
  d.className = 'msg';
  if (m.system) { d.classList.add('system'); d.textContent = `[SYSTEM] ${m.text}`; }
  else { d.textContent = `${m.from}: ${m.text}`; }
  chatLog.appendChild(d);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderVotes(votes) {
  voteList.innerHTML = '';
  for (const id of Object.keys(roomState.players)) {
    const p = roomState.players[id];
    const b = document.createElement('button');
    b.textContent = `${p.name} (${(votes[id]||[]).length})`;
    b.className = 'voteBtn';
    b.onclick = () => socket.emit('vote', { room: currentRoom, targetId: id });
    voteList.appendChild(b);
  }
}

function startRoundTimer(sec) {
  stopRoundTimer();
  let endAt = Date.now() + sec*1000;
  timerDiv.textContent = `Time left: ${sec}s`;
  roundTimerInterval = setInterval(() => {
    const left = Math.max(0, Math.round((endAt - Date.now())/1000));
    timerDiv.textContent = `Time left: ${left}s`;
    if (left <= 0) stopRoundTimer();
  }, 300);
}
function stopRoundTimer() {
  if (roundTimerInterval) clearInterval(roundTimerInterval);
  timerDiv.textContent = '';
  roundTimerInterval = null;
}

revealBtn.onclick = ()=> {
  if (!confirm('Reveal and end the round?')) return;
  socket.emit('reveal', { room: currentRoom });
};

function notify(t) {
  notifications.textContent = t;
  setTimeout(()=> notifications.textContent = '', 3000);
}
