const socket = io();

let ROOM = "";
let NAME = "";
let myId = "";
let isHost = false;
let currentPhase = "lobby";

const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const endScreen = document.getElementById("endScreen");

const roomList = document.getElementById("roomList");
const playerList = document.getElementById("playerList");

const nameInput = document.getElementById("name");
const roomInput = document.getElementById("room");

const hostControls = document.getElementById("hostControls");
const startVoteBtn = document.getElementById("startVoteBtn");

const roleText = document.getElementById("role");
const revealPhaseMsg = document.getElementById("revealPhaseMsg");
const turnText = document.getElementById("turn");

const cluesDiv = document.getElementById("clues");
const clueInput = document.getElementById("clueInput");
const sendClueBtn = document.getElementById("sendClueBtn");

const chatContainer = document.getElementById("chatContainer");
const chatDiv = document.getElementById("chat");
const msgInput = document.getElementById("msg");

const endInfo = document.getElementById("endInfo");

// Popup for reveal
const rolePopup = document.getElementById("rolePopup");
const rolePopupText = document.getElementById("rolePopupText");

socket.on("connect", () => {
  myId = socket.id;
});

// ROOM LIST UPDATE
socket.on("roomList", list => {
  roomList.innerHTML = "";
  list.forEach(r => {
    const li = document.createElement("li");
    li.textContent = `${r.name} (${r.players})`;
    li.onclick = () => { roomInput.value = r.name; };
    roomList.appendChild(li);
  });
});

// ROOM UPDATE
socket.on("roomUpdate", room => {
  ROOM = room.name || ROOM;
  if(!room.players[myId]) return;

  playerList.innerHTML = "<h4>Players:</h4>";
  for(const id in room.players){
    const p = document.createElement("p");
    p.textContent = room.players[id].name + (id===room.host ? " (Host)" : "");
    playerList.appendChild(p);
  }

  isHost = room.host === myId;
  hostControls.hidden = !isHost;
});

// CREATE / JOIN ROOM
function createRoom() {
  NAME = nameInput.value.trim(); ROOM = roomInput.value.trim();
  if(!NAME||!ROOM){ alert("Enter a name and room"); return; }
  socket.emit("createRoom", {name: NAME, room: ROOM});
}

function joinRoom() {
  NAME = nameInput.value.trim(); ROOM = roomInput.value.trim();
  if(!NAME||!ROOM){ alert("Enter a name and room"); return; }
  socket.emit("joinRoom", {name: NAME, room: ROOM});
}

// START GAME
function startGame() {
  const category = document.getElementById("categorySelect").value;
  const hintsOn = document.getElementById("hintsToggle").checked;
  socket.emit("startGame", {room: ROOM, category, hintsOn});
}

// ROLE POPUP
socket.on("role", data => {
  rolePopupText.innerText = data.imposter 
    ? `You are IMPOSTER\nCategory: ${data.category}${data.hint ? "\nHint: "+data.hint : ""}`
    : `Word: ${data.word}`;
  rolePopup.hidden = false;
});

socket.on("revealPhase", () => {
  lobby.hidden = true; game.hidden = false; endScreen.hidden = true;
  revealPhaseMsg.innerText = "Memorize your role...";
  chatContainer.hidden = true;
  setTimeout(() => { rolePopup.hidden = true; }, 5000);
});

// CLUE PHASE
socket.on("cluePhase", () => {
  currentPhase = "clues";
  revealPhaseMsg.innerText = "";
  startVoteBtn.hidden = !isHost;
  chatContainer.hidden = true;
  disableClue();
});

socket.on("turn", id => {
  if(id === myId){
    turnText.innerText = "Your Turn!";
    clueInput.disabled = false; sendClueBtn.disabled = false;
  } else {
    turnText.innerText = "Waiting for another player...";
    disableClue();
  }
});

socket.on("newClue", data => {
  cluesDiv.innerHTML += `<p><b>${data.player}:</b> ${data.clue}</p>`;
  cluesDiv.scrollTop = cluesDiv.scrollHeight;
});

socket.on("allTurnsDone", () => {
  turnText.innerText = "All players have given a clue.";
});

function sendClue() {
  if(!clueInput.value.trim()) return;
  socket.emit("sendClue",{room: ROOM, clue: clueInput.value});
  clueInput.value = "";
  disableClue();
}

function disableClue() {
  clueInput.disabled = true;
  sendClueBtn.disabled = true;
}

// VOTING
function startVoting() {
  startVoteBtn.hidden = true;
  socket.emit("startVoting", ROOM);
}

socket.on("votingStart", players => {
  currentPhase = "voting";
  chatContainer.hidden = false;

  cluesDiv.innerHTML = "<p>Voting started. Click a player:</p>";
  players.forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = p.name;
    btn.onclick = () => { socket.emit("vote",{room: ROOM,target: p.id}); btn.disabled = true; };
    cluesDiv.appendChild(btn);
  });
});

// CHAT
function sendChat() {
  if(!msgInput.value.trim()) return;
  socket.emit("chat",{room: ROOM, msg: msgInput.value, name: NAME});
  msgInput.value = "";
}

socket.on("chat", data => {
  chatDiv.innerHTML += `<p><b>${data.name}:</b> ${data.msg}</p>`;
  chatDiv.scrollTop = chatDiv.scrollHeight;
});

// GAME OVER
socket.on("gameOver", data => {
  game.hidden = true; endScreen.hidden = false;
  chatContainer.hidden = true;
  endInfo.innerText = `Imposter: ${data.imposter}\nWord: ${data.word}\nWinner: ${data.winner}`;
});

// PLAY AGAIN (reset everything but keep in room, host stays if possible)
function playAgain() {
  socket.emit("playAgain", ROOM);
  currentPhase = "lobby";
  lobby.hidden = false; game.hidden = true; endScreen.hidden = true;
  cluesDiv.innerHTML = ""; chatDiv.innerHTML = "";
  turnText.innerText = ""; revealPhaseMsg.innerText = "";
  clueInput.value = ""; disableClue();
}
