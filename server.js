const express = require("express");
const r = rooms[room];
if (!r || r.state !== "clues") return;


r.currentTurn++;
if (r.currentTurn < r.turnOrder.length) {
io.to(room).emit("turn", r.turnOrder[r.currentTurn]);
}
});


socket.on("startVoting", (room) => {
const r = rooms[room];
if (!r) return;


r.state = "voting";
r.votes = {};
io.to(room).emit("votingStart", Object.keys(r.players));
});


socket.on("vote", ({ room, target }) => {
const r = rooms[room];
if (!r || r.state !== "voting") return;


r.votes[target] = (r.votes[target] || 0) + 1;
});


socket.on("endVoting", (room) => {
const r = rooms[room];
if (!r) return;


let maxVotes = 0;
let votedOut = null;


for (const id in r.votes) {
if (r.votes[id] > maxVotes) {
maxVotes = r.votes[id];
votedOut = id;
}
}


const crewWin = votedOut === r.imposter;


io.to(room).emit("gameOver", {
imposter: r.players[r.imposter]?.name || "Unknown",
word: r.word,
winner: crewWin ? "Crewmates" : "Imposter"
});


r.state = "lobby";
});


socket.on("chat", ({ room, msg, name }) => {
if (!rooms[room]) return;
io.to(room).emit("chat", { name, msg });
});


socket.on("disconnect", () => {
for (const room in rooms) {
if (rooms[room].players[socket.id]) {
delete rooms[room].players[socket.id];
io.to(room).emit("roomUpdate", rooms[room]);
}
}
});
});


server.listen(process.env.PORT || 3000, () => {
console.log("Server running");
});
