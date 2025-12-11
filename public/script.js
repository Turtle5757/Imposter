const socket = io();

const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const playerNameInput = document.getElementById('playerName');
const categorySelect = document.getElementById('categorySelect');
const joinGameIdInput = document.getElementById('joinGameId');

const menuDiv = document.getElementById('menu');
const lobbyDiv = document.getElementById('lobby');
const playerListUl = document.getElementById('playerList');
const startGameBtn = document.getElementById('startGameBtn');
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

// Join game
joinBtn.onclick = () => {
    const name = playerNameInput.value.trim();
    const gameId = joinGameIdInput.value.trim();
    if(!name || !gameId) return alert('Enter name and Game ID');
    socket.emit('joinGame', gameId, name, (res)=>{
        if(res.success){
            currentGameId = gameId;
            menuDiv.style.display='none';
            lobbyDiv.style.display='block';
            gameIdDisplay.textContent=gameId;
        } else { alert(res.message); }
    });
};

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
socket.on('secretWord', word => wordDisplay.textContent=word);
socket.on('gameStarted', ()=>{
    lobbyDiv.style.display='none';
    gameDiv.style.display='block';
});

// Chat
sendChatBtn.onclick = ()=>{
    const msg = chatInput.value.trim();
    if(!msg) return;
    socket.emit('sendChat', currentGameId, msg);
    chatInput.value='';
};
socket.on('chatUpdate', chatMsg=>{
    const p = document.createElement('p');
    p.textContent=`${chatMsg.player}: ${chatMsg.message}`;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// Voting phase
socket.on('gameResult', data=>{
    votingDiv.style.display='none';
    resultDiv.style.display='block';
    wordDisplay.textContent='';
    let html = `<h2>Imposter: ${data.imposter}</h2>`;
    html += `<h3>Voted Player: ${data.votedPlayer}</h3>`;
    html += `<p>Secret Word: ${data.word}</p>`;
    html += `<p>Clues:</p>`;
    data.chat.forEach(c=>html+=`<p>${c.player}: ${c.message}</p>`);
    resultDiv.innerHTML=html;
});
