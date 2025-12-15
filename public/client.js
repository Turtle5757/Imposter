const socket = io();
let ROOM, NAME;


function createRoom() {
NAME = name.value;
ROOM = room.value;
socket.emit("createRoom", { name: NAME, room: ROOM });
game.hidden = false;
}


function joinRoom() {
NAME = name.value;
ROOM = room.value;
socket.emit("joinRoom", { name: NAME, room: ROOM });
game.hidden = false;
}


socket.on("role", data => {
role.innerText = data.imposter
? `You are the IMPOSTER\nCategory: ${data.category}`
: `Word: ${data.word}`;
});


socket.on("turn", id => {
turn.innerText = id === socket.id ? "Your turn" : "Someone else's turn";
});


function startVoting() {
socket.emit("startVoting", ROOM);
}


socket.on("votingStart", () => {
chat.innerHTML += "<p>Voting started!</p>";
});


function sendChat() {
socket.emit("chat", { room: ROOM, msg: msg.value, name: NAME });
msg.value = "";
}


socket.on("chat", data => {
chat.innerHTML += `<p><b>${data.name}:</b> ${data.msg}</p>`;
});


socket.on("gameOver", data => {
alert(`Imposter: ${data.imposter}\nWord: ${data.word}\nWinner: ${data.winner}`);
});
