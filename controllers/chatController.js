const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getChatUsers = async (req, res) => {
  const { receiver_id } = req.query;

  try {
    const chats = await prisma.chats.findMany({
      where: {
        OR: [
          { receiver_id: BigInt(receiver_id) },
          { sender_id: BigInt(receiver_id) },
        ],
        NOT: {
          AND: [
            { receiver_id: BigInt(receiver_id) },
            { sender_id: BigInt(receiver_id) },
          ],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        senderdetails: {
          select: {
            id: true,
            name: true,
            profile_image: true,
          },
        },
        receiverdetails: {
          select: {
            id: true,
            name: true,
            profile_image: true,
          },
        },
      },
    });

    const conversationMap = new Map();

    for (const chat of chats) {
      const senderId = chat.sender_id;
      const receiverId = chat.receiver_id;

      if (!senderId || !receiverId) continue;

      const userKey = [senderId, receiverId].sort().join("-");
      if (!conversationMap.has(userKey)) {
        const isCurrentUserSender = BigInt(receiver_id) === senderId;
        const otherUser = isCurrentUserSender
          ? chat.receiverdetails
          : chat.senderdetails;

        // Count unread messages for this conversation
        const unreadCount = await prisma.chats.count({
          where: {
            sender_id: otherUser?.id,
            receiver_id: BigInt(receiver_id),
            is_read: false,
          },
        });

        conversationMap.set(userKey, {
          id: otherUser?.id.toString(),
          name: otherUser?.name,
          profile_image: otherUser?.profile_image,
          lastMessage: chat.message,
          timestamp: chat.createdAt,
          unreadCount: unreadCount,
        });
      }
    }

    const chatUserList = Array.from(conversationMap.values());

    return res.status(200).json({
      status: "success",
      users: chatUserList,
    });
  } catch (error) {
    console.error("Error fetching chat users with latest messages:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

exports.markMessagesAsRead = async (req, res) => {
  const { sender_id, receiver_id } = req.body;

  if (!sender_id || !receiver_id) {
    return res.status(400).json({ status: "error", message: "Missing sender_id or receiver_id" });
  }

  try {
    await prisma.chats.updateMany({
      where: {
        sender_id: BigInt(sender_id),
        receiver_id: BigInt(receiver_id),
        is_read: false,
      },
      data: {
        is_read: true,
      },
    });

    return res.json({ status: "success", message: "Messages marked as read" });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

exports.getMessagesBetweenUsers = async (req, res) => {
  const { sender_id, receiver_id, page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  try {
    const totalMessages = await prisma.chats.count({
      where: {
        OR: [
          { sender_id: BigInt(sender_id), receiver_id: BigInt(receiver_id) },
          { sender_id: BigInt(receiver_id), receiver_id: BigInt(sender_id) }
        ]
      }
    });

    const messages = await prisma.chats.findMany({
      where: {
        OR: [
          { sender_id: BigInt(sender_id), receiver_id: BigInt(receiver_id) },
          { sender_id: BigInt(receiver_id), receiver_id: BigInt(sender_id) }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      skip: skip,
    });

    const formatted = messages
      .reverse()
      .map((msg) => ({
        id: msg.id.toString(),
        senderId: msg.sender_id?.toString(),
        receiverId: msg.receiver_id?.toString(),
        message: msg.message,
        timestamp: msg.createdAt,
      }));

    return res.status(200).json({
      status: 'success',
      messages: formatted,
      total: totalMessages,
      hasMore: totalMessages > (pageNum * limitNum),
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
};

exports.getUserById = async (req, res) => {
  const { id: userId } = req.params;
  const currentUserId = req.user.id;

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const latestMessage = await prisma.message.findFirst({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId },
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({ ...user, latestMessage });
  } catch (error) {
    console.error("Error in getUserById:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};