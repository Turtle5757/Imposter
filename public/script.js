const socket = io();

let myName = "";
let myRole = "";
let myGame = "";

document.getElementById("createBtn").onclick = () => {
    myName = document.getElementById("name").value;
    socket.emit("createGame", { name: myName }, (res) => {
        if (!res.ok) return;
        myGame = res.code;
        showGameScreen(res.code);
    });
};

document.getElementById("joinBtn").onclick = () => {
    myName = document.getElementById("name").value;
    const code = document.getElementById("joinCode").value.toUpperCase();
    socket.emit("joinGame", { name: myName, code }, (res) => {
        if (!res.ok) return alert("Invalid code");
        myGame = code;
        showGameScreen(code);
    });
};

function showGameScreen(code) {
    document.getElementById("lobby").style.display = "none";
    document.getElementById("game").style.display = "block";
    document.getElementById("roomCode").innerText = "Room: " + code;
}

socket.on("playerList", (list) => {
    const box = document.getElementById("players");
    box.innerHTML = list.map(p => `<p>${p.name}</p>`).join("");
});

// START GAME (host)
document.getElementById("startGameBtn").onclick = () => {
    socket.emit("startGame", { code: myGame });
};

// Receive role
socket.on("roleInfo", ({ role, secretWord, category }) => {
    myRole = role;
    document.getElementById("role").innerText =
        "Role: HIDDEN (until voting)";
});

// Game started
socket.on("gameStarted", ({ firstTurn }) => {
    document.getElementById("turn").innerText = "Turn: " + firstTurn;
});

// Add clue to chat
socket.on("clueAdded", ({ name, clue }) => {
    const box = document.getElementById("chat");
    box.innerHTML += `<p><b>${name}:</b> ${clue}</p>`;
});

// Next turn
socket.on("nextTurn", ({ name }) => {
    document.getElementById("turn").innerText = "Turn: " + name;
});

// Send clue
document.getElementById("sendClue").onclick = () => {
    const clue = document.getElementById("clueInput").value.trim();
    if (!clue) return;

    socket.emit("submitClue", {
        code: myGame,
        clue
    });

    document.getElementById("clueInput").value = "";
};

// Round options (host only)
socket.on("roundOptions", (isHost) => {
    const box = document.getElementById("roundControls");
    box.innerHTML = "";

    if (isHost) {
        box.innerHTML = `
            <button id="nextR">Next Round</button>
            <button id="vote">Start Voting</button>
        `;

        document.getElementById("nextR").onclick = () => {
            socket.emit("nextRound", { code: myGame });
            box.innerHTML = "";
        };

        document.getElementById("vote").onclick = () => {
            socket.emit("startVoting", { code: myGame });
            box.innerHTML = "";
        };
    }
});

// Voting started
socket.on("votingStarted", ({ players }) => {
    document.getElementById("role").innerText = "Role: " + myRole;

    document.getElementById("voting").style.display = "block";
});

// Voting chat
document.getElementById("sendVoteMsg").onclick = () => {
    const msg = document.getElementById("voteInput").value;
    if (!msg) return;

    socket.emit("votingMessage", {
        code: myGame,
        name: myName,
        msg
    });

    document.getElementById("voteInput").value = "";
};

socket.on("votingChatUpdate", ({ name, msg }) => {
    const b = document.getElementById("votingChat");
    b.innerHTML += `<p><b>${name}:</b> ${msg}</p>`;
});
