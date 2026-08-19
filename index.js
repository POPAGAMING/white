const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100 MB buffer for base64 images
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Keep track of how many users are in each room
// Format: { 'roomId': count }
const roomUsers = {};

io.on('connection', (socket) => {
    
    // When a user explicitly joins a room from board.html
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId; // Save room ID to the socket instance for later use

        if (!roomUsers[roomId]) {
            roomUsers[roomId] = 0;
        }
        roomUsers[roomId]++;

        console.log(`User ${socket.id} joined room [${roomId}] | Total users: ${roomUsers[roomId]}`);
        
        // Broadcast updated user count to EVERYONE IN THIS SPECIFIC ROOM
        io.to(roomId).emit('user_count', roomUsers[roomId]);
    });

    // Helper function to broadcast to the specific room the user is in
    const broadcastToRoom = (event, data) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit(event, data);
        }
    };

    // Drawing Events
    socket.on('draw_line', (data) => broadcastToRoom('draw_line', data));
    socket.on('draw_shape', (data) => broadcastToRoom('draw_shape', data));
    socket.on('draw_text', (data) => broadcastToRoom('draw_text', data));

    // Image Events
    socket.on('add_image', (data) => broadcastToRoom('add_image', data));
    socket.on('update_image', (data) => broadcastToRoom('update_image', data));
    socket.on('delete_image', (id) => broadcastToRoom('delete_image', id));

    // Sticky Note Events
    socket.on('add_sticky', (data) => broadcastToRoom('add_sticky', data));
    socket.on('update_sticky', (data) => broadcastToRoom('update_sticky', data));
    socket.on('delete_sticky', (id) => broadcastToRoom('delete_sticky', id));

    // Live Cursor tracking
    socket.on('cursor_move', (data) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('cursor_move', { id: socket.id, x: data.x, y: data.y });
        }
    });

    // Clear board
    socket.on('clear_board', () => broadcastToRoom('clear_board'));

    // Handle user disconnects
    socket.on('disconnect', () => {
        if (socket.roomId) {
            const roomId = socket.roomId;
            roomUsers[roomId]--;
            console.log(`User ${socket.id} disconnected from room [${roomId}] | Total users: ${roomUsers[roomId]}`);
            
            // Tell others in the room to update count and remove cursor
            io.to(roomId).emit('user_count', roomUsers[roomId]);
            socket.to(roomId).emit('user_disconnected', socket.id);

            // Cleanup memory if room is empty
            if (roomUsers[roomId] <= 0) {
                delete roomUsers[roomId];
                console.log(`Room [${roomId}] is empty and has been removed from memory.`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Serving static files from ./public`);
    console.log(`Rooms are isolated. Open multiple tabs to test!`);
});