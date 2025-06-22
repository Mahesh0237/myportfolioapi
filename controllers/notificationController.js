const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getNotifications = async (req, res) => {
    const { user_id, skip, take } = req.query;

    try {
        const notifications = await prisma.usernotification.findMany({
            where: {
                user_id: parseInt(user_id)
            },
            skip: parseInt(skip),
            take: parseInt(take),
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                id: true,
                is_read: true,
                message: true,
                type: true,
                createdAt: true,
                link: true,
                added_bydetails: {
                    select: {
                        profile_image: true,
                        name: true,
                        uuid: true
                    }
                }
            }
        });

        let notificationDetails = [];
        if (notifications.length > 0) {
            notificationDetails = notifications.map(notification => {
                return {
                    id: notification.id.toString(),
                    type: notification.type,
                    message: notification.message,
                    created_at: notification.createdAt,
                    is_read: notification.is_read,
                    link: notification.link,
                    added_user_profile: notification.added_bydetails?.profile_image,
                    added_user_name: notification.added_bydetails?.name,
                    added_by_user_uid: notification.added_bydetails?.uuid
                };
            });
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            notifications: notificationDetails
        });

    } catch (error) {
        console.error(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: `Internal server error`
        });
    }
}

exports.markNotificationAsRead = async (req, res) => {
    const { user_id } = req.body;

    try {
        await prisma.usernotification.updateMany({
            where: {
                user_id: parseInt(user_id)
            },
            data: {
                is_read: true,
                updatedAt: new Date()
            }
        });

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: `Internal server error`
        });
    }
}

exports.clearAllNotifications = async (req, res) => {
    const { user_id } = req.body;

    try {
        await prisma.usernotification.deleteMany({
            where: {
                user_id: parseInt(user_id)
            }
        });

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'All notifications cleared'
        });

    } catch (error) {
        console.error(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: `Internal server error`
        });
    }
}

exports.getUnreadNotificationCount = async (req, res) => {
    const { user_uid } = req.query;

    try {
        const user = await prisma.users.findFirst({
            where: {
                uuid: user_uid
            },
            select: {
                id: true
            }
        });

        if (!user) {
            return res.status(200).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const user_id = user?.id;
        const notificationCount = await prisma.usernotification.count({
            where: {
                user_id: parseInt(user_id),
                is_read: false
            },
        });

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            notification_count: notificationCount
        });

    } catch (error) {
        console.error(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: `Internal server error`
        });
    }
}