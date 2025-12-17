const socket = io();

let ROOM = "";
let NAME = "";
let myId = "";
let isHost = false;
let currentPhase = "lobby";
let isImposter = false;
let roleWord = "";
let hintsOn = true;

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

socket.on("connect", () => { myId = socket.id; });

socket.on("roomList", list => {
  roomList.innerHTML = "";
  list.forEach(r => {
    const li = document.createElement("li");
    li.textContent = `${r.name} (${r.players} players)`;
    li.onclick = () => { roomInput.value = r.name; };
    roomList.appendChild(li);
  });
});

socket.on("roomUpdate", room => {
  ROOM = room.name || ROOM;
  if (!room.players[myId]) return;

  playerList.innerHTML = "<h4>Players:</h4>";
  for (const id in room.players) {
    const p = document.createElement("p");
    p.textContent = room.players[id].name + (id === room.host ? " (Host)" : "");
    playerList.appendChild(p);
  }

  isHost = room.host === myId;
  hostControls.hidden = !isHost;
});

function createRoom() {
  NAME = nameInput.value.trim();
  ROOM = roomInput.value.trim();
  if (!NAME || !ROOM) { alert("Enter a name and room"); return; }
  socket.emit("createRoom", { name: NAME, room: ROOM });
}

function joinRoom() {
  NAME = nameInput.value.trim();
  ROOM = roomInput.value.trim();
  if (!NAME || !ROOM) { alert("Enter a name and room"); return; }
  socket.emit("joinRoom", { name: NAME, room: ROOM });
}

function startGame() {
  const category = document.getElementById("categorySelect").value;
  hintsOn = document.getElementById("hintsToggle").checked;
  socket.emit("startGame", { room: ROOM, category, hintsOn });
}

socket.on("role", data => {
  isImposter = data.imposter;
  roleWord = data.word;

  // Popup for role/word only
  const popup = document.createElement("div");
  popup.style.position = "fixed";
  popup.style.top = "50%";
  popup.style.left = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.backgroundColor = "#222";
  popup.style.color = "white";
  popup.style.padding = "20px";
  popup.style.border = "2px solid #fff";
  popup.style.zIndex = "1000";
  popup.style.textAlign = "center";
  popup.style.fontSize = "1.2em";
  popup.style.borderRadius = "8px";
  popup.innerText = isImposter
    ? `You are IMPOSTER\nCategory: ${data.category}${hintsOn && data.hint ? "\nHint: " + data.hint : ""}`
    : `Word: ${data.word}`;
  document.body.appendChild(popup);

  setTimeout(() => popup.remove(), 5000);
});

socket.on("revealPhase", () => {
  lobby.hidden = true;
  game.hidden = false;
  endScreen.hidden = true;
  revealPhaseMsg.innerText = "Memorize your role...";
  chatContainer.hidden = true;
});

socket.on("cluePhase", () => {
  currentPhase = "clues";
  revealPhaseMsg.innerText = "";
  startVoteBtn.hidden = !isHost;
  chatContainer.hidden = true;
  disableClue();
});

socket.on("turn", id => {
  if (id === myId) {
    turnText.innerText = "Your Turn!";
    clueInput.disabled = false;
    sendClueBtn.disabled = false;
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
  turnText.innerText = "All players have given clues. Host can start voting.";
});

function sendClue() {
  if (!clueInput.value.trim()) return;
  socket.emit("sendClue", { room: ROOM, clue: clueInput.value });
  clueInput.value = "";
  disableClue();
}

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
    btn.onclick = () => {
      socket.emit("vote", { room: ROOM, target: p.id });
      btn.disabled = true;
    };
    cluesDiv.appendChild(btn);
  });
});

function sendChat() {
  if (!msgInput.value.trim()) return;
  socket.emit("chat", { room: ROOM, msg: msgInput.value, name: NAME });
  msgInput.value = "";
}

socket.on("chat", data => {
  chatDiv.innerHTML += `<p><b>${data.name}:</b> ${data.msg}</p>`;
  chatDiv.scrollTop = chatDiv.scrollHeight;
});

socket.on("gameOver", data => {
  game.hidden = true;
  endScreen.hidden = false;
  chatContainer.hidden = true;
  endInfo.innerText =
    `Imposter: ${data.imposter}\nWord: ${data.word}\nWinner: ${data.winner}`;
});

function playAgain() {
  location.reload();
}

function disableClue() {
  clueInput.disabled = true;
  sendClueBtn.disabled = true;
}
