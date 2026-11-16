import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { logger, activeWebsocketConnections, config } from "../config/index.js";
import { UserStore } from "../users/user.store.js";

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

interface FileSharePayload {
  roomId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData: string; // Base64 data URL
  timestamp: string;
}

export function setupSignalingGateway(httpServer: HttpServer, userStore?: UserStore): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: false,
    },
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for file sharing over WebSockets
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // User ID to Socket ID mapping for instant direct calls
  const userSocketMap = new Map<string, string>();
  const socketUserMap = new Map<string, string>();

  // Setup Redis Adapter if enabled in cloud/Kubernetes environment
  if (config.redis.enabled) {
    try {
      const pubClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });

      const subClient = pubClient.duplicate();

      pubClient.on("error", (err) => logger.warn({ err: err.message }, "Redis pubClient connection error"));
      subClient.on("error", (err) => logger.warn({ err: err.message }, "Redis subClient connection error"));

      io.adapter(createAdapter(pubClient, subClient));
      logger.info("Socket.io Redis adapter connected successfully for multi-replica horizontal clustering");
    } catch (err: any) {
      logger.warn({ err: err.message }, "Redis adapter initialization failed. Falling back to in-memory adapter");
    }
  } else {
    logger.info("Signaling Gateway operating in single-instance in-memory adapter mode");
  }

  io.on("connection", (socket: Socket) => {
    activeWebsocketConnections.inc();
    logger.info({ socketId: socket.id }, "Client connected to Signaling Gateway");

    // 1. User Registration on Socket Connection
    socket.on("register-user", ({ user, userId, userName }: { user?: any; userId: string; userName: string }) => {
      userSocketMap.set(userId, socket.id);
      socketUserMap.set(socket.id, userId);
      socket.data.userId = userId;
      socket.data.userName = userName;

      if (userStore) {
        if (user) {
          userStore.syncUser(user);
        } else {
          userStore.setUserOnline(userId, true);
        }
      }

      // Broadcast to other peers that this user is online (green light)
      socket.broadcast.emit("user-status-changed", { userId, isOnline: true });
      io.emit("peers-updated");
      logger.info({ userId, userName, socketId: socket.id }, "User registered socket for real-time peer calls");
    });

    // 2. Direct Call Connection Request ("Connect" green button click)
    socket.on("call-user", ({ toUserId, fromUser, requestedSkill }: { toUserId: string; fromUser: any; requestedSkill?: string }) => {
      logger.info({ fromUser: fromUser.fullName, toUserId, requestedSkill }, "Initiating peer call connection request");
      const targetSocketId = userSocketMap.get(toUserId);

      if (targetSocketId) {
        const roomId = `room-${fromUser.id}-${toUserId}-${Date.now()}`;
        io.to(targetSocketId).emit("incoming-call", {
          fromUser,
          roomId,
          requestedSkill: requestedSkill || "Peer Learning",
          timestamp: new Date().toISOString(),
        });
      } else {
        socket.emit("call-failed", {
          toUserId,
          message: "User is currently offline or disconnected. Please try again shortly.",
        });
      }
    });

    // 3. Call Acceptance
    socket.on("accept-call", ({ roomId, callerUserId }: { roomId: string; callerUserId: string }) => {
      const callerSocketId = userSocketMap.get(callerUserId);
      logger.info({ roomId, callerUserId, callerSocketId }, "Call accepted by peer");

      if (callerSocketId) {
        io.to(callerSocketId).emit("call-accepted", { roomId });
      }
      socket.emit("call-accepted", { roomId });
    });

    // 4. Call Decline
    socket.on("decline-call", ({ callerUserId, reason }: { callerUserId: string; reason?: string }) => {
      const callerSocketId = userSocketMap.get(callerUserId);
      if (callerSocketId) {
        io.to(callerSocketId).emit("call-declined", {
          message: reason || "User is currently unavailable or declined the request.",
        });
      }
    });

    // 5. Join Room for Video, Audio, Whiteboard, and Chat
    socket.on("join-room", async ({ roomId, userId, userName }: { roomId: string; userId: string; userName: string }) => {
      await socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;
      socket.data.userName = userName;

      logger.info({ socketId: socket.id, roomId, userId, userName }, "User joined session room");

      // Notify other peers in this room
      socket.to(roomId).emit("peer-joined", {
        socketId: socket.id,
        userId,
        userName,
      });

      // Send list of existing peers in the room
      const room = io.sockets.adapter.rooms.get(roomId);
      const existingPeers: string[] = [];
      if (room) {
        for (const id of room) {
          if (id !== socket.id) existingPeers.push(id);
        }
      }
      socket.emit("existing-peers", { peers: existingPeers });
    });

    // 6. WebRTC SDP Offer Exchange
    socket.on("webrtc-offer", ({ roomId, targetSocketId, sdp }: SdpPayload) => {
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

    // 7. WebRTC SDP Answer Exchange
    socket.on("webrtc-answer", ({ roomId, targetSocketId, sdp }: SdpPayload) => {
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

    // 8. ICE Candidates Exchange
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

    // 9. Screen Share Toggle Notification
    socket.on("screen-share-toggle", ({ roomId, isSharing }: { roomId: string; isSharing: boolean }) => {
      socket.to(roomId).emit("peer-screen-share-toggle", {
        socketId: socket.id,
        userId: socket.data?.userId,
        isSharing,
      });
    });

    // 10. Collaborative Writing Board (Whiteboard) Sync
    socket.on("whiteboard-draw", ({ roomId, drawData }: WhiteboardDrawPayload) => {
      socket.to(roomId).emit("whiteboard-draw", drawData);
    });

    socket.on("whiteboard-clear", ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit("whiteboard-clear");
    });

    // 11. In-Session Collaborative Chat Messages
    socket.on("send-chat-message", ({ roomId, message, senderName, timestamp }: ChatMessagePayload) => {
      io.to(roomId).emit("receive-chat-message", {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        senderId: socket.id,
        senderUserId: socket.data?.userId,
        senderName,
        message,
        timestamp: timestamp || new Date().toISOString(),
      });
    });

    // 12. In-Session File Upload & Exchange
    socket.on("send-file", ({ roomId, senderName, fileName, fileSize, fileType, fileData, timestamp }: FileSharePayload) => {
      logger.info({ roomId, senderName, fileName, fileSize }, "Broadcasting shared file to room");
      io.to(roomId).emit("receive-file", {
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        senderId: socket.id,
        senderUserId: socket.data?.userId,
        senderName,
        fileName,
        fileSize,
        fileType,
        fileData,
        timestamp: timestamp || new Date().toISOString(),
      });
    });

    // 13. End Call / Leave Room
    socket.on("leave-room", ({ roomId }: { roomId: string }) => {
      socket.leave(roomId);
      socket.to(roomId).emit("peer-disconnected", {
        socketId: socket.id,
        userId: socket.data?.userId,
        userName: socket.data?.userName,
      });
    });

    // 14. Cleanup on Socket Disconnect
    socket.on("disconnect", () => {
      activeWebsocketConnections.dec();
      const userId = socketUserMap.get(socket.id);
      if (userId) {
        userSocketMap.delete(userId);
        socketUserMap.delete(socket.id);
        if (userStore) {
          userStore.setUserOnline(userId, false);
        }
        socket.broadcast.emit("user-status-changed", { userId, isOnline: false });
        io.emit("peers-updated");
      }

      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit("peer-disconnected", {
            socketId: socket.id,
            userId: socket.data?.userId,
            userName: socket.data?.userName,
          });
        }
      }
      logger.info({ socketId: socket.id, userId }, "Client disconnected from signaling gateway");
    });
  });

  return io;
}
