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

// POPUP ELEMENT FOR ROLE/WORD
const rolePopup = document.createElement("div");
rolePopup.id = "rolePopup";
rolePopup.style.position = "fixed";
rolePopup.style.top = "50%";
rolePopup.style.left = "50%";
rolePopup.style.transform = "translate(-50%, -50%)";
rolePopup.style.background = "#222";
rolePopup.style.color = "white";
rolePopup.style.border = "2px solid #555";
rolePopup.style.padding = "20px";
rolePopup.style.zIndex = "9999";
rolePopup.style.display = "none";
rolePopup.style.whiteSpace = "pre-line";
document.body.appendChild(rolePopup);

function showRolePopup(text) {
  rolePopup.innerText = text;
  rolePopup.style.display = "block";
  setTimeout(() => {
    rolePopup.style.display = "none";
  }, 5000);
}

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("roomList", list => {
  roomList.innerHTML = "";
  list.forEach(r => {
    const li = document.createElement("li");
    li.textContent = `${r.name} (${r.players})`;
    li.onclick = () => {
      roomInput.value = r.name;
    };
    roomList.appendChild(li);
  });
});

socket.on("roomUpdate", room => {
  ROOM = room.name || ROOM;
  if (!room.players[myId]) return;

  playerList.innerHTML = "<h4>Players:</h4>";
  for (const id in room.players) {
    const p = document.createElement("p");
    p.textContent =
      room.players[id].name + (id === room.host ? " (Host)" : "");
    playerList.appendChild(p);
  }

  isHost = room.host === myId;
  hostControls.hidden = !isHost;
});

function createRoom() {
  NAME = nameInput.value.trim();
  ROOM = roomInput.value.trim();
  if (!NAME || !ROOM) {
    alert("Enter a name and room name");
    return;
  }
  socket.emit("createRoom", { name: NAME, room: ROOM });
}

function joinRoom() {
  NAME = nameInput.value.trim();
  ROOM = roomInput.value.trim();
  if (!NAME || !ROOM) {
    alert("Enter a name and room name");
    return;
  }
  socket.emit("joinRoom", { name: NAME, room: ROOM });
}

function startGame() {
  const category = document.getElementById("categorySelect").value;
  const hintsOn = document.getElementById("hintsToggle").checked;
  socket.emit("startGame", { room: ROOM, category, hintsOn });
}

socket.on("role", data => {
  // show popup for role/word
  if(data.imposter) {
    showRolePopup(`You are IMPOSTER\nCategory: ${data.category}${data.hint ? "\nHint: "+data.hint : ""}`);
  } else {
    showRolePopup(`Word: ${data.word}`);
  }
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
  turnText.innerText = "All players have given a clue.";
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
  // instead of reloading, reset only necessary UI
  currentPhase = "lobby";
  lobby.hidden = false;
  game.hidden = true;
  endScreen.hidden = true;
  cluesDiv.innerHTML = "";
  chatDiv.innerHTML = "";
  turnText.innerText = "";
  revealPhaseMsg.innerText = "";
  clueInput.value = "";
}
function disableClue() {
  clueInput.disabled = true;
  sendClueBtn.disabled = true;
}
