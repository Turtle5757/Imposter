const socket = io();
let roomId;


function createRoom() {
const name = document.getElementById('name').value;
socket.emit('create-room', name);
}


socket.on('joined', id => {
sessionStorage.setItem('room', id);
sessionStorage.setItem('name', document.getElementById('name')?.value);
location.href = '/room.html';
});


if (location.pathname.includes('room.html')) {
roomId = sessionStorage.getItem('room');
socket.emit('join-room', { roomId, name: sessionStorage.getItem('name') });
}


socket.on('role', data => {
document.getElementById('role').innerText = data.imposter
? `IMPOSTER – Category: ${data.category}`
: `Word: ${data.word}`;
});


function startGame() { socket.emit('start-game', roomId); }
function sendClue() {
socket.emit('clue', { roomId, text: document.getElementById('clueInput').value });
}
function startVote() { socket.emit('start-vote', roomId); }


socket.on('clue', c => {
document.getElementById('clues').innerHTML += `<p>${c.name}: ${c.text}</p>`;
});


socket.on('start-vote', players => {
const v = document.getElementById('votes');
v.innerHTML = '';
players.forEach(p => {
const b = document.createElement('button');
b.innerText = p.name;
b.onclick = () => socket.emit('vote', { roomId, target: p.id });
v.appendChild(b);
});
});


socket.on('result', r => {
alert(`Winner: ${r.winner}\nImposter: ${r.imposter}\nWord: ${r.word}`);
});
