const express = require("express");
r.imposter = imposter;
r.word = wordObj.word;
r.category = wordObj.category;
r.turnOrder = [...ids];
r.currentTurn = 0;
r.state = "clues";


ids.forEach(id => {
io.to(id).emit("role", {
imposter: id === imposter,
word: id === imposter ? null : r.word,
category: r.category
});
});


io.to(room).emit("turn", r.turnOrder[r.currentTurn]);
});


socket.on("nextTurn", room => {
const r = rooms[room];
if (!r) return;
r.currentTurn++;
if (r.currentTurn < r.turnOrder.length) {
io.to(room).emit("turn", r.turnOrder[r.currentTurn]);
}
});


socket.on("startVoting", room => {
const r = rooms[room];
if (!r) return;
r.state = "voting";
r.votes = {};
io.to(room).emit("votingStart");
});


socket.on("vote", ({ room, target }) => {
const r = rooms[room];
if (!r) return;
r.votes[target] = (r.votes[target] || 0) + 1;
});


socket.on("endVoting", room => {
const r = rooms[room];
if (!r) return;


let max = 0, votedOut = null;
for (let id in r.votes) {
if (r.votes[id] > max) {
max = r.votes[id];
votedOut = id;
}
}


const crewWin = votedOut === r.imposter;


io.to(room).emit("gameOver", {
imposter: r.players[r.imposter].name,
word: r.word,
winner: crewWin ? "Crewmates" : "Imposter"
});


r.state = "lobby";
});


socket.on("chat", ({ room, msg, name }) => {
io.to(room).emit("chat", { name, msg });
});


socket.on("disconnect", () => {
for (let room in rooms) {
delete rooms[room].players[socket.id];
}
});
});


server.listen(process.env.PORT || 3000);
