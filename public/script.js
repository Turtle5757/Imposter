const socket = io();
let currentRole = "";
let currentGameCode = "";
let hostId = "";

const lobbyDiv = document.getElementById("lobby");
const gameDiv = document.getElementById("game");
const chatBox = document.getElementById("chat");
const votingChatBox = document.getElementById("votingChat");
const clueInput = document.getElementById("clueInput");
const votingInput = document.getElementById("votingInput");

// Create Game
document.getElementById("createBtn").onclick = () => {
    const name = document.getElementById("name").value;
    socket.emit("createGame", name, (code) => {
        currentGameCode = code;
        hostId = socket.id;
        lobbyDiv.style.display = "none";
        gameDiv.style.display = "block";
        document.getElementById("roomCode").innerText = "Room: " + code;
    });
};

// Join Game
document.getElementById("joinBtn").onclick = () => {
    const name = document.getElementById("name").value;
    const code = document.getElementById("joinCode").value.toUpperCase();

    socket.emit("joinGame", code, name, (success) => {
        if (!success) return alert("Room not found.");

        currentGameCode = code;
        lobbyDiv.style.display = "none";
        gameDiv.style.display = "block";
        document.getElementById("roomCode").innerText = "Room: " + code;
    });
};

// Start game (host only)
document.getElementById("startGameBtn").onclick = () => {
    socket.emit("startGame", currentGameCode);
};

// Role received (HIDE it during clues)
socket.on("yourRole", (role) => {
    currentRole = role;
});

// Game started
socket.on("gameStarted", () => {
    document.getElementById("roleDisplay").innerText =
        "Role: hidden during clues";
});

// Chat updates during clues
socket.on("chatUpdate", (msg, name) => {
    chatBox.innerHTML += `<p><b>${name}:</b> ${msg}</p>`;
});

// Next turn
socket.on("nextTurn", (name) => {
    document.getElementById("turnDisplay").innerText = name + "'s turn";

    clueInput.disabled = name !== getMyName();
});

// END OF ROUND OPTIONS
socket.on("clueRoundOver", () => {
    if (socket.id === hostId) {
        chatBox.innerHTML += `
            <div id="roundControl">
                <button id="nextRoundBtn">Next Round</button>
                <button id="startVotingBtn">Start Voting</button>
            </div>
        `;

        document.getElementById("nextRoundBtn").onclick = () => {
            socket.emit("nextRound", currentGameCode);
            document.getElementById("roundControl").remove();
        };

        document.getElementById("startVotingBtn").onclick = () => {
            socket.emit("startVoting", currentGameCode);
            document.getElementById("roundControl").remove();
        };
    }
});

// Submit clue
document.getElementById("sendClue").onclick = () => {
    const msg = clueInput.value.trim();
    if (!msg) return;

    socket.emit("submitClue", currentGameCode, msg);
    clueInput.value = "";
};

// Begin voting phase
socket.on("startVoting", (playerList) => {
    document.getElementById("votingSection").style.display = "block";
    document.getElementById("roleDisplay").innerText = "Role: " + currentRole;
});

// Voting chat
document.getElementById("sendVotingMsg").onclick = () => {
    const msg = votingInput.value.trim();
    if (!msg) return;

    socket.emit("sendVotingMessage", currentGameCode, msg);
    votingInput.value = "";
};

socket.on("votingChatUpdate", (name, msg) => {
    votingChatBox.innerHTML += `<p><b>${name}:</b> ${msg}</p>`;
});

function getMyName() {
    const name = document.getElementById("name").value;
    return name;
}
