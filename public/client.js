const socket = io();
let ROOM, NAME;

function updateRoomList(list){
  const ul = document.getElementById("roomList");
  ul.innerHTML = "";
  list.forEach(r=>{
    const li = document.createElement("li");
    li.textContent = r.name + " ("+r.players+" players)";
    li.onclick = ()=>{ document.getElementById("room").value = r.name; };
    ul.appendChild(li);
  });
}

socket.on("roomList", updateRoomList);

function createRoom(){
  NAME = document.getElementById("name").value;
  ROOM = document.getElementById("room").value;
  if(!NAME||!ROOM) return;
  socket.emit("createRoom",{name:NAME, room:ROOM});
  document.getElementById("lobby").hidden=true;
  document.getElementById("game").hidden=false;
}

function joinRoom(){
  NAME = document.getElementById("name").value;
  ROOM = document.getElementById("room").value;
  if(!NAME||!ROOM) return;
  socket.emit("joinRoom",{name:NAME, room:ROOM});
  document.getElementById("lobby").hidden=true;
  document.getElementById("game").hidden=false;
}

socket.on("role", data=>{
  document.getElementById("role").innerText = data.imposter
    ? "You are IMPOSTER\nCategory: "+data.category
    : "Word: "+data.word;
});

socket.on("turn", id=>{
  const myId = socket.id;
  document.getElementById("turn").innerText = id===myId ? "Your Turn!" : "Waiting for "+id;
  document.getElementById("clueInput").disabled = id!==myId;
});

function sendClue(){
  const input = document.getElementById("clueInput");
  if(!input.value) return;
  socket.emit("sendClue",{room:ROOM, clue:input.value});
  input.value="";
}

socket.on("newClue", data=>{
  const div = document.getElementById("clues");
  div.innerHTML += `<p><b>${data.player}:</b> ${data.clue}</p>`;
  div.scrollTop = div.scrollHeight;
});

function nextTurn(){ socket.emit("nextTurn", ROOM); }
function startVoting(){ socket.emit("startVoting", ROOM); }
function sendChat(){
  const m = document.getElementById("msg");
  if(!m.value) return;
  socket.emit("chat",{room:ROOM,msg:m.value,name:NAME});
  m.value="";
}

socket.on("chat", data=>{
  const div = document.getElementById("chat");
  div.innerHTML += `<p><b>${data.name}:</b> ${data.msg}</p>`;
  div.scrollTop = div.scrollHeight;
});

socket.on("gameOver", data=>{
  alert("Imposter: "+data.imposter+"\nWord: "+data.word+"\nWinner: "+data.winner);
  document.getElementById("game").hidden=true;
  document.getElementById("lobby").hidden=false;
});
