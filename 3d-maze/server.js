const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

const rooms = {};

function generateMazeAndSpawns(gridSize, numPlayers) {
    let maze = [];
    for(let y = 0; y < gridSize; y++){
        maze[y] = [];
        for(let x = 0; x < gridSize; x++){ maze[y][x] = 1; }
    }
    let stack = [];
    maze[1][1] = 0; stack.push({x: 1, y: 1});
    const dirs = [{x: 0, y: -2}, {x: 2, y: 0}, {x: 0, y: 2}, {x: -2, y: 0}];

    while(stack.length > 0) {
        let current = stack[stack.length - 1]; dirs.sort(() => Math.random() - 0.5); let moved = false;
        for(let d of dirs) {
            let nx = current.x + d.x, ny = current.y + d.y;
            if(nx > 0 && nx < gridSize && ny > 0 && ny < gridSize && maze[ny][nx] === 1) {
                maze[current.y + d.y/2][current.x + d.x/2] = 0; maze[ny][nx] = 0;
                stack.push({x: nx, y: ny}); moved = true; break;
            }
        }
        if(!moved) stack.pop();
    }
    
    // Gimmick empty spaces
    let emptySpaces = [];
    for(let y=2; y<gridSize-2; y++){
        for(let x=2; x<gridSize-2; x++){
            if(maze[y][x] === 0) emptySpaces.push({x, y});
        }
    }
    
    let goal = { x: gridSize - 2, y: gridSize - 2 };
    maze[goal.y][goal.x] = 2; // Goal

    // BFS for equal distance
    let dist = Array(gridSize).fill(0).map(() => Array(gridSize).fill(Infinity));
    dist[goal.y][goal.x] = 0;
    let queue = [{x: goal.x, y: goal.y}];
    const moves = [{x:-1,y:0}, {x:1,y:0}, {x:0,y:-1}, {x:0,y:1}];
    
    let maxD = 0;
    while(queue.length > 0) {
        let curr = queue.shift();
        for(let m of moves) {
            let nx = curr.x + m.x, ny = curr.y + m.y;
            if(nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && (maze[ny][nx] === 0 || maze[ny][nx]===2)) {
                if(dist[curr.y][curr.x] + 1 < dist[ny][nx]) {
                    dist[ny][nx] = dist[curr.y][curr.x] + 1;
                    if(dist[ny][nx] > maxD) maxD = dist[ny][nx];
                    queue.push({x: nx, y: ny});
                }
            }
        }
    }
    
    // Find optimal spawn points
    let spawnDistance = null;
    let possibleCells = [];
    
    for(let d = maxD; d >= 0; d--) {
        let cells = [];
        for(let y=0; y<gridSize; y++){
            for(let x=0; x<gridSize; x++){
                if(dist[y][x] === d) cells.push({x, y});
            }
        }
        if(cells.length >= numPlayers) {
            spawnDistance = d;
            possibleCells = cells;
            break;
        }
    }
    
    // Fallback if somehow impossible (rare in perfect maze for small numbers)
    if(possibleCells.length < numPlayers) {
        possibleCells = [{x:1, y:1}]; // Extremely simple fallback
        for(let i=1; i<numPlayers; i++) possibleCells.push({x:1, y:1}); 
    }
    
    // Shuffle possible cells
    possibleCells.sort(() => Math.random() - 0.5);
    let assignedSpawns = possibleCells.slice(0, numPlayers);
    
    return { maze, assignedSpawns, emptySpaces, spawnDistance };
}

io.on('connection', (socket) => {
    
    socket.on('joinRoom', (data) => {
        let roomId = data.roomId || Math.random().toString(36).substring(2, 6).toUpperCase();
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                id: roomId,
                host: socket.id,
                players: {},
                state: 'waiting',
                gridSize: data.gridSize || 31
            };
        }
        
        let room = rooms[roomId];
        if(room.state !== 'waiting') {
            socket.emit('errorMsg', 'Room is currently in a game.');
            return;
        }
        
        room.players[socket.id] = {
            id: socket.id,
            name: data.name || 'Player',
            color: data.color || '#1a2b3c',
            pos: { x:0, y:0, z:0 },
            rot: { y:0, x:0, z:0 },
            vel: 0,
            isReady: false
        };
        
        socket.join(roomId);
        socket.emit('roomJoined', { roomId, isHost: room.host === socket.id, players: room.players });
        socket.to(roomId).emit('playerJoined', room.players[socket.id]);
    });
    
    socket.on('startGame', (roomId) => {
        let room = rooms[roomId];
        if(room && room.host === socket.id && room.state === 'waiting') {
            room.state = 'playing';
            
            let pKeys = Object.keys(room.players);
            let { maze, assignedSpawns, emptySpaces, spawnDistance } = generateMazeAndSpawns(room.gridSize, pKeys.length);
            
            pKeys.forEach((pid, idx) => {
                let sCell = assignedSpawns[idx];
                room.players[pid].startCell = sCell;
            });
            
            // Randomly pick gimmick locations so they sync across clients
            // e.g. crystals, lasers, pads
            let gimmicks = { crystals: [], lasers: [], pads: [] };
            emptySpaces.sort(() => Math.random() - 0.5);
            for(let i=0; i<Math.min(40, emptySpaces.length); i++) gimmicks.crystals.push(emptySpaces.pop());
            for(let i=0; i<Math.min(10, emptySpaces.length); i++) gimmicks.pads.push(emptySpaces.pop());
            for(let i=0; i<Math.min(15, emptySpaces.length); i++) gimmicks.lasers.push({cell: emptySpaces.pop(), isHoriz: Math.random()>0.5, speed: Math.random()*2+1, offset: Math.random()*10 });
            
            io.to(roomId).emit('gameStart', {
                maze: maze,
                players: room.players,
                gimmicks: gimmicks,
                spawnDistance: spawnDistance
            });
        }
    });

    socket.on('playerUpdate', (data) => {
        // data: { roomId, pos, rot, vel }
        let room = rooms[data.roomId];
        if(room && room.players[socket.id]) {
            room.players[socket.id].pos = data.pos;
            room.players[socket.id].rot = data.rot;
            room.players[socket.id].vel = data.vel;
            // Broadcast to others
            socket.to(data.roomId).emit('opponentUpdate', {
                id: socket.id,
                pos: data.pos,
                rot: data.rot,
                vel: data.vel
            });
        }
    });
    
    socket.on('goalReached', (data) => {
        let room = rooms[data.roomId];
        if(room && room.players[socket.id]) {
            room.players[socket.id].finishTime = data.time;
            io.to(data.roomId).emit('playerFinished', { id: socket.id, time: data.time });
            
            // Check if everyone finished
            let allFinished = true;
            for(let pid in room.players) { if(!room.players[pid].finishTime) allFinished = false; }
            if(allFinished) {
                room.state = 'waiting'; // Reset
                for(let pid in room.players) delete room.players[pid].finishTime;
            }
        }
    });

    socket.on('disconnect', () => {
        for(let roomId in rooms) {
            let room = rooms[roomId];
            if(room.players[socket.id]) {
                delete room.players[socket.id];
                io.to(roomId).emit('playerLeft', socket.id);
                if(Object.keys(room.players).length === 0) {
                    delete rooms[roomId];
                } else if (room.host === socket.id) {
                    // Assign new host
                    let newHost = Object.keys(room.players)[0];
                    room.host = newHost;
                    io.to(roomId).emit('hostChanged', newHost);
                }
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
