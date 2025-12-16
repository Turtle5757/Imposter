const words = require('./words');


const rooms = {};


function createRoom(id, hostId, hostName) {
rooms[id] = {
id,
hostId,
players: { [hostId]: { id: hostId, name: hostName } },
imposter: null,
word: null,
category: null,
votes: {},
result: null,


startGame() {
const ids = Object.keys(this.players);
this.imposter = ids[Math.floor(Math.random() * ids.length)];
const pick = words[Math.floor(Math.random() * words.length)];
this.word = pick.word;
this.category = pick.category;
},


finishVote() {
const votedOut = Object.entries(this.votes).sort((a,b)=>b[1]-a[1])[0]?.[0];
const crewmatesWin = votedOut === this.imposter;
this.result = {
imposter: this.players[this.imposter].name,
word: this.word,
winner: crewmatesWin ? 'Crewmates' : 'Imposter'
};
this.votes = {};
},


getPublicState() {
return {
id: this.id,
category: this.category,
players: Object.values(this.players),
roles: Object.fromEntries(
Object.keys(this.players).map(id => [
id,
id === this.imposter
? { imposter: true, category: this.category }
: { imposter: false, word: this.word }
])
)
};
}
};
}


module.exports = { rooms, createRoom };
