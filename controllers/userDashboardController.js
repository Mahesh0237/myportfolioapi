const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getLatestInvitationRequests = async (req, res) => {
    const { user_uid } = req.query;

    try {
        // get user id from user_uid
        const user = await prisma.users.findFirst({
            where: {
                uuid: user_uid
            },
            select: {
                id: true,
            }
        })
        if (!user) {
            return res.status(200).json({
                status: 'error',
                message: 'User not found',
            });
        }
        const user_id = user?.id;

        const diaryinvitations = await prisma.diaryinvitations.findMany({
            where: {
                receiver_id: parseInt(user_id),
            },
            select: {
                id: true,
                uuid: true,
                status: true,
                diary: {
                    select: {
                        name: true,
                        uuid: true,
                    }
                },
                sender: {
                    select: {
                        name: true,
                    }
                },
                created_at: true,
            },
            take: 5,
            orderBy: {
                created_at: 'desc'
            }
        })

        const alldiaryinvitations = []
        if (diaryinvitations.length > 0) {
            diaryinvitations.map(invitations => {
                alldiaryinvitations.push({
                    name: invitations.diary.name,
                    uuid: invitations.diary.uuid,
                    invitation_uuid: invitations.uuid,
                    sender_name: invitations.sender.name,
                    status: invitations.status,
                    created_at: invitations.created_at,
                })
            });
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: "All Diary Invitations Fetched Successfully",
            latest_invitation_requests: alldiaryinvitations,
        });
    } catch (error) {
        console.log(error);
        await prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
}

exports.getLatestDiaryComments = async (req, res) => {
    const { user_uid } = req.query;

    try {
        // get user id from user_uid
        const user = await prisma.users.findFirst({
            where: {
                uuid: user_uid
            },
            select: {
                id: true,
            }
        })
        if (!user) {
            return res.status(200).json({
                status: 'error',
                message: 'User not found',
            });
        }
        const user_id = user?.id;

        // get the diries id from user_id
        const diaries = await prisma.diaries.findMany({
            where: {
                user_id: parseInt(user_id),
            },
            select: {
                id: true,
                uuid: true,
            }
        })

        const diarycomments = await prisma.diarycomments.findMany({
            where: {
                diary_id: {
                    in: diaries.map(diary => diary.id)
                },
                user_id: {
                    not: parseInt(user_id) // Exclude comments made by the user themselves
                }
            },
            include: {
                user: {
                    select: {
                        name: true,
                        profile_image: true,
                        gender: true,
                    },
                },
                diary: {
                    select: {
                        name: true,
                        uuid: true,
                    }
                }
            },
            take: 5,
            orderBy: {
                created_at: 'desc'
            }
        })

        const alldiarycomments = []
        if (diarycomments.length > 0) {
            diarycomments.map(comment => {
                alldiarycomments.push({
                    id: comment.id.toString(),
                    diary_id: comment.diary_id.toString(),
                    user_id: comment.user_id.toString(),
                    diary_name: comment.diary.name,
                    diary_uuid: comment.diary.uuid,
                    comment: comment.comment,
                    created_at: comment.created_at,
                    updated_at: comment.updated_at,
                    user_name: comment.user?.name,
                    user_image: comment.user?.profile_image,
                    user_gender: comment.user?.gender,
                })
            });
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: "All Diary Comments Fetched Successfully",
            latest_diary_comments: alldiarycomments,
        });
    } catch (error) {
        console.log(error);
        await prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
}

exports.getLatestDiarys = async (req, res) => {
    const { user_uid } = req.query;

    try {
        // get user id from user_uid
        const user = await prisma.users.findFirst({
            where: {
                uuid: user_uid
            },
            select: {
                id: true,
            }
        })
        if (!user) {
            return res.status(200).json({
                status: 'error',
                message: 'User not found',
            });
        }
        const user_id = user?.id;

        const diaries = await prisma.diaries.findMany({
            where: {
                user_id: parseInt(user_id),
            },
            include: {
                userdetails: {
                    select: {
                        name: true,
                        profile_image: true,
                    },
                },
                diarycontent: {
                    select: {
                        content: true,
                        page_no: true,
                    },
                    orderBy: {
                        id: 'asc'
                    }
                }
            },
            take: 5,
            orderBy: {
                updated_at: 'desc'
            }
        })

        const alldiaries = []
        if (diaries.length > 0) {
            diaries.map(diary => {
                alldiaries.push({
                    id: diary.id.toString(),
                    uuid: diary.uuid,
                    name: diary.name,
                    featured_image_url: diary.featured_image_url,
                    created_at: diary.created_at,
                    author_name: diary.userdetails?.name || "Unknown",
                    author_image: diary.userdetails?.profile_image || null,
                    diarycontent: diary.diarycontent.map((content) => ({
                        content: content.content,
                        page_no: content.page_no,
                    })),
                })
            });
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: "All Diaries Fetched Successfully",
            latest_diaries: alldiaries,
        });
    } catch (error) {
        console.log(error);
        await prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
}

exports.getInvitedDiaries = async (req, res) => {
    const { user_id, limit = 4, offset = 0 } = req.query;
    try {
        const invitations = await prisma.diaryinvitations.findMany({
            where: {
                receiver_id: BigInt(user_id),
                status: "Accepted"
            },
            include: {
                diary: {
                    select: {
                        id: true,
                        name: true,
                        uuid: true,
                        featured_image_url: true,
                        userdetails: {
                            select: {
                                name: true,
                                profile_image: true
                            }
                        },
                        diarycontent: {
                            select: {
                                content: true,
                                page_no: true
                            },
                            orderBy: {
                                id: 'asc'
                            }
                        }
                    }
                },
            },
            take: parseInt(limit),
            skip: parseInt(offset),
        })

        const totalInvitationsCount = await prisma.diaryinvitations.count({
            where: {
                receiver_id: BigInt(user_id),
                status: "Accepted"
            }
        });

        let allInvitations = [];
        if (invitations.length > 0) {
            allInvitations = invitations.map((invitation) => {
                return {
                    id: invitation.id.toString(),
                    diary_id: invitation.diary.id.toString(),
                    uuid: invitation.diary.uuid,
                    name: invitation.diary.name,
                    featured_image_url: invitation.diary.featured_image_url,
                    created_at: invitation.diary.created_at,
                    author_name: invitation.diary.userdetails?.name || "Unknown",
                    author_image: invitation.diary.userdetails?.profile_image || null,
                    diarycontent: invitation.diary.diarycontent.map((content) => ({
                        content: content.content,
                        page_no: content.page_no,
                    })),
                }
            })
        }

        await prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            diaries: allInvitations,
            totalDiariesCount: totalInvitationsCount
        });
    } catch (error) {
        console.error('Error fetching diary invitations:', error);
        await prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
}

exports.getLatestInvitedDiries = async (req, res) => {
    const { user_uid } = req.query;

    try {
        // get user id from user_uid
        const user = await prisma.users.findFirst({
            where: {
                uuid: user_uid
            },
            select: {
                id: true,
            }
        })
        if (!user) {
            return res.status(200).json({
                status: 'error',
                message: 'User not found',
            });
        }
        const user_id = user?.id;

        const diaryinvitations = await prisma.diaryinvitations.findMany({
            where: {
                receiver_id: parseInt(user_id),
                status: "Accepted"
            },
            include: {
                diary: {
                    select: {
                        id: true,
                        name: true,
                        uuid: true,
                        featured_image_url: true,
                        userdetails: {
                            select: {
                                name: true,
                                profile_image: true
                            }
                        },
                        diarycontent: {
                            select: {
                                content: true,
                                page_no: true
                            },
                            orderBy: {
                                id: 'asc'
                            }
                        }
                    }
                },
            },
            take: 5,
            orderBy: {
                created_at: 'desc'
            }
        })

        const alldiaryinvitations = []
        if (diaryinvitations.length > 0) {
            diaryinvitations.map(invitation => {
                alldiaryinvitations.push({
                    id: invitation.id.toString(),
                    diary_id: invitation.diary.id.toString(),
                    uuid: invitation.diary.uuid,
                    name: invitation.diary.name,
                    featured_image_url: invitation.diary.featured_image_url,
                    created_at: invitation.diary.created_at,
                    author_name: invitation.diary.userdetails?.name || "Unknown",
                    author_image: invitation.diary.userdetails?.profile_image || null,
                    diarycontent: invitation.diary.diarycontent.map((content) => ({
                        content: content.content,
                        page_no: content.page_no,
                    })),
                })
            });
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: "All Diary Invitations Fetched Successfully",
            latest_invited_diaries: alldiaryinvitations,
        });
    } catch (error) {
        console.log(error);
        await prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
}

