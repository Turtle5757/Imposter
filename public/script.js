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
const startVotingBtn = document.getElementById('startVotingBtn');
const nextRoundDiv = document.getElementById('nextRoundDiv');

const gameDiv = document.getElementById('game');
const gameIdDisplay = document.getElementById('gameIdDisplay');
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

// Create game
createBtn.onclick = () => {
    const name = playerNameInput.value.trim();
    const category = categorySelect.value;
    if(!name) return alert('Enter your name');
    socket.emit('createGame', name, category, (gameId)=>{
        currentGameId = gameId;
        menuDiv.style.display='none';
        lobbyDiv.style.display='block';
        gameIdDisplay.textContent=gameId;
    });
};

// Show available rooms
showRoomsBtn.onclick = () => {
    roomListDiv.style.display='block';
    socket.emit('getActiveGames', rooms => {
        roomListUl.innerHTML = '';
        rooms.forEach(r => {
            const li = document.createElement('li');
            li.textContent = `Room ${r.id} (${r.playerCount}/10)`;
            li.onclick = () => joinRoom(r.id);
            roomListUl.appendChild(li);
        });
    });
};
refreshRoomsBtn.onclick = showRoomsBtn.onclick;

// Join room
function joinRoom(gameId){
    const name = playerNameInput.value.trim();
    if(!name) return alert('Enter your name');
    socket.emit('joinGame', gameId, name, res => {
        if(res.success){
            currentGameId = gameId;
            menuDiv.style.display='none';
            lobbyDiv.style.display='block';
            gameIdDisplay.textContent=currentGameId;
            roomListDiv.style.display='none';
        } else alert(res.message);
    });
}

// Update players
socket.on('updatePlayers', players=>{
    playerListUl.innerHTML='';
    players.forEach(p=>{
        const li = document.createElement('li');
        li.textContent=p.name;
        playerListUl.appendChild(li);
    });
});

// Start game
startGameBtn.onclick = ()=>socket.emit('startGame', currentGameId);

// Receive secret word once
socket.on('secretWord', word => {
    mySecretWord = word;
});

// Game started
socket.on('gameStarted', ()=> {
    lobbyDiv.style.display='none';
    gameDiv.style.display='block';
    wordDisplay.textContent = mySecretWord; // show secret word once
});

// Next turn
socket.on('nextTurn', playerName=>{
    currentTurn = playerName;
    wordDisplay.textContent = `${playerName}'s turn to give a clue`;
});

// Submit clue
sendChatBtn.onclick = () => {
    const clue = chatInput.value.trim();
    if(!clue) return;
    if(currentTurn !== playerNameInput.value.trim()){
        alert("Not your turn!");
        return;
    }
    socket.emit('submitClue', currentGameId, clue);
    chatInput.value='';
};

// Chat updates
socket.on('chatUpdate', chatMsg=>{
    const p = document.createElement('p');
    p.textContent = `${chatMsg.player}: ${chatMsg.message}`;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// After all players give clue
socket.on('roundComplete', gameId => {
    if(currentGameId !== gameId) return;

    startVotingBtn.style.display='inline-block';
    nextRoundDiv.innerHTML = '';
    // Host can start next round
    if(socket.id === document.getElementById('playerList').querySelector('li')?.id){
        const nextRoundBtn = document.createElement('button');
        nextRoundBtn.textContent='Next Clue Round';
        nextRoundBtn.onclick = () => {
            socket.emit('startNextRound', gameId);
            nextRoundBtn.remove();
            startVotingBtn.style.display='none';
        };
        nextRoundDiv.appendChild(nextRoundBtn);
    }
});

// Start voting
startVotingBtn.onclick = ()=> {
    socket.emit('startVoting', currentGameId);
    startVotingBtn.style.display='none';
    nextRoundDiv.innerHTML='';
};

socket.on('startVoting', playerNames=>{
    votingDiv.style.display='block';
    voteButtonsDiv.innerHTML='';
    playerNames.forEach(name=>{
        const btn = document.createElement('button');
        btn.textContent=name;
        btn.onclick = () => {
            socket.emit('vote', currentGameId, name);
            votingDiv.style.display='none';
            wordDisplay.textContent='Waiting for results...';
        };
        voteButtonsDiv.appendChild(btn);
    });
});

// Game result
socket.on('gameResult', data=>{
    votingDiv.style.display='none';
    resultDiv.style.display='block';
    wordDisplay.textContent='';
    let html = `<h2>Imposter: ${data.imposter}</h2>`;
    html += `<h3>Voted Player: ${data.votedPlayer}</h3>`;
    html += `<p>Secret Word: ${data.word}</p>`;
    html += `<p>Clues:</p>`;
    data.chat.forEach(c=>html+=`<p>${c.player}: ${c.message}</p>`);
    resultDiv.innerHTML = html;
});
