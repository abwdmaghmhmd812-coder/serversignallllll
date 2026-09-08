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
				isHost = true;
				
				rooms.set(roomCode, {
					host: ws,
					hostPeerId: peerId,
					clients: [],
				});
				
				console.log(`🏠 Created room: ${roomCode}`);
				
				ws.send(JSON.stringify({
					type: 'room_created',
					roomCode: roomCode,
					peerId: peerId
				}));
				
			} else if (message.type === 'join_room') {
				roomCode = message.roomCode;
				
				if (!rooms.has(roomCode)) {
					ws.send(JSON.stringify({
						type: 'join_failed',
						reason: 'Room not found'
					}));
					return;
				}
				
				const room = rooms.get(roomCode);
				room.clients.push(ws);
				isHost = false;
				
				console.log(`👥 Client joined room: ${roomCode}`);
				
				room.host.send(JSON.stringify({
					type: 'player_joined',
					clientPeerId: peerId,
					totalClients: room.clients.length
				}));
				
				ws.send(JSON.stringify({
					type: 'join_success',
					hostPeerId: room.hostPeerId,
					peerId: peerId,
					roomCode: roomCode
				}));
			}
		} catch (e) {
			console.error('❌ Error:', e);
		}
	});
	
	ws.on('close', () => {
		if (roomCode && rooms.has(roomCode)) {
			const room = rooms.get(roomCode);
			if (isHost) {
				rooms.delete(roomCode);
				room.clients.forEach(c => c.close());
			} else {
				room.clients = room.clients.filter(c => c !== ws);
			}
		}
	});
});

server.listen(PORT, '0.0.0.0', () => {
	console.log(`🎮 Server running on port ${PORT}`);
});
