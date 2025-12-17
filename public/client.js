const socket = io();
let ROOM, NAME, HOST=false;

function createRoom(){
  NAME=name.value; ROOM=room.value;
  socket.emit("createRoom",{name:NAME,room:ROOM});
}

function joinRoom(){
  NAME=name.value; ROOM=room.value;
  socket.emit("joinRoom",{name:NAME,room:ROOM});
}

function startGame(){
  socket.emit("settings",{
    room:ROOM,
    category:category.value,
    hints:hints.checked
  });
  socket.emit("startGame",ROOM);
}

socket.on("roomUpdate", r=>{
  HOST = r.host === socket.id;
  startBtn.hidden = !HOST;
});

socket.on("role", d=>{
  role.innerText = d.imposter
    ? "IMPOSTER"
    : `Word: ${d.word}\nHint: ${d.hint || "Off"}`;
  lobby.hidden=true;
  game.hidden=false;
});

socket.on("turn", id=>{
  turn.innerText = id===socket.id ? "Your turn" : "Waiting...";
});

function sendClue(){
  socket.emit("sendClue",{room:ROOM,clue:clue.value});
  clue.value="";
}

function startVoting(){
  socket.emit("startVoting",ROOM);
}

socket.on("votingStart", players=>{
  chat.innerHTML="";
  players.forEach(p=>{
    const b=document.createElement("button");
    b.textContent=p.name;
    b.onclick=()=>socket.emit("vote",{room:ROOM,target:p.id});
    chat.appendChild(b);
  });
});

function sendChat(){
  socket.emit("chat",{room:ROOM,name:NAME,msg:msg.value});
  msg.value="";
}

socket.on("chat", d=>{
  chat.innerHTML+=`<p><b>${d.name}:</b> ${d.msg}</p>`;
});

socket.on("gameOver", d=>{
  game.hidden=true;
  end.hidden=false;
  result.innerText=`${d.winner} win\nImposter: ${d.imposter}\nWord: ${d.word}`;
});

function playAgain(){
  socket.emit("playAgain",ROOM);
}

socket.on("resetGame",()=>{
  end.hidden=true;
  lobby.hidden=false;
});
