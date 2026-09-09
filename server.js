const WebSocket = require('ws');
const http = require('http');

const PORT = parseInt(process.env.PORT || 8080, 10);
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map();
let nextRoomCode = 1000;

function generateRoomCode() {
	const code = String(nextRoomCode).padStart(6, '0');
	nextRoomCode++;
	return code;
}

wss.on('connection', (ws) => {
	console.log('✅ Client connected');

	let roomCode = null;
	let isHost = false;
	let peerId = Math.floor(Math.random() * 1000000);

	ws.on('message', (data) => {
		try {
			const message = JSON.parse(data.toString());
			console.log('📨 Received:', message.type);

			if (message.type === 'create_room') {
				roomCode = generateRoomCode();
