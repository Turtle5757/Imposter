const socket = io();

const createBtn = document.getElementById('createBtn');
const showRoomsBtn = document.getElementById('showRoomsBtn');
const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
const playerNameInput = document.getElementById('playerName');
const categorySelect = document.getElementById('categorySelect');

const menuDiv = document.getElementById('menu');
const roomListDiv = document.getElementById('roomListDiv');
const roomListUl = document.getElementById('roomList');

const lobbyDiv = document.getElementById('lobby');
const playerListUl = document.getElementById('playerList');
const startGameBtn = document.getElementById('startGameBtn');
const hostButtonsDiv = document.getElementById('hostButtons');

const gameDiv = document.getElementById('game');
const wordDisplay = document.getElementById('wordDisplay');
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const votingDiv = document.getElementById('votingDiv');
const voteButtonsDiv = document.getElementById('voteButtons');
const resultDiv = document.getElementById('resultDiv');

let currentGameId;
let currentTurn = '';
let mySecretWord = '';

// Create Game
createBtn.onclick = () => {
  const name = playerNameInput.value.trim();
  const category = categorySelect.value;
  if(!name) return alert('Enter your name');
  socket.emit('createGame', name, category, gameId=>{
    currentGameId = gameId;
    menuDiv.style.display='none';
    lobbyDiv.style.display='block';
    document.getElementById('gameIdDisplay').textContent = gameId;
  });
};

// Show Rooms
showRoomsBtn.onclick = () => {
  roomListDiv.style.display='block';
  socket.emit('getActiveGames', rooms=>{
    roomListUl.innerHTML='';
    rooms.forEach(r=>{
      const li = document.createElement('li');
      li.textContent = `Room ${r.id} (${r.playerCount}/10)`;
      li.onclick = ()=> joinRoom(r.id);
      roomListUl.appendChild(li);
    });
  });
};
refreshRoomsBtn.onclick = showRoomsBtn.onclick;

// Join Room
function joinRoom(gameId){
  const name = playerNameInput.value.trim();
  if(!name) return alert('Enter your name');
  socket.emit('joinGame', gameId, name, res=>{
    if(res.success){
      currentGameId = gameId;
      menuDiv.style.display='none';
      lobbyDiv.style.display='block';
      document.getElementById('gameIdDisplay').textContent = gameId;
      roomListDiv.style.display='none';
    } else alert(res.message);
  });
}

// Update Players
socket.on('updatePlayers', players=>{
  playerListUl.innerHTML='';
  players.forEach(p=>{
    const li = document.createElement('li');
    li.textContent = p.name;
    playerListUl.appendChild(li);
  });
});

// Start Game
startGameBtn.onclick = ()=> socket.emit('startGame', currentGameId);

// Receive secret word once
socket.on('secretWord', word=> mySecretWord = word);

// Game Started
socket.on('gameStarted', ()=>{
  lobbyDiv.style.display='none';
  gameDiv.style.display='block';
  wordDisplay.textContent = mySecretWord;
});

// Next Turn
socket.on('nextTurn', playerName=>{
  currentTurn = playerName;
  const myName = playerNameInput.value.trim();
  chatInput.disabled = (playerName !== myName);
  wordDisplay.textContent = `${playerName}'s turn to give a clue`;
});

// Submit Clue
sendChatBtn.onclick = ()=>{
  if(currentTurn !== playerNameInput.value.trim()) return alert("Not your turn!");
  const clue = chatInput.value.trim();
  if(!clue) return;
  socket.emit('submitClue', currentGameId, clue);
  chatInput.value='';
};

// Chat Update
socket.on('chatUpdate', msg=>{
  const p = document.createElement('p');
  p.textContent = `${msg.player}: ${msg.message}`;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Round Complete (host)
socket.on('roundComplete', gameId=>{
  if(currentGameId !== gameId) return;

  hostButtonsDiv.innerHTML='';
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next Clue Round';
  nextBtn.onclick = ()=>{
    socket.emit('startNextRound', gameId);
    hostButtonsDiv.innerHTML='';
  };
  hostButtonsDiv.appendChild(nextBtn);

  const voteBtn = document.createE
