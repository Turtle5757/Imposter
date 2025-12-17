const socket = io();

let ROOM, NAME;
let myId = "";
let isHost = false;
let currentPhase = "lobby";

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("roomList", list => {
  const ul = document.getElementById("roomList");
  ul.innerHTML = "";
  list.forEach(r => {
    const li = document.createElement("li");
    li.textContent = `${r.name} (${r.players})`;
    li.onclick = () => document.getElementById("room").value = r.name;
    ul.appendChild(li);
  });
});

socket.on("roomUpdate", room => {
  if (!room.players[myId]) return;

  const list = document.getElementById("playerList");
  list.innerHTML = "<h4>Players:</h4>";

  for (const id in room.players) {
    const p = document.createElement("p");
    p.textContent =
      room.players[id].name + (id === room.host ? " (Host)" : "");
    list.appendChild(p);
  }

  isHost = room.host === myId;
  document.getElementById("hostControls").hidden = !isHost;
});

function createRoom() {
  NAME = name.value;
  ROOM = room.value;
  if (!NAME || !ROOM) return;
  socket.emit("createRoom", { name: NAME, room: ROOM });
}

function joinRoom() {
  NAME = name.value;
  ROOM = room.value;
  if (!NAME || !ROOM) return;
  socket.emit("joinRoom", { name: NAME, room: ROOM });
}

function startGame() {
  socket.emit("startGame", {
    room: ROOM,
    category: categorySelect.value,
    hintsOn: hintsToggle.checked
  });
}

socket.on("role", data => {
  document.getElementById("role").innerText =
    data.imposter
      ? `You are IMPOSTER\nCategory: ${data.category}${data.hint ? "\nHint: " + data.hint : ""}`
      : `Word: ${data.word}`;
});

socket.on("revealPhase", () => {
  lobby.hidden = true;
  game.hidden = false;
  revealPhaseMsg.innerText = "Memorize your word...";
});

socket.on("cluePhase", () => {
  currentPhase = "clues";
  revealPhaseMsg.innerText = "";
  startVoteBtn.hidden = !isHost; // ✅ SHOW BUTTON
  disableClue();
});

socket.on("turn", id => {
  if (id === myId) {
    turn.innerText = "Your Turn!";
    clueInput.disabled = false;
    sendClueBtn.disabled = false;
  } else {
    turn.innerText = "Waiting for other player...";
    disableClue();
  }
});

function sendClue() {
  if (!clueInput.value) return;
  socket.emit("sendClue", { room: ROOM, clue: clueInput.value });
  clueInput.value = "";
  disableClue();
}

socket.on("newClue", data => {
  clues.innerHTML += `<p><b>${data.player}:</b> ${data.clue}</p>`;
});

function startVoting() {
  startVoteBtn.hidden = true;
  chatContainer.hidden = false;
  socket.emit("startVoting", ROOM);
}

socket.on("votingStart", players => {
  clues.innerHTML = "<p>Vote for someone:</p>";
  players.forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = p.name;
    btn.onclick = () => {
      socket.emit("vote", { room: ROOM, target: p.id });
      btn.disabled = true;
    };
    clues.appendChild(btn);
  });
});

function sendChat() {
  if (!msg.value) return;
  socket.emit("chat", { room: ROOM, msg: msg.value, name: NAME });
  msg.value = "";
}

socket.on("chat", data => {
  chat.innerHTML += `<p><b>${data.name}:</b> ${data.msg}</p>`;
});

socket.on("gameOver", data => {
  game.hidden = true;
  endScreen.hidden = false;
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
