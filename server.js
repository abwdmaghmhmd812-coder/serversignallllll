const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map();  // { roomCode: { host: ws, clients: [ws1, ws2, ...], hostPeerId: int } }
let nextRoomCode = 1000;

function generateRoomCode() {
	const code = String(nextRoomCode).padStart(6, '0');
	nextRoomCode++;
	return code;
}

wss.on('connection', (ws) => {
	console.log('✅ Client connected. Total clients:', wss.clients.size);
	
	let roomCode = null;
	let isHost = false;
	let peerId = Math.floor(Math.random() * 1000000);
	
	ws.on('message', (data) => {
		try {
			const message = JSON.parse(data);
			
			if (message.type === 'create_room') {
				// Host بدو ينشئ روم جديدة
				roomCode = generateRoomCode();
				isHost = true;
				
				rooms.set(roomCode, {
					host: ws,
					hostPeerId: peerId,
					clients: [],
					createdAt: Date.now()
				});
				
				console.log(`🏠 Host created room: ${roomCode} (Peer: ${peerId})`);
				
				ws.send(JSON.stringify({
					type: 'room_created',
					roomCode: roomCode,
					peerId: peerId
				}));
				
			} else if (message.type === 'join_room') {
				// Client بدو يدخل روم موجودة
				roomCode = message.roomCode;
				isHost = false;
				
				if (!rooms.has(roomCode)) {
					ws.send(JSON.stringify({
						type: 'join_failed',
						reason: 'Room not found'
					}));
					console.log(`❌ Invalid room code: ${roomCode}`);
					return;
				}
				
				const room = rooms.get(roomCode);
				room.clients.push(ws);
				
				console.log(`👥 Client joined room: ${roomCode} (Peer: ${peerId}). Room size: ${room.clients.length + 1}`);
				
				// أخبر الـ Host أن في client جديد
				room.host.send(JSON.stringify({
					type: 'player_joined',
					clientPeerId: peerId,
					totalClients: room.clients.length
				}));
				
				// أخبر الـ Client بـ معلومات الـ Host
				ws.send(JSON.stringify({
					type: 'join_success',
					hostPeerId: room.hostPeerId,
					peerId: peerId,
					roomCode: roomCode
				}));
				
			} else if (roomCode && rooms.has(roomCode)) {
				// Relay game data بين اللاعبين
				const room = rooms.get(roomCode);
				
				if (isHost) {
					// من Host لـ Clients
					room.clients.forEach(client => {
						if (client.readyState === WebSocket.OPEN) {
							client.send(JSON.stringify(message));
						}
					});
				} else {
					// من Client لـ Host والـ Clients الآخرين
					if (room.host && room.host.readyState === WebSocket.OPEN) {
						room.host.send(JSON.stringify(message));
					}
					room.clients.forEach(client => {
						if (client !== ws && client.readyState === WebSocket.OPEN) {
							client.send(JSON.stringify(message));
						}
					});
				}
			}
		} catch (e) {
			console.error('❌ Message error:', e);
		}
	});
	
	ws.on('close', () => {
		if (roomCode && rooms.has(roomCode)) {
			const room = rooms.get(roomCode);
			
			if (isHost) {
				// Host ترك اللعبة - حذف الروم
				rooms.delete(roomCode);
				console.log(`🏠 Host disconnected. Room ${roomCode} deleted`);
				
				// أخبر جميع Clients
				room.clients.forEach(client => {
					if (client.readyState === WebSocket.OPEN) {
						client.send(JSON.stringify({ type: 'host_disconnected' }));
					}
				});
			} else {
				// Client ترك اللعبة
				const index = room.clients.indexOf(ws);
				if (index > -1) {
					room.clients.splice(index, 1);
				}
				
				console.log(`👥 Client disconnected from room ${roomCode}. Remaining: ${room.clients.length + 1}`);
				
				if (room.host && room.host.readyState === WebSocket.OPEN) {
					room.host.send(JSON.stringify({
						type: 'player_left',
						peerId: peerId,
						totalClients: room.clients.length
					}));
				}
			}
		}
		console.log('❌ Client disconnected. Total clients:', wss.clients.size);
	});
	
	ws.on('error', (error) => {
		console.error('❌ WebSocket error:', error);
	});
});

server.listen(PORT, () => {
	console.log(`\n🎮 RELAY SERVER RUNNING`);
	console.log(`📡 WebSocket: ws://0.0.0.0:${PORT}`);
	console.log(`🚀 Ready for connections!\n`);
});

