const socket = io();


const nameInput = document.getElementById('name');


document.getElementById('create')?.onclick = () => {
socket.emit('create-room', { name: nameInput.value });
};


socket.on('room-joined', room => {
location.href = `/room.html#${room.id}`;
});


socket.on('game-started', state => {
const role = state.roles[socket.id];
alert(role.imposter
? `You are the Imposter! Category: ${role.category}`
: `Word: ${role.word}`
);
});


socket.on('game-ended', result => {
alert(`Winner: ${result.winner}\nImposter: ${result.imposter}\nWord: ${result.word}`);
});
