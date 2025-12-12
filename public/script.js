const socket=io();
let myName="",myRole="",myGame="";

document.getElementById("createBtn").onclick=()=>{
    myName=document.getElementById("name").value;
    socket.emit("createGame",{name:myName},res=>{
        if(!res.ok)return;
        myGame=res.code;
        showGame(res.code);
    });
};

document.getElementById("joinBtn").onclick=()=>{
    myName=document.getElementById("name").value;
    const code=document.getElementById("joinCode").value.toUpperCase();
    socket.emit("joinGame",{name:myName,code},res=>{
        if(!res.ok)return alert("Invalid code");
        myGame=code;
        showGame(code);
    });
};

function showGame(code){
    document.getElementById("lobby").style.display="none";
    document.getElementById("game").style.display="block";
    document.getElementById("roomCode").innerText="Room: "+code;
}

// Player list
socket.on("playerList",list=>{
    document.getElementById("players").innerHTML=list.map(p=>`<p>${p.name}</p>`).join("");
});

// Start game (host)
document.getElementById("startGameBtn").onclick=()=>{
    socket.emit("startGame",{code:myGame});
};

// Role info
socket.on("roleInfo",({role,secretWord,category})=>{
    myRole=role;
    document.getElementById("role").innerText="Role: hidden during clues";
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
document.getElementById("sendClue").onclick=()=>{
    const clue=document.getElementById("clueInput").value;
    if(!clue)return;
    socket.emit("submitClue",{code:myGame,clue});
    document.getElementById("clueInput").value="";
};

// Round options
socket.on("roundOptions",isHost=>{
    const box=document.getElementById("roundControls");
    box.innerHTML="";
    if(isHost){
        box.innerHTML=`<button id="nextR">Next Round</button>
        <button id="vote">Start Voting</button>`;
        document.getElementById("nextR").onclick=()=>{socket.emit("nextRound",{code:myGame});box.innerHTML="";};
        document.getElementById("vote").onclick=()=>{socket.emit("startVoting",{code:myGame});box.innerHTML="";};
    }
});

// Voting phase
socket.on("votingStarted",({players})=>{
    document.getElementById("voting").style.display="block";
    document.getElementById("role").innerText="Role: "+myRole;
});

// Voting chat
document.getElementById("sendVoteMsg").onclick=()=>{
    const msg=document.getElementById("voteInput").value;
    if(!msg)return;
    socket.emit("votingMessage",{code:myGame,name:myName,msg});
    document.getElementById("voteInput").value="";
};
socket.on("votingChatUpdate",({name,msg})=>{
    document.getElementById("votingChat").innerHTML+=`<p><b>${name}:</b> ${msg}</p>`;
});

// Voting
document.getElementById("voteBtn").onclick=()=>{
    const target=document.getElementById("voteTarget").value;
    if(!target)return;
    socket.emit("vote",{code:myGame,voter:myName,target});
    document.getElementById("voteTarget").value="";
};

// Voting result
socket.on("votingResult",({eliminated,imposter})=>{
    document.getElementById("result").innerHTML=`<h2>${eliminated} was eliminated!</h2>
    <h3>The imposter was: ${imposter}</h3>`;
});
