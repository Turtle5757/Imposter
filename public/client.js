const socket = io();
let ROOM;
let isHost = false;
let role = { imposter: false, word: "", category: "", hint: "" };

// --- Lobby ---
function createRoom() {
  const room = document.getElementById("roomName").value;
  const name = document.getElementById("playerName").value || "Host";
  socket.emit("createRoom", room, (success) => {
    if (success) {
      ROOM = room;
      isHost = true;
      enterGame();
    } else alert("Room exists!");
  });
}

function joinRoom(name, room) {
  const playerName = document.getElementById("playerName").value || name;
  socket.emit("joinRoom", room, playerName, (success) => {
    if (success) {
      ROOM = room;
      enterGame();
    } else alert("Failed to join room");
  });
}

function enterGame() {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("game").style.display = "block";
  if (isHost) document.getElementById("hostControls").classList.remove("hidden");
}

// --- Live Room List ---
socket.on("roomList", (rooms) => {
  const ul = document.getElementById("roomList");
  ul.innerHTML = "";
  rooms.forEach(room => {
    const li = document.createElement("li");
    li.innerText = room;
    li.onclick = () => joinRoom("", room);
    ul.appendChild(li);
  });
});

// --- Game Start ---
function startGame() {
  const category = document.getElementById("categorySelect").value;
  const hintsOn = document.getElementById("hintsToggle").checked;
  socket.emit("startGame", { room: ROOM, category, hintsOn });
}

// --- Turn / Clues ---
socket.on("role", (data) => {
  role = data;
  const hintText = (role.imposter && role.hint) ? `Hint: ${role.hint}` : "";
  document.getElementById("roleInfo").innerText = role.imposter
    ? `You are the Imposter! Category: ${role.category} ${hintText}`
    : `You are a Crewmate! Word: ${role.word}`;
});

socket.on("revealPhase", () => {
  document.getElementById("clues").innerHTML = "<p>Revealing roles...</p>";
});

socket.on("cluePhase", () => {
  document.getElementById("clues").innerHTML = "";
});

socket.on("turn", (playerId) => {
  document.getElementById("turnInfo").innerText =
    (socket.id === playerId) ? "Your turn to give a clue!" : "Waiting for other player's clue...";
  if (socket.id === playerId) {
    const clue = prompt("Enter your clue:");
    if (clue) socket.emit("sendClue", { room: ROOM, clue });
  }
});

socket.on("newClue", ({ player, clue }) => {
  const div = document.createElement("div");
  div.innerText = clue;
  document.getElementById("clues").appendChild(div);
});

// --- Voting ---
function startVote() {
  if (isHost) socket.emit("startVote", ROOM);
}

socket.on("votingPhase", (players) => {
  document.getElementById("voting").classList.remove("hidden");
  const voteList = document.getElementById("voteList");
  voteList.innerHTML = "";
  players.forEach(name => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.innerText = `Vote for ${name}`;
    btn.onclick = () => {
      socket.emit("castVote", { room: ROOM, votedName: name });
      btn.disabled = true;
    };
    li.appendChild(btn);
    voteList.appendChild(li);
  });
});

// --- Game End ---
socket.on("gameEnd", ({ imposter, word, winner }) => {
  alert(`Game Over!\nImposter: ${imposter}\nWord: ${word}\nWinner: ${winner}`);
  document.getElementById("playAgainBtn").classList.remove("hidden");
});

function playAgain() {
  socket.emit("playAgain", ROOM);
  document.getElementById("playAgainBtn").classList.add("hidden");
  document.getElementById("clues").innerHTML = "";
  document.getElementById("turnInfo").innerText = "";
  document.getElementById("voting").classList.add("hidden");
}
