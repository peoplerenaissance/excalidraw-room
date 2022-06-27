import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.get("/", (_: any, res: any) => {
  res.sendStatus("200");
});

const server = http.createServer(app);
const port = process.env.PORT;

server.listen(port, () => {
  console.log(`listening on port: ${port}`);
});

const io = new Server(server, {});

io.on("connection", (socket) => {
  io.to(`${socket.id}`).emit("init-room");

  socket.on("join-room", (roomID) => {
    console.log(`${roomID}: ${socket.id} join-room`);
    socket.join(roomID);
    const room = io.sockets.adapter.rooms.get(roomID)!;
    if (room.size <= 1) {
      console.log(`${roomID}: ${socket.id} first-in-room`);
      io.to(`${socket.id}`).emit("first-in-room");
    } else {
      console.log(`${roomID}: ${socket.id} new-user`);
      socket.broadcast.to(roomID).emit("new-user", socket.id);
    }
    io.in(roomID).emit("room-user-change", Array.from(room));
  });

  socket.on(
    "server-broadcast",
    (roomID: string, encryptedData: ArrayBuffer, iv: Uint8Array) => {
      socket.broadcast.to(roomID).emit("client-broadcast", encryptedData, iv);
    },
  );

  socket.on(
    "server-volatile-broadcast",
    (roomID: string, encryptedData: ArrayBuffer, iv: Uint8Array) => {
      socket.volatile.broadcast
        .to(roomID)
        .emit("client-broadcast", encryptedData, iv);
    },
  );

  socket.on("disconnecting", () => {
    const rooms = io.sockets.adapter.rooms;
    Array.from(socket.rooms).forEach((roomID) => {
      console.log(`${roomID}: ${socket.id} disconnecting`);

      const clients = Array.from(rooms.get(roomID) || []).filter(
        (id) => id !== socket.id,
      );
      if (clients) {
        console.log(`${roomID}: room-user-change ${clients}`);
        socket.broadcast.to(roomID).emit("room-user-change", clients);
      }
    });
  });

  socket.on("disconnect", () => {
    socket.removeAllListeners();
  });
});
