const socket = io();
let ROOM, NAME;
let myId = "";
let isImposter = false;
let roleWord = "";
let currentPhase = "lobby";
let isHost = false;
let hintsOn = true;
let selectedCategory = null;

socket.on("connect", ()=>{ myId = socket.id; });

// Room list
socket.on("roomList", list=>{
  const ul = document.getElementById("roomList"); ul.innerHTML="";
  list.forEach(r=>{
    const li=document.createElement("li");
    li.textContent=r.name + " ("+r.players+" players)";
    li.onclick=()=>{ document.getElementById("room").value=r.name; };
    ul.appendChild(li);
  });
});

// Room update
socket.on("roomUpdate", room=>{
  if(!room.players[myId]?.name) return;
  const playerDiv = document.getElementById("playerList");
  playerDiv.innerHTML="<h4>Players in room:</h4>";
  for(const id in room.players){
    const p = document.createElement("p");
    p.innerText=room.players[id].name + (id===room.host?" (Host)":"");
    playerDiv.appendChild(p);
  }
  isHost = (room.host === myId);
  document.getElementById("startGameBtn").hidden = !isHost;
  document.getElementById("categorySelect").hidden = !isHost || currentPhase !== "lobby";
});

// Create/join room
function createRoom(){
  NAME=document.getElementById("name").value; ROOM=document.getElementById("room").value;
  if(!NAME||!ROOM) return; 
  socket.emit("createRoom",{name:NAME,room:ROOM}); 
  enterWaitingRoom();
}
function joinRoom(){
  NAME=document.getElementById("name").value; ROOM=document.getElementById("room").value;
  if(!NAME||!ROOM) return; 
  socket.emit("joinRoom",{name:NAME,room:ROOM}); 
  enterWaitingRoom();
}

function enterWaitingRoom(){
  currentPhase="lobby";
  document.getElementById("lobby").hidden=false;
  document.getElementById("game").hidden=true;
  document.getElementById("endScreen").hidden=true;
}

// Select category & hints
function selectCategory(){
  selectedCategory = document.getElementById("category").value;
  hintsOn = document.getElementById("hintsToggle").checked;
  socket.emit("selectCategory",{room:ROOM,category:selectedCategory==="Random"?null:selectedCategory,hintsOn});
}

// Start game
function startGame(){ socket.emit("startGame",ROOM); }

// Receive role info
socket.on("role", data=>{
  isImposter=data.imposter;
  roleWord=data.word;
  document.getElementById("role").innerText = data.imposter ? 
    "You are IMPOSTER\nCategory: "+data.category :
    "Word: "+data.word + (data.hints.length ? "\nHints: " + data.hints.join(", ") : "");
});

// Reveal phase
socket.on("revealPhase", ()=>{
  document.getElementById("lobby").hidden=true;
  document.getElementById("game").hidden=false;
  currentPhase="reveal";
  document.getElementById("revealPhaseMsg").innerText="Memorize your word / hints...";
});

// Clue phase
socket.on("cluePhase", ()=>{ 
  currentPhase="clues"; 
  document.getElementById("revealPhaseMsg").innerText="";
  enableClueTurn();
  document.getElementById("startVoteBtn").hidden = !isHost;
});

// Turn update
socket.on("turn", id=>{
  const turnLabel=document.getElementById("turn");
  if(currentPhase!=="clues") return;
  if(id===myId){ 
    turnLabel.innerText="Your Turn!"; 
    document.getElementById("clueInput").disabled=false; 
    document.getElementById("sendClueBtn").disabled=false; 
  } else { 
    turnLabel.innerText="Waiting for other player's turn"; 
    document.getElementById("clueInput").disabled=true; 
    document.getElementById("sendClueBtn").disabled=true; 
  }
});

socket.on("allTurnsDone", ()=>{ 
  document.getElementById("turn").innerText="All clues done. Host can start voting."; 
});

// Send clue
function sendClue(){
  const input=document.getElementById("clueInput"); 
  if(!input.value) return;
  socket.emit("sendClue",{room:ROOM,clue:input.value}); 
  input.value=""; 
  document.getElementById("clueInput").disabled=true; 
  document.getElementById("sendClueBtn").disabled=true;
}

// Display new clue
socket.on("newClue", data=>{ 
  const div=document.getElementById("clues"); 
  div.innerHTML+=`<p><b>${data.player}:</b> ${data.clue}</p>`; 
  div.scrollTop=div.scrollHeight; 
});

// Start voting
function startVoting(){ 
  currentPhase="voting"; 
  document.getElementById("chatContainer").hidden=false;
  socket.emit("startVoting",ROOM); 
}

// Voting buttons
socket.on("votingStart", players=>{
  const div=document.getElementById("clues"); 
  div.innerHTML="<p>Voting started! Click a player to vote:</p>";
  players.forEach(p=>{
    const btn=document.createElement("button"); 
    btn.textContent=p.name; 
    btn.onclick=()=>{
      socket.emit("vote",{room:ROOM,target:p.id}); 
      btn.disabled=true; 
    }; 
    div.appendChild(btn); 
  });
});

// Chat during voting
function sendChat(){ 
  const m=document.getElementById("msg"); 
  if(!m.value) return; 
  socket.emit("chat",{room:ROOM,msg:m.value,name:NAME}); 
  m.value=""; 
}

socket.on("chat", data=>{ 
  const div=document.getElementById("chat"); 
  div.innerHTML+=`<p><b>${data.name}:</b> ${data.msg}</p>`; 
  div.scrollTop=div.scrollHeight; 
});

// Game over
socket.on("gameOver", data=>{
  document.getElementById("game").hidden=true;
  const end=document.getElementById("endScreen"); end.hidden=false;
  document.getElementById("endInfo").innerText=`Imposter: ${data.imposter}\nWord: ${data.word}\nWinner: ${data.winner}`;
  document.getElementById("chatContainer").hidden=true;
});

// Play again without leaving room
function playAgain(){ 
  currentPhase="lobby"; 
  document.getElementById("endScreen").hidden=true; 
  document.getElementById("game").hidden=false; 
  document.getElementById("clues").innerHTML="";
  document.getElementById("chat").innerHTML="";
  document.getElementById("turn").innerText="";
  document.getElementById("revealPhaseMsg").innerText="";
  if(isHost) document.getElementById("categorySelect").hidden=false;
}

// Disable clue input by default
function enableClueTurn(){ 
  document.getElementById("clueInput").disabled=true; 
  document.getElementById("sendClueBtn").disabled=true; 
}
