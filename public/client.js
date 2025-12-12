const socket = io();

let ROOM = null;
let NAME = "";
let IS_HOST = false;

function show(id) {
  document.querySelectorAll("body > div").forEach(d => d.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

document.getElementById("create").onclick = () => {
  socket.emit("createRoom");
};

document.getElementById("join").onclick = () => {
  NAME = document.getElementById("playerName").value;
  const roomId = document.getElementById("joinId").value;

  socket.emit("joinRoom", { roomId, name: NAME });
};

socket.on("roomCreated", roomId => {
  ROOM = roomId;
  NAME = "Host";
  IS_HOST = true;

  document.getElementById("roomCode").innerText = roomId;
  show("room");
});

socket.on("roomUpdate", room => {
  ROOM = Object.keys(room.players).length ? ROOM : null;

  const list = document.getElementById("players");
  list.innerHTML = "";

  for (const [pid, p] of Object.entries(room.players)) {
    const div = document.createElement("div");
    div.innerText = p.name + (p.ready ? " ✔️" : "");
    list.appendChild(div);
  }

  if (socket.id === room.host) {
    IS_HOST = true;
    document.querySelectorAll(".hostOnly").forEach(b => b.classList.remove("hidden"));
  }
});

document.getElementById("readyBtn").onclick = () => {
  socket.emit("setReady", { roomId: ROOM });
};

document.getElementById("startGameBtn").onclick = () => {
  socket.emit("startGame", { roomId: ROOM });
};

socket.on("role", ({ role, category, word }) => {
  show("roleScreen");

  document.getElementById("roleName").innerText = role.toUpperCase();
  document.getElementById("wordInfo").innerText =
    role === "imposter"
      ? "Category: " + category + " (NO WORD!)"
      : "Category: " + category + " — Word: " + word;
});

socket.on("newTurn", ({ player, clues }) => {
  show("clueScreen");

  document.getElementById("turnPlayer").innerText = player;
  const list = document.getElementById("clueList");
  list.innerHTML = "";
  clues.forEach(c => {
    const d = document.createElement("div");
    d.innerText = c.player + ": " + c.text;
    list.appendChild(d);
  });
});

document.getElementById("sendClueBtn").onclick = () => {
  const clue = document.getElementById("clueText").value;
  socket.emit("sendClue", { roomId: ROOM, clue });
  document.getElementById("clueText").value = "";
};

document.getElementById("startVotingBtn").onclick = () => {
  socket.emit("startVoting", { roomId: ROOM });
};

socket.on("votingStarted", ({ players }) => {
  show("votingScreen");

  const list = document.getElementById("voteList");
  list.innerHTML = "";

  for (const [pid, p] of Object.entries(players)) {
    const btn = document.createElement("button");
    btn.innerText = p.name;
    btn.onclick = () => socket.emit("submitVote", { roomId: ROOM, voteFor: pid });
    list.appendChild(btn);
  }
});

socket.on("results", ({ votedOut, imposter }) => {
  show("resultScreen");

  document.getElementById("resultText").innerText =
    (votedOut === imposter
      ? "The group found the Imposter!"
      : "The Imposter survived!") +
    "\n\nImposter was: " + imposter;
});
