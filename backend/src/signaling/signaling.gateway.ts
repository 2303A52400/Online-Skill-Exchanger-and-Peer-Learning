import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { logger, activeWebsocketConnections, config } from "../config/index.js";

interface RoomJoinPayload {
  roomId: string;
  userId: string;
  userName: string;
}

interface SdpPayload {
  roomId: string;
  targetSocketId?: string;
  sdp: any;
}

interface IceCandidatePayload {
  roomId: string;
  targetSocketId?: string;
  candidate: any;
}

interface WhiteboardDrawPayload {
  roomId: string;
  drawData: any;
}

interface ChatMessagePayload {
  roomId: string;
  message: string;
  senderName: string;
  timestamp: string;
}

export function setupSignalingGateway(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Setup Redis Adapter for multi-pod Kubernetes horizontal scaling
  try {
    const pubClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    const subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.io Redis adapter connected successfully for multi-replica horizontal clustering");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Redis adapter initialization failed. Falling back to in-memory adapter");
  }

  // Middleware for JWT/session verification could be placed here
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    // For demo/production, decode & verify JWT token
    next();
  });

  io.on("connection", (socket: Socket) => {
    activeWebsocketConnections.inc();
    logger.info({ socketId: socket.id }, "Client connected to WebRTC signaling gateway");

    // 1. Join Room (1-on-1 Peer Learning Session)
    socket.on("join-room", async ({ roomId, userId, userName }: RoomJoinPayload) => {
      const room = io.sockets.adapter.rooms.get(roomId);
      const roomSize = room ? room.size : 0;

      // Limit 1-on-1 sessions to maximum 2 active peers (plus optional moderator)
      if (roomSize >= 2) {
        socket.emit("room-full", { roomId, message: "Room has already reached maximum 2-peer capacity" });
        return;
      }

      await socket.join(roomId);
      socket.data = { roomId, userId, userName };

      logger.info({ socketId: socket.id, roomId, userId }, "User joined peer room");

      // Notify existing peer in the room
      socket.to(roomId).emit("peer-joined", {
        socketId: socket.id,
        userId,
        userName,
      });

      // Send back list of existing participants in the room
      const existingPeers: string[] = [];
      if (room) {
        for (const id of room) {
          if (id !== socket.id) existingPeers.push(id);
        }
      }
      socket.emit("existing-peers", { peers: existingPeers });
    });

    // 2. WebRTC SDP Offer Exchange
    socket.on("webrtc-offer", ({ roomId, targetSocketId, sdp }: SdpPayload) => {
      logger.debug({ from: socket.id, targetSocketId, roomId }, "Forwarding WebRTC offer");
      if (targetSocketId) {
        socket.to(targetSocketId).emit("webrtc-offer", {
          senderSocketId: socket.id,
          sdp,
        });
      } else {
        socket.to(roomId).emit("webrtc-offer", {
          senderSocketId: socket.id,
          sdp,
        });
      }
    });

    // 3. WebRTC SDP Answer Exchange
    socket.on("webrtc-answer", ({ roomId, targetSocketId, sdp }: SdpPayload) => {
      logger.debug({ from: socket.id, targetSocketId, roomId }, "Forwarding WebRTC answer");
      if (targetSocketId) {
        socket.to(targetSocketId).emit("webrtc-answer", {
          senderSocketId: socket.id,
          sdp,
        });
      } else {
        socket.to(roomId).emit("webrtc-answer", {
          senderSocketId: socket.id,
          sdp,
        });
      }
    });

    // 4. ICE Candidates Exchange
    socket.on("ice-candidate", ({ roomId, targetSocketId, candidate }: IceCandidatePayload) => {
      if (targetSocketId) {
        socket.to(targetSocketId).emit("ice-candidate", {
          senderSocketId: socket.id,
          candidate,
        });
      } else {
        socket.to(roomId).emit("ice-candidate", {
          senderSocketId: socket.id,
          candidate,
        });
      }
    });

    // 5. Real-Time Collaborative Whiteboard Sync
    socket.on("whiteboard-draw", ({ roomId, drawData }: WhiteboardDrawPayload) => {
      socket.to(roomId).emit("whiteboard-draw", drawData);
    });

    socket.on("whiteboard-clear", ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit("whiteboard-clear");
    });

    // 6. In-Session Collaborative Chat
    socket.on("send-chat-message", ({ roomId, message, senderName, timestamp }: ChatMessagePayload) => {
      io.to(roomId).emit("receive-chat-message", {
        senderId: socket.id,
        senderName,
        message,
        timestamp,
      });
    });

    // 7. Cleanup on Disconnect
    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit("peer-disconnected", {
            socketId: socket.id,
            userId: socket.data?.userId,
          });
        }
      }
    });

    socket.on("disconnect", (reason) => {
      activeWebsocketConnections.dec();
      logger.info({ socketId: socket.id, reason }, "Client disconnected from signaling gateway");
    });
  });

  return io;
}

