const socket=io();
let myName="",myRole="",myGame="";

document.getElementById("createBtn").addEventListener("click",()=>{
    myName=document.getElementById("name").value;
    if(!myName)return alert("Enter name");
    socket.emit("createGame",{name:myName},res=>{
        if(!res.ok)return alert("Failed");
        myGame=res.code; showGame(res.code);
    });
});

document.getElementById("joinBtn").addEventListener("click",()=>{
    myName=document.getElementById("name").value;
    const code=document.getElementById("joinCode").value.toUpperCase();
    if(!myName || !code) return alert("Enter name and code");
    socket.emit("joinGame",{name:myName,code},res=>{
        if(!res.ok)return alert("Room not found");
        myGame=code; showGame(code);
    });
});

function showGame(code){
    document.getElementById("lobby").style.display="none";
    document.getElementById("game").style.display="block";
    document.getElementById("roomCode").innerText="Room: "+code;
}

socket.on("playerList",list=>{
    document.getElementById("players").innerHTML=list.map(p=>`<p>${p.name}</p>`).join("");
});

// Start game
document.getElementById("startGameBtn").addEventListener("click",()=>{socket.emit("startGame",{code:myGame});});

// Role info
socket.on("roleInfo",({role,secretWord,category})=>{
    myRole=role;
    document.getElementById("role").innerText="Role hidden until voting";
});

// Game started
socket.on("gameStarted",{firstTurn})=>{
    document.getElementById("turn").innerText="Turn: "+firstTurn;
};

// Clues
socket.on("clueAdded",({name,clue})=>{
    document.getElementById("chat").innerHTML+=`<p><b>${name}:</b> ${clue}</p>`;
});

// Next turn
socket.on("nextTurn",({name})=>{
    document.getElementById("turn").innerText="Turn: "+name;
});

// Send clue
document.getElementById("sendClue").addEventListener("click",()=>{
    const clue=document.getElementById("clueInput").value;
    if(!clue)return;
    socket.emit("submitClue",{code:myGame,clue});
    document.getElementById("clueInput").value="";
});

// Round options
socket.on("roundOptions",isHost=>{
    const box=document.getElementById("roundControls");
    box.innerHTML="";
    if(isHost){
        box.innerHTML=`<button id="nextR">Next Round</button><button id="vote">Start Voting</button>`;
        document.getElementById("nextR").addEventListener("click",()=>{socket.emit("nextRound",{code:myGame});box.innerHTML="";});
        document.getElementById("vote").addEventListener("click",()=>{socket.emit("startVoting",{code:myGame});box.innerHTML="";});
    }
});

// Voting phase
socket.on("votingStarted",({players})=>{
    document.getElementById("voting").style.display="block";
    document.getElementById("role").innerText="Role: "+myRole;
});

// Voting chat
document.getElementById("sendVoteMsg").addEventListener("click",()=>{
    const msg=document.getElementById("voteInput").value;
    if(!msg)return;
    socket.emit("votingMessage",{code:myGame,name:myName,msg});
    document.getElementById("voteInput").value="";
});
socket.on("votingChatUpdate",({name,msg})=>{
    document.getElementById("votingChat").innerHTML+=`<p><b>${name}:</b> ${msg}</p>`;
});

// Voting
document.getElementById("voteBtn").addEventListener("click",()=>{
    const target=document.getElementById("voteTarget").value;
    if(!target)return;
    socket.emit("vote",{code:myGame,voter:myName,target});
    document.getElementById("voteTarget").value="";
});

// Voting result
socket.on("votingResult",({eliminated,imposter})=>{
    document.getElementById("result").innerHTML=`<h2>${eliminated} was eliminated!</h2><h3>Imposter was: ${imposter}</h3>`;
});
