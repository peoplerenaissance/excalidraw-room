import express from "express";
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import http from "http";
import { Server } from "socket.io";

const app = express();

Sentry.init({
    dsn: "https://6bea409cb9144ad7accc713b3c7bcb80@o1112051.ingest.sentry.io/6567662",
    integrations: [
        // enable HTTP calls tracing
        new Sentry.Integrations.Http({ tracing: true }),
        // enable Express.js middleware tracing
        new Tracing.Integrations.Express({ app }),
    ],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 0,
});
app.use(Sentry.Handlers.requestHandler() as express.RequestHandler);

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
    try {
        io.to(`${socket.id}`).emit("init-room");

        socket.on("join-room", (roomID) => {
            try {
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
            } catch (e) {
                Sentry.captureException(e);
            }
        });

        socket.on(
            "server-broadcast",
            (roomID: string, encryptedData: ArrayBuffer, iv: Uint8Array) => {
                try {
                    socket.broadcast
                        .to(roomID)
                        .emit("client-broadcast", encryptedData, iv);
                } catch (e) {
                    Sentry.captureException(e);
                }
            }
        );

        socket.on(
            "server-volatile-broadcast",
            (roomID: string, encryptedData: ArrayBuffer, iv: Uint8Array) => {
                try {
                    socket.volatile.broadcast
                        .to(roomID)
                        .emit("client-broadcast", encryptedData, iv);
                } catch (e) {
                    Sentry.captureException(e);
                }
            }
        );

        socket.on("disconnecting", () => {
            try {
                const rooms = io.sockets.adapter.rooms;
                Array.from(socket.rooms).forEach((roomID) => {
                    console.log(`${roomID}: ${socket.id} disconnecting`);

                    const clients = Array.from(rooms.get(roomID) || []).filter(
                        (id) => id !== socket.id
                    );
                    if (clients) {
                        console.log(`${roomID}: room-user-change ${clients}`);
                        socket.broadcast
                            .to(roomID)
                            .emit("room-user-change", clients);
                    }
                });
            } catch (e) {
                Sentry.captureException(e);
            }
        });

        socket.on("disconnect", () => {
            try {
                socket.removeAllListeners();
            } catch (e) {
                Sentry.captureException(e);
            }
        });
    } catch (e) {
        Sentry.captureException(e);
    }
});

app.use(Sentry.Handlers.errorHandler() as express.ErrorRequestHandler);

