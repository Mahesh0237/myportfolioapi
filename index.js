const path = require("path");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const compression = require("compression");
const app = express();
const { createServer } = require("node:http");
const { Server } = require("socket.io");
require('./helper/diaryCheckToPublish')

const server = createServer(app);

const os = require('os');


const io = new Server(server, {
  cors: {
    // origin: true,
    origin: process.env.MAIN_URL,
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

const authRoute = require("./routes/authRoute");
const employeeRoute = require("./routes/employeeRoute");
const userRoute = require("./routes/userRoute");
const generalRoute = require("./routes/generalRoute");
const diaryRoute = require("./routes/diaryRoute");
const enquiriesRoute = require("./routes/enquiriesRoute");
const teamRoute = require("./routes/teamRoute");
const chatRoute = require("./routes/chatRoute");
const settingsRoute = require('./routes/settingsRoute');
const userdashboardRoute = require('./routes/userdashboardRoute');
const notificationRoute = require('./routes/notificationRoute');
const cors = require("cors");

// Use Helmet for security
app.use(helmet());

// Use compression
app.use(compression());

// // Middleware to handle CORS
// app.use((req, res, next) => {
//   const origin = req.headers.origin;
//   res.header('Access-Control-Allow-Origin', origin);
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
//   res.header('Access-Control-Allow-Credentials', 'true');
//   res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
//   next();
// });

const corsOptions = {
  origin: true,
  credentials: true, // Allow cookies and Authorization headers
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders:
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  exposedHeaders: ["Content-Disposition"], // Allow the Content-Disposition header to be accessed by the frontend
};

app.use(cors(corsOptions));

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.json({ limit: '100mb' }));  // For JSON data
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", async (req, res) => {
  res.send("API Server is running");
});

// Auth router
app.use("/auth", authRoute);
app.use("/employee", employeeRoute);
app.use("/users", userRoute);
app.use("/general", generalRoute);
app.use("/diaries", diaryRoute);
app.use("/enquiry", enquiriesRoute);
app.use("/team", teamRoute);
app.use("/chat", chatRoute);
app.use('/settings', settingsRoute);
app.use('/userdashboard', userdashboardRoute);
app.use('/notification', notificationRoute);

const userSocketMap = new Map(); // Maps userId to socketId

const activeChatRooms = new Map(); // roomId -> Set of user IDs
/// SOCKET-CODE
io.on("connection", (socket) => {
  // console.log("Socket connected:", socket.id);
  const userId = socket.handshake.query?.userId;
  if (userId) {
    userSocketMap.set(userId, socket.id);
    socket.join(userId); // Join a room named after the userId
  }

  socket.on("joinRoomlivelist", (userId) => {
    console.log(`User ${userId.senderId} joined their personal room`);
    socket.join(userId); // This is essential
  });

  // Join a consistent room based on sender and receiver IDs
  socket.on("joinRoom", ({ senderId, receiverId }) => {
    // const roomId = [senderId, receiverId].sort().join("_");
    const roomId = [senderId, receiverId].sort().join("_");

    socket.join(roomId);
    console.log(
      `senderID- ${senderId}, reciever-ID- ${receiverId}, roomID- ${roomId}`
    );
    //////////// New
    if (!activeChatRooms.has(roomId)) {
      activeChatRooms.set(roomId, new Set());
    }
    activeChatRooms.get(roomId).add(socket.id);

    console.log(`User ${userId} joined room ${roomId}`);
    console.log(
      `Current room participants (${roomId}):`,
      activeChatRooms.get(roomId)
    );

    markMessagesAsRead(senderId, receiverId);
  });

  ////////////////////
  socket.on("typing", ({ senderId, receiverId }) => {
    const room = [senderId, receiverId].sort().join("_");
    socket.to(room).emit("typing", { senderId });
  });

  ////////////////////////////
  socket.on("stopTyping", ({ senderId, receiverId }) => {
    const room = [senderId, receiverId].sort().join("_");
    socket.to(room).emit("stopTyping", { senderId });
  });

  //////////////////////////
  socket.on("leaveRoom", ({ roomId }) => {
    socket.leave(roomId);
    // console.log(`${socket.id} left room ${roomId}`);

    //////////////// New
    // Remove user from room tracking
    if (activeChatRooms.has(roomId)) {
      activeChatRooms.get(roomId).delete(socket.id);
      if (activeChatRooms.get(roomId).size === 0) {
        activeChatRooms.delete(roomId);
      }
    }

    console.log(`User ${socket.id} left room ${roomId}`);
  });

  // Handle message sending
  socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
    const roomId = [senderId, receiverId].sort().join("_");

    try {
      // Check if receiver is in the same room
      const receiverSocketId = userSocketMap.get(receiverId);
      const isReceiverInRoom = activeChatRooms.get(roomId)?.has(receiverId);

      console.log("Receiver presence check:", {
        roomId,
        receiverSocketId,
        isReceiverInRoom,
        roomParticipants: activeChatRooms.get(roomId),
      });

      // 1. Store the message in DB
      const savedMessage = await prisma.chats.create({
        data: {
          sender_id: BigInt(senderId),
          receiver_id: BigInt(receiverId),
          message: message,
          is_read: isReceiverInRoom || false,
        },
      });

      const cleanMessage = {
        id: Number(savedMessage.id), // or String if you prefer
        senderId: String(savedMessage.sender_id),
        receiverId: String(savedMessage.receiver_id),
        message: savedMessage.message,
        is_read: savedMessage.is_read,
        createdAt: savedMessage.createdAt,
      };

      // Use this sanitized object for all emits
      io.to(roomId).emit("receiveMessage", cleanMessage);
      io.to(receiverId).emit("messageFrom", cleanMessage);

      ////intimating the reciever to refresh chatList
      io.to(receiverId).emit("updateChatList");

      // Emit chat list updates to both users
      io.to(senderId).emit("chatListUpdated", {
        ...cleanMessage,
        timestamp: new Date(),
      });
      io.to(receiverId).emit("chatListUpdated", {
        ...cleanMessage,
        timestamp: new Date(),
      });

      console.log("Message saved and broadcasted to room:", roomId);
    } catch (err) {
      console.error("Error storing/emitting message:", err);
    }
  });

  async function markMessagesAsRead(senderId, receiverId) {
    try {
      await prisma.chats.updateMany({
        where: {
          sender_id: BigInt(receiverId),
          receiver_id: BigInt(senderId),
          is_read: false,
        },
        data: { is_read: true },
      });
      console.log(
        `Messages marked as read between ${senderId} and ${receiverId}`
      );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }

  socket.on("disconnect", () => {
    // Clean up room participation
    for (const [roomId, sockets] of activeChatRooms.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          activeChatRooms.delete(roomId);
        }
      }
    }

    // Clean up user mapping
    if (userId) {
      userSocketMap.delete(userId);
    }
  });
});

// Handle 404 errors
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
  });
});

const getLocalIP = () => {
  const networkInterfaces = os.networkInterfaces();
  for (let iface in networkInterfaces) {
    for (let i = 0; i < networkInterfaces[iface].length; i++) {
      const address = networkInterfaces[iface][i];
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
};

const IP_ADDRESS = getLocalIP();
console.log('Local Ip Address:', IP_ADDRESS)

// Other app configurations and middleware
const PORT = process.env.PORT || 5122;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
