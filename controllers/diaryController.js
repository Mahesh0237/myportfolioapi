const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const multiparty = require("multiparty");
const fs = require('fs');
const path = require('path');
const deleteEmptyFolders = require("../helper/deleteEmptyFolders");
const prisma = new PrismaClient();

const os = require('os');

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

//Admin
exports.GetDiaries = async (req, res) => {
  const { take, skip, searchQuery } = req.query;

  try {
    const searchCondition = searchQuery
      ? {
        name: { contains: searchQuery, mode: "insensitive" },
      }
      : {};

    const diaries = await prisma.diaries.findMany({
      where: searchCondition,
      take: parseInt(take),
      skip: parseInt(skip),
      orderBy: { created_at: "desc" },
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
            updated_at: true,
          },
          orderBy: {
            updated_at: 'desc',
          },
          take: 1,
        }
      },
    });

    const totalDiariesCount = await prisma.diaries.count({
      where: searchCondition
    });


    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    const diaryDetails = diaries.map((diary) => ({
      id: diary.id.toString(),
      uuid: diary?.uuid,
      user_id: diary.user_id?.toString() || null,
      author_name: diary.userdetails?.name || "Unknown",
      author_image: diary.userdetails?.profile_image,
      name: diary.name,
      featured_image_url: diary.featured_image_url,
      created_at: diary.created_at,
      updated_at: diary.updated_at,
      diarycontent: diary.diarycontent.map((content) => ({
        content: content.content,
        page_no: content.page_no,
        content_image: extractFirstImage(content?.content),
      })),
    }));

    await prisma.$disconnect();
    return res.status(200).json({
      status: "success",
      diaries: diaryDetails,
      totalDiariesCount,
    });
  } catch (err) {
    console.error(err);
    await prisma.$disconnect();
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

exports.getAdminSingleViewDairyData = async (req, res) => {
  const { uid } = req.query;

  try {
    const diaryData = await prisma.diaries.findFirst({
      where: {
        uuid: uid
      },
      select: {
        id: true,
        name: true,
        status: true,
        created_at: true,
        is_private: true,
        is_featured_diary: true,
        userdetails: true
      }
    })

    if (!diaryData) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary not found"
      })
    }

    const dairyid = diaryData.id.toString();

    //total pages count
    const totaldiaryPagesCount = await prisma.diarypages.count({
      where: {
        diary_id: parseInt(dairyid)
      }
    })
    let dairyPageContent = null;
    if (totaldiaryPagesCount > 0) {
      const pageno = 1;
      const dairyPages = await prisma.diarypages.findFirst({
        where: {
          diary_id: dairyid,
          page_no: pageno,
        },
        select: {
          content: true,
        }
      })
      dairyPageContent = dairyPages.content;
    }

    const diaryPageDetails = {
      id: diaryData.id.toString(),
      name: diaryData.name,
      created_at: diaryData.created_at,
      content: dairyPageContent,
      status: diaryData.is_private ? "Private" : "Public",
      diary_status: diaryData.status,
      is_featured_diary: diaryData.is_featured_diary ? "Featured" : "Unfeatured",
      author_details: {
        author_id: diaryData?.userdetails?.id.toString() || null,
        name: diaryData.userdetails?.name || "Unknown",
        profile_image: diaryData.userdetails?.profile_image || null,
      }
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      diaryPageDetails: diaryPageDetails,
      totaldiaryPagesCount: totaldiaryPagesCount,
    })
  }
  catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.getAdminDiaryComments = async (req, res) => {
  const { diary_id, diarypage_no } = req.query;

  try {

    const diary = await prisma.diaries.findFirst({
      where: {
        id: BigInt(diary_id)
      }
    })

    if (!diary) {
      return res.status(200).json({
        status: "error",
        message: "Diary not found"
      })
    }

    const diarypages = await prisma.diarypages.findFirst({
      where: {
        diary_id: diary.id,
        page_no: parseInt(diarypage_no)
      },
      select: { id: true }
    })

    if (!diarypages) {
      return res.status(200).json({
        status: 'error',
        message: 'diary page not found'
      })
    }


    const comments = await prisma.diarycomments.findMany({
      where: {
        diary_id: BigInt(diary_id),
        parent_comment_id: null,
        single_page_id: diarypages.id
      },
      include: {
        user: {
          select: {
            name: true,
            profile_image: true,
            gender: true,
          },
        },
        commentReplies: {
          include: {
            user: {
              select: {
                name: true,
                profile_image: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
        },
        commentLikes: true,
        // need count of likes
        _count: {
          select: {
            commentLikes: true,
          }
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const commentCount = await prisma.diarycomments.count({
      where: {
        diary_id: BigInt(diary_id),
        parent_comment_id: null,
        single_page_id: diarypages.id
      },
    });


    const formatComment = async (comment) => ({
      id: comment.id.toString(),
      diary_id: comment.diary_id.toString(),
      user_id: comment.user_id.toString(),
      comment: comment.comment,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      user_name: comment.user?.name,
      user_image: comment.user?.profile_image,
      user_gender: comment.user?.gender,
      commentLikes: comment.commentLikes.map((like) => ({
        id: like.id?.toString(),
        comment_id: like.comment_id?.toString(),
        user_id: like.user_id?.toString(),
      })),
      likeCount: comment._count.commentLikes,

      replies: await getReplies(comment.id)
    });

    const allComments = await Promise.all(comments.map(formatComment));

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      comments: allComments,
      commentCount: commentCount,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
};

exports.getAdminDiaryPages = async (req, res) => {
  const { diary_uid, page_no } = req.query;
  try {
    const parsedPageNo = parseInt(page_no);
    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diary_uid
      },
      select: {
        id: true
      }
    })

    const diray_id = diary?.id;

    let diaryPage;
    if (page_no) {
      diaryPage = await prisma.diarypages.findFirst({
        where: {
          diary_id: diray_id,
          page_no: parsedPageNo
        }
      });
      if (!diaryPage) {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'error',
          message: "Diary page not found"
        });
      }
    }

    prisma.$disconnect();

    return res.status(200).json({
      status: 'success',
      content: diaryPage?.content
    });

  } catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.suspendOrUnsuspenddiary = async (req, res) => {
  const { diary_uid, status } = req.body;
  try {

    // get diary id from diary uid
    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diary_uid
      },
      select: {
        id: true
      }
    })
    if (!diary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary not found"
      })
    }

    await prisma.diaries.update({
      where: {
        id: diary?.id
      },
      data: {
        status: status,
        updated_at: new Date()
      }
    })
    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: `Diary ${status} successfully`
    })
  } catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.adminDeleteDiary = async (req, res) => {
  const { diary_uid } = req.body;
  try {
    // get diary id from diary uid
    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diary_uid
      },
      select: {
        id: true,
        featured_image_path: true
      }
    })
    if (!diary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary not found"
      })
    }

    const comments = await prisma.diarycomments.findMany({
      where: { diary_id: diary.id },
      select: { id: true }
    });

    const commentIds = comments.map(comment => comment.id);

    if (commentIds.length > 0) {
      await prisma.commentLike.deleteMany({
        where: {
          comment_id: {
            in: commentIds
          }
        }
      });
    }

    await prisma.diarycomments.deleteMany({
      where: {
        diary_id: diary?.id
      }
    })

    await prisma.diarypages.deleteMany({
      where: {
        diary_id: diary?.id
      }
    })

    await prisma.diaryinvitations.deleteMany({
      where: {
        diary_id: diary?.id
      }
    })

    await prisma.sharediariesbylink.deleteMany({
      where: {
        diary_id: diary?.id
      }
    })

    await prisma.diaries.delete({
      where: {
        id: diary?.id
      }
    })

    // delete the image from the server
    if (diary?.featured_image_path) {
      fs.unlink(diary?.featured_image_path, (err) => {
        if (err) {
          console.error('Error deleting image:', err);
        }
      });
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: "Diary deleted successfully"
    })
  } catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.featuredOrUnfeaturedDiary = async (req, res) => {
  const { diary_uid, status } = req.body;
  try {

    // get diary id from diary uid
    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diary_uid
      },
      select: {
        id: true
      }
    })
    if (!diary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary not found"
      })
    }

    await prisma.diaries.update({
      where: {
        id: diary?.id
      },
      data: {
        is_featured_diary: status === "Featured" ? true : false,
        updated_at: new Date()
      }
    })
    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: `Diary ${status} successfully`
    })
  } catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.getFrontendDiaries = async (req, res) => {
  const { take, skip, category, searchQuery } = req.query;

  try {
    // Base filters: public + active
    const baseWhere = {
      is_private: false,
      status: "Active",
      ...(category ? { category_id: parseInt(category) } : {}),
      ...(searchQuery
        ? {
          OR: [
            { name: { contains: searchQuery, mode: "insensitive" } },
            {
              userdetails: {
                name: { contains: searchQuery, mode: "insensitive" },
              },
            },
          ],
        }
        : {}),
      diarycontent: {
        some: {
          status: 'Published'
        }
      }
    };

    const diaries = await prisma.diaries.findMany({
      where: baseWhere,
      take: parseInt(take),
      skip: parseInt(skip),
      orderBy: { updated_at: "desc" },
      include: {
        userdetails: {
          select: {
            name: true,
            profile_image: true,
          },
        },
        diarycontent: {
          where: {
            status: 'Published'
          },
          select: {
            content: true,
            page_no: true,
            updated_at: true,
            view_count: true,
            share_count: true,
            _count: {
              select: {
                diarycomments: true
              }
            },
            status: true
          },
          orderBy: {
            created_at: 'desc',
          },
          // take: 1,
        },
        diarylike: {
          where: {
            isliked: true
          },
          select: {
            id: true
          }
        }
      },
    });

    // const filteredDiaries = diaries.filter(diary =>
    //   diary.diarycontent.length > 0 && diary.diarycontent[0].status === "Published"
    // );

    const totalDiariesCount = await prisma.diaries.count({
      where: baseWhere,
    });

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    const diaryDetails = diaries.map((diary) => {
      const likesCount = diary.diarylike ? diary.diarylike.length : 0;
      const recentContent = diary.diarycontent[0];
      const firstPage = diary.diarycontent.find(content => content.page_no === 1);

      return {
        id: diary.id.toString(),
        uuid: diary?.uuid,
        user_id: diary.user_id?.toString() || null,
        author_name: diary.userdetails?.name || "Unknown",
        author_image: diary.userdetails?.profile_image,
        name: diary.name,
        featured_image_url: diary.featured_image_url,
        created_at: diary.created_at,
        updated_at: diary.updated_at,
        likes_count: likesCount,
        diarycontent: {
          content: recentContent?.content,
          page_no: recentContent?.page_no,
          content_image: extractFirstImage(recentContent?.content),
          view_count: recentContent?.view_count?.toString() || "0",
          share_count: recentContent?.share_count?.toString() || "0",
          comment_count: recentContent?._count?.diarycomments || 0,
          updated_at: recentContent?.updated_at
        }
      };
    });

    await prisma.$disconnect();
    return res.status(200).json({
      status: "success",
      diaries: diaryDetails,
      totalDiariesCount,
    });
  } catch (err) {
    console.error(err);
    await prisma.$disconnect();
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

exports.getLatestDiaries = async (req, res) => {
  try {
    const diaries = await prisma.diaries.findMany({
      where: {
        is_private: false,
        status: "Active",
        diarycontent: {
          some: {
            status: 'Published'
          }
        }
      },
      take: 4,
      orderBy: { updated_at: "desc" },
      include: {
        userdetails: {
          select: {
            name: true,
            profile_image: true,
          },
        },
        diarycontent: {
          where: {
            status: 'Published',
          },
          select: {
            content: true,
            page_no: true,
            updated_at: true,
            view_count: true,
            share_count: true,
            featured_image: true,
            _count: {
              select: {
                diarycomments: true
              }
            },
            status: true
          },
          orderBy: {
            created_at: 'desc',
          },
        },
        diarylike: {
          where: {
            isliked: true
          },
          select: {
            id: true
          }
        }
      },
    });

    const totalDiariesCount = await prisma.diaries.count({
      where: {
        is_private: false,
        status: "Active",
        diarycontent: {
          some: {
            status: 'Published'
          }
        }
      }
    });

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    const total_diaries = diaries.map((diary) => {
      const likesCount = diary.diarylike ? diary.diarylike.length : 0;
      const recentContent = diary.diarycontent[0];
      const firstPage = diary.diarycontent.find(content => content.page_no === 1);

      return {
        id: diary.id.toString(),
        uuid: diary?.uuid,
        user_id: diary.user_id?.toString() || null,
        author_name: diary.userdetails?.name || "Unknown",
        author_image: diary.userdetails?.profile_image,
        name: diary.name,
        featured_image_url: diary.featured_image_url,
        created_at: diary.created_at,
        updated_at: diary.updated_at,
        diary_like_count: likesCount,
        diarycontent: {
          content: recentContent?.content,
          page_no: recentContent?.page_no,
          content_image: extractFirstImage(recentContent?.content),
          view_count: recentContent?.view_count?.toString() || "0",
          share_count: recentContent?.share_count?.toString() || "0",
          comment_count: recentContent?._count?.diarycomments || 0,
        }
      };
    });

    await prisma.$disconnect();
    return res.status(200).json({
      status: "success",
      diaries: total_diaries,
      totalDiariesCount,
    });
  } catch (err) {
    console.error(err);
    await prisma.$disconnect();
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

//Frontend
exports.getFeaturedDiaries = async (req, res) => {
  const { take, skip } = req.query;

  try {
    const diaries = await prisma.diaries.findMany({
      where: {
        is_private: false,
        status: "Active",
        is_featured_diary: true,
        diarycontent: {
          some: {
            status: 'Published'
          }
        }
      },
      take: parseInt(take),
      skip: parseInt(skip),
      orderBy: { created_at: "desc" },
      include: {
        userdetails: {
          select: {
            name: true,
            profile_image: true,
          },
        },
        diarycontent: {
          where: {
            status: 'Published'
          },
          select: {
            content: true,
            page_no: true,
            updated_at: true,
            view_count: true,
            share_count: true,
            _count: {
              select: {
                diarycomments: true
              }
            },
            status: true
          },
          orderBy: {
            created_at: 'desc',
          },
          // take: 1,
        },
        diarylike: {
          where: {
            isliked: true
          },
          select: {
            id: true
          }
        }
      },
    });

    const totalDiariesCount = await prisma.diaries.count({
      where: {
        is_private: false,
        status: "Active",
        is_featured_diary: true,
        diarycontent: {
          some: {
            status: 'Published'
          }
        }
      }
    });

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    const diaryDetails = diaries.map((diary) => {
      const likesCount = diary.diarylike ? diary.diarylike.length : 0;
      const recentContent = diary.diarycontent[0];
      const firstPage = diary.diarycontent.find(content => content.page_no === 1);

      return {
        id: diary.id.toString(),
        uuid: diary?.uuid,
        user_id: diary.user_id?.toString() || null,
        author_name: diary.userdetails?.name || "Unknown",
        author_image: diary.userdetails?.profile_image,
        name: diary.name,
        featured_image_url: diary.featured_image_url,
        created_at: diary.created_at,
        updated_at: diary.updated_at,
        diary_like_count: likesCount,
        diarycontent: {
          content: recentContent?.content,
          page_no: recentContent?.page_no,
          content_image: extractFirstImage(recentContent?.content),
          view_count: recentContent?.view_count?.toString() || "0",
          share_count: recentContent?.share_count?.toString() || "0",
          comment_count: recentContent?._count?.diarycomments || 0,
        }
      };
    });

    await prisma.$disconnect();
    return res.status(200).json({
      status: "success",
      diaries: diaryDetails,
      totalDiariesCount,
    });
  } catch (err) {
    console.error(err);
    await prisma.$disconnect();
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

exports.getMyDiaries = async (req, res) => {
  const { user_uid, limit = 4, offset = 0 } = req.query;

  if (!user_uid) {
    return res.status(200).json({
      status: "error",
      message: "user_uid is required",
    });
  }

  try {

    const user = await prisma.users.findFirst({
      where: {
        uuid: user_uid
      },
      select: {
        id: true
      }
    })

    if (!user) {
      return res.status(200).json({
        status: "error",
        message: "user not found"
      })
    }

    const diaries = await prisma.diaries.findMany({
      where: {
        user_id: user?.id,
      },
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { created_at: "desc" },
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
            updated_at: true,
            view_count: true,
            share_count: true,
            _count: {
              select: {
                diarycomments: true
              }
            }
          },
          orderBy: {
            created_at: "desc"
          },
          // take: 1,
        },
        diarylike: {
          where: {
            isliked: true
          },
          select: {
            id: true
          }
        }
      },
    });

    const totalDiariesCount = await prisma.diaries.count({
      where: { user_id: user?.id },
    });

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    const diaryDetails = diaries.map((diary) => {
      const likesCount = diary.diarylike ? diary.diarylike.length : 0
      const recentContent = diary.diarycontent[0];
      const firstPage = diary.diarycontent.find(content => content.page_no === 1);

      return {
        id: diary.id.toString(),
        uuid: diary?.uuid,
        user_id: diary.user_id?.toString() || null,
        author_name: diary.userdetails?.name || "Unknown",
        author_image: diary.userdetails?.profile_image,
        name: diary.name,
        featured_image_url: diary.featured_image_url,
        created_at: diary.created_at,
        updated_at: diary.updated_at,
        diary_type: diary.diary_type,
        diary_like_count: likesCount,
        diarycontent: {
          content: recentContent?.content,
          page_no: recentContent?.page_no,
          content_image: extractFirstImage(recentContent?.content),
          view_count: recentContent?.view_count?.toString() || "0",
          share_count: recentContent?.share_count?.toString() || "0",
          comment_count: recentContent?._count?.diarycomments || 0,
        }
      };
    });

    await prisma.$disconnect();
    return res.status(200).json({
      status: "success",
      diaries: diaryDetails,
      totalDiariesCount,
    });
  } catch (error) {
    console.error("getMyDiaries error:", error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categoriesData = await prisma.diarycategories.findMany({
      select: {
        id: true,
        name: true
      }
    })
    let categories = [];
    if (categoriesData.length > 0) {
      categories = categoriesData.map((cat) => {
        return {
          value: cat.id.toString(),
          label: cat.name
        }
      })
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      categories: categories
    })
  } catch (error) {
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.getSingleDiaryData = async (req, res) => {
  const { diaryUid } = req.query;

  try {
    const diaryData = await prisma.diaries.findFirst({
      where: {
        uuid: diaryUid
      }
    })

    if (!diaryData) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary data not found"
      })
    }

    const diaryDetails = {
      category_id: diaryData.category_id.toString(),
      featuredImageUrl: diaryData.featured_image_url,
      diaryName: diaryData.name,
      isPrivate: diaryData.is_private,
      diaryType: diaryData.diary_type,
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      diaryDetails: diaryDetails
    })
  } catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.addDiary = async (req, res) => {
  const form = new multiparty.Form({
    maxFieldsSize: 100 * 1024 * 1024, // 100MB for form fields
    maxFilesSize: 100 * 1024 * 1024, // Optional: 100MB max file size
  });

  form.parse(req, async (error, fields, files) => {
    if (error) {
      prisma.$disconnect();
      return res.status(500).json({
        status: 'Error',
        message: error.message,
      });
    }

    const selectedCategory = fields.selectedCategory[0];
    const diaryName = fields.diaryName[0];
    const isPrivate = fields.isPrivate[0];
    const user_id = fields.user_id[0];
    const diaryContent = fields.diaryContent[0];
    const diarypage = fields.diarypage[0];
    const diaryType = fields.diaryType[0];
    const isPublishDate = fields.is_publish_date[0];
    // const diaryAccessStatus = fields.diaryAccessStatus[0];

    const isUser = await prisma.users.findFirst({
      where: {
        id: BigInt(user_id)
      }
    })

    if (!isUser) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'User Not Found'
      })
    }

    const featuredImage = files?.featuredImage[0];

    const uuid = "DSD" + Math.floor(100000 + Math.random() * 900000).toString();
    const uploadDir = path.join(__dirname, '../uploads', `${uuid}`);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const tempFeaturedImagePath = featuredImage.path || featuredImage.filepath;
    if (!tempFeaturedImagePath) {
      return res.status(400).json({ status: 'error', message: 'featuredImage file path is missing' });
    }

    const featuredImagePath = path.join(uploadDir, featuredImage.originalFilename);
    fs.copyFileSync(tempFeaturedImagePath, featuredImagePath);
    fs.unlinkSync(tempFeaturedImagePath);

    const featuredImageUrl = `${process.env.API_URL}/uploads/${uuid}/${featuredImage.originalFilename}`;

    // Extract first image from content if exists
    let contentFeaturedImageUrl = null;

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    if (diaryContent) {
      contentFeaturedImageUrl = extractFirstImage(diaryContent);
    }

    try {
      const newDiary = await prisma.diaries.create({
        data: {
          user_id: BigInt(user_id),
          category_id: BigInt(selectedCategory),
          name: diaryName,
          is_private: isPrivate === "true" ? true : false,
          featured_image_url: featuredImageUrl,
          featured_image_path: featuredImagePath,
          uuid: uuid,
          diary_type: diaryType,
          updated_at: new Date()
        },
        include: {
          category_details: {
            select: {
              name: true
            }
          }
        }
      })
      const categoryName = newDiary?.category_details?.name;

      const currentDate = new Date();
      const publishDate = new Date(isPublishDate);

      let status = "Scheduled";
      if (currentDate >= publishDate) {
        status = "Published";
      }

      await prisma.diarypages.create({
        data: {
          diary_id: newDiary?.id,
          page_no: Number(diarypage),
          content: diaryContent,
          is_publish_date: publishDate,
          updated_at: new Date(),
          featured_image: contentFeaturedImageUrl,
          status: status,
        }
      })
      prisma.$disconnect();
      return res.status(200).json({
        status: 'success',
        message: "Diary added successfully",
        diaryid: newDiary?.id.toString(),
        categoryName: categoryName
      })
    } catch (error) {
      console.log(error);
      prisma.$disconnect();
      return res.status(500).json({
        status: 'error',
        message: error.message
      })
    }
  })
}

exports.addPageContent = async (req, res) => {
  const form = new multiparty.Form({
    maxFieldsSize: 100 * 1024 * 1024, // 100MB for form fields
    maxFilesSize: 100 * 1024 * 1024, // Optional: 100MB max file size
  }
  );

  form.parse(req, async (error, fields, files) => {
    if (error) {
      prisma.$disconnect();
      return res.status(500).json({
        status: 'Error',
        message: error.message,
      });
    }

    const diaryid = fields.diaryid[0];
    const diaryContent = fields.diaryContent[0];
    const diarypage = fields.diarypage[0];
    const useruid = fields.useruid[0];
    const isPublishDate = fields.is_publish_date[0];
    // const diaryAccessStatus = fields.diaryAccessStatus[0];

    const user = await prisma.users.findFirst({
      where: {
        uuid: useruid
      },
      select: {
        id: true,
        name: true
      }
    })

    const isDiary = await prisma.diaries.findFirst({
      where: {
        id: BigInt(diaryid)
      },
      include: {
        userdetails: {
          select: {
            id: true,
            name: true
          }
        },
        Followeddiaries: {
          where: {
            status: "followed"
          },
          select: {
            user_id: true
          }
        },
        diaryinvitation: {
          where: {
            status: "Accepted"
          },
          select: {
            receiver_id: true,
            type: true
          }
        },
        SubscriptionDiaries: {
          where: {
            status: "Active"
          },
          select: {
            user_id: true
          }
        }
      }
    })

    if (!isDiary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Diary Not Found'
      })
    }

    // Extract first image from content if exists
    let contentFeaturedImageUrl = null;
    // const base64ImageRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^">]+)"/;
    // const match = diaryContent?.match(base64ImageRegex);

    // const uploadDir = path.join(__dirname, '../uploads', `${isDiary?.uuid}`);
    // if (!fs.existsSync(uploadDir)) {
    //   fs.mkdirSync(uploadDir, { recursive: true });
    // }

    // if (match) {
    //   const imageType = match[1];
    //   const base64Data = match[2];
    //   const imageBuffer = Buffer.from(base64Data, 'base64');
    //   const timestamp = Date.now();

    //   const imageName = `content-featured-image-${diarypage}-${timestamp}.${imageType}`;
    //   const imagePath = path.join(uploadDir, imageName);

    //   try {
    //     fs.writeFileSync(imagePath, imageBuffer);
    //     contentFeaturedImageUrl = `${process.env.API_URL}/uploads/${isDiary?.uuid}/${imageName}`;
    //   } catch (err) {
    //     console.error('Error saving content featured image:', err);
    //   }
    // }

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    if (diaryContent) {
      contentFeaturedImageUrl = extractFirstImage(diaryContent);
    }

    try {
      const currentDate = new Date();
      const publishDate = new Date(isPublishDate);

      let status = "Scheduled";
      if (currentDate >= publishDate) {
        status = "Published";
      }

      // const finalStatus = BigInt(user.id) === BigInt(isDiary.user_id) ? status : "Pending";
      const finalStatus = (user.id === isDiary?.user_id || (isDiary?.diary_type === "Group")) ? status : "Pending";

      const diary_page = await prisma.diarypages.create({
        data: {
          diary_id: BigInt(diaryid),
          page_no: (user.id === isDiary?.user_id || (isDiary?.diary_type === "Group")) ? Number(diarypage) : null,
          content: diaryContent,
          is_publish_date: new Date(isPublishDate),
          updated_at: new Date(),
          featured_image: contentFeaturedImageUrl,
          // diary_access_status: diaryAccessStatus
          status: finalStatus,
          added_by: user.id,
        }
      })

      // update the diary updated_at field
      await prisma.diaries.update({
        where: {
          id: BigInt(diaryid)
        },
        data: {
          updated_at: new Date(),
        }
      })

      const diary_followed_users = isDiary?.Followeddiaries || []
      const diary_invitations = isDiary?.diaryinvitation || []
      const group_diary_members = diary_invitations.filter(invite => invite.type === 'Group')
      const private_diary_members = diary_invitations.filter(invite => invite.type === "Private")
      const subscription_diary_members = isDiary?.SubscriptionDiaries || []

      // send the notification to the followed users only if the diary is public 
      if (!isDiary?.is_private) {
        if (diary_followed_users.length > 0) {
          const notificationPromises = diary_followed_users.map(follower => {
            return prisma.usernotification.create({
              data: {
                user_id: follower.user_id,
                // message: `The diary "${isDiary?.name}" you followed has been updated with new content by ${isDiary?.userdetails.name}`,
                message: `The new page is added by ${isDiary?.userdetails.name} in the diary "${isDiary?.name}" you followed`,
                type: 'diary_page_add',
                added_by: isDiary?.userdetails?.id,
                link: `${process.env.MAIN_URL}/diarydetails/${isDiary?.uuid}/${diary_page?.page_no}`
              }
            });
          });

          await Promise.all(notificationPromises);
        }
      }

      if (isDiary?.diary_type === "Group") {
        // send the notification to the group members
        if (group_diary_members.length > 0) {
          const groupnotificationPromises = group_diary_members
            .filter(group => group.receiver_id !== user.id)
            .map(group => {
              return prisma.usernotification.create({
                data: {
                  user_id: group.receiver_id,
                  message: `The new page is added by ${user.name} in the diary "${isDiary?.name}".`,
                  type: 'diary_page_add',
                  added_by: user.id,
                  // link: `${process.env.MAIN_URL}/diarydetails/${isDiary?.uuid}/${diary_page?.page_no}`
                  link: `${process.env.MAIN_URL}/myaccount/diary/${isDiary.name}?uid=${isDiary?.uuid}&page_no=${diary_page?.page_no}`
                }
              });
            });
          await Promise.all(groupnotificationPromises);
        }

        // dont send the notification if the page is added by diary author else any group member is added the page then send notification to the author
        if (user?.id !== isDiary?.userdetails?.id)
          await prisma.usernotification.create({
            data: {
              user_id: isDiary?.userdetails?.id,
              message: `The new page is added by ${user.name} in the diary "${isDiary?.name}".`,
              type: 'diary_page_add',
              added_by: user.id,
              link: `${process.env.MAIN_URL}/myaccount/diary/${isDiary.name}?uid=${isDiary?.uuid}&page_no=${diary_page?.page_no}`
            }
          });
      }

      // for private diary invitation members
      if (isDiary?.diary_type === "Individual" && isDiary?.is_private) {
        if (private_diary_members.length > 0) {
          const privatediarynotificationPromises = private_diary_members
            .map(private => {
              return prisma.usernotification.create({
                data: {
                  user_id: private.receiver_id,
                  message: `The new page is added by ${user.name} in the diary "${isDiary?.name}".`,
                  type: 'diary_page_add',
                  added_by: user.id,
                  link: `${process.env.MAIN_URL}/diarydetails/${isDiary?.uuid}/${diary_page?.page_no}`
                }
              });
            });
          await Promise.all(privatediarynotificationPromises);
        }
      }

      // for Subscription diary menbers
      if (isDiary?.diary_type === "Subscription") {
        if (subscription_diary_members.length > 0) {
          const subscriptiondiarynotificationPromises = subscription_diary_members
            .map(subscr => {
              return prisma.usernotification.create({
                data: {
                  user_id: subscr.user_id,
                  message: `The new page is added by ${user.name} in the diary "${isDiary?.name}".`,
                  type: 'diary_page_add',
                  added_by: user.id,
                  link: `${process.env.MAIN_URL}/diarydetails/${isDiary?.uuid}/${diary_page?.page_no}`
                }
              });
            });
          await Promise.all(subscriptiondiarynotificationPromises);
        }
      }

      if ((user.id !== isDiary?.user_id) && isDiary?.diary_type === "Individual") {
        await prisma.usernotification.create({
          data: {
            user_id: isDiary?.user_id,
            message: `You have recived a new contribution request by ${user.name} in the diary ${isDiary?.name}.`,
            type: 'contributions',
            added_by: user.id,
            link: `${process.env.MAIN_URL}/myaccount/contribution-requests`

          }
        });
      }

      prisma.$disconnect();
      return res.status(200).json({
        status: 'success',
        message: "Diary page added successfully",
      })
    } catch (error) {
      console.log(error);
      prisma.$disconnect();
      return res.status(500).json({
        status: 'error',
        message: error.message
      })
    }
  })
}

exports.editDiary = async (req, res) => {
  const form = new multiparty.Form({
    maxFieldsSize: 100 * 1024 * 1024, // 100MB for form fields
    maxFilesSize: 100 * 1024 * 1024, // Optional: 100MB max file size
  });

  form.parse(req, async (error, fields, files) => {
    if (error) {
      prisma.$disconnect();
      return res.status(500).json({
        status: 'Error',
        message: error.message,
      });
    }


    const selectedCategory = fields.selectedCategory[0];
    const diaryName = fields.diaryName[0];
    const isPrivate = fields.isPrivate[0];
    const user_id = fields.user_id[0];
    const diaryUid = fields.diaryUid[0];
    const mainfeaturedImageUrl = fields.featuredImageUrl[0];
    // const diaryType = fields.diaryType[0];

    const isUser = await prisma.users.findFirst({
      where: {
        id: BigInt(user_id)
      }
    });
    if (!isUser) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'User Not Found'
      });
    };

    const isDiary = await prisma.diaries.findFirst({
      where: {
        uuid: diaryUid
      },
      select: {
        featured_image_path: true,
        featured_image_url: true,
      }
    });
    if (!isDiary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Diary Not Found'
      });
    };



    let featuredImagePath = isDiary?.featured_image_path;
    let featuredImageUrl = isDiary?.featured_image_url;
    if (mainfeaturedImageUrl !== isDiary.featured_image_url) {
      if (isDiary?.featured_image_path) {
        fs.unlink(featuredImagePath, (err) => {
          if (err) {
            console.error('Error deleting image:', err);
          }
        });
      }
      const featuredImage = files.featuredImage[0];
      const uuid = diaryUid;
      const uploadDir = path.join(__dirname, '../uploads', `${uuid}`);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const tempFeaturedImagePath = featuredImage.path || featuredImage.filepath;
      if (!tempFeaturedImagePath) {
        return res.status(400).json({ status: 'error', message: 'featuredImage file path is missing' });
      }

      featuredImagePath = path.join(uploadDir, featuredImage.originalFilename);
      fs.copyFileSync(tempFeaturedImagePath, featuredImagePath);
      fs.unlinkSync(tempFeaturedImagePath);

      featuredImageUrl = `${process.env.API_URL}/uploads/${uuid}/${featuredImage.originalFilename}`;
    }
    deleteEmptyFolders();
    try {
      await prisma.diaries.update({
        where: {
          uuid: diaryUid
        },
        data: {
          category_id: BigInt(selectedCategory),
          name: diaryName,
          is_private: isPrivate === "true" ? true : false,
          featured_image_url: featuredImageUrl,
          featured_image_path: featuredImagePath,
          // diary_type: diaryType,
          updated_at: new Date(),
        }
      })
      // update the diary updated_at field
      await prisma.diaries.update({
        where: {
          uuid: diaryUid
        },
        data: {
          updated_at: new Date(),
        }
      })

      prisma.$disconnect();
      return res.status(200).json({
        status: 'success',
        message: "Diary added successfully"
      })
    } catch (error) {
      console.log(error);
      prisma.$disconnect();
      return res.status(500).json({
        status: 'error',
        message: error.message
      })
    }
  })
}

exports.deleteDiary = async (req, res) => {
  const { diary_uid } = req.body;
  try {
    // get diary id from diary uid
    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diary_uid
      },
      select: {
        id: true,
        featured_image_path: true
      }
    })

    if (!diary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary not found"
      })
    }

    const comments = await prisma.diarycomments.findMany({
      where: { diary_id: diary.id },
      select: { id: true }
    });

    const commentIds = comments.map(comment => comment.id);

    if (commentIds.length > 0) {
      await prisma.commentLike.deleteMany({
        where: {
          comment_id: {
            in: commentIds
          }
        }
      });
    }

    await prisma.diarycomments.deleteMany({
      where: {
        diary_id: diary?.id
      }
    })

    await prisma.diarypages.deleteMany({
      where: {
        diary_id: diary?.id
      }
    })

    await prisma.diaryinvitations.deleteMany({
      where: {
        diary_id: diary?.id
      }
    })

    await prisma.sharediariesbylink.deleteMany({
      where: {
        diary_id: diary?.id
      }
    })

    await prisma.diaries.delete({
      where: {
        id: diary?.id
      }
    })

    // delete the image from the server
    if (diary?.featured_image_path) {
      fs.unlink(diary?.featured_image_path, (err) => {
        if (err) {
          console.error('Error deleting image:', err);
        }
      });
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: "Diary deleted successfully"
    })
  } catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    })
  }
}

exports.getSingleViewDairyData = async (req, res) => {
  const { uid, user_uid, diary_access_token, senderUid, } = req.query;

  try {

    if (!user_uid) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'access_denied',
        error: 'user_uid_is_required',
        message: "User uid is requird to access this diary"
      })
    }
    // get user id from user uid
    const user = await prisma.users.findFirst({
      where: {
        uuid: user_uid
      },
      select: {
        id: true
      }
    })

    if (!user) {
      prisma.$disconnect();
      return res.status(200).json({
        error: 'error',
        message: "User not found"
      })
    }

    const diaryData = await prisma.diaries.findFirst({
      where: {
        uuid: uid
      },
      select: {
        id: true,
        name: true,
        user_id: true,
        created_at: true,
        is_private: true,
        userdetails: true,
        status: true,
        diary_type: true,
      }
    })

    if (!diaryData) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary not found"
      })
    }

    // check the diary user_id is same as the user id or not
    if (diaryData?.user_id === user.id) {
      const dairyid = diaryData.id.toString();
      const totaldiaryPagesCount = await prisma.diarypages.count({
        where: {
          diary_id: parseInt(dairyid)
        }
      })

      let dairyPageContent = null;
      let dairypage = null;
      let diary_page_status;
      let pageviewscount;
      let pagesharecount;
      // let diaryPageAccessStatus = null;
      if (totaldiaryPagesCount > 0) {
        const pageno = 1;
        const dairyPages = await prisma.diarypages.findFirst({
          where: {
            diary_id: dairyid,
            page_no: pageno,
          },
          select: {
            content: true,
            added_by: true,
            status: true,
            added_by_details: {
              select: {
                name: true
              }
            },
            view_count: true,
            share_count: true
            // diary_access_status: true,
          }
        })
        dairyPageContent = dairyPages.content;
        dairypage = dairyPages;
        diary_page_status = dairyPages?.status
        // diaryPageAccessStatus = dairyPages.diary_access_status;
        pageviewscount = dairyPages?.view_count?.toString() || 0;
        pagesharecount = dairyPages?.share_count?.toString() || 0;
      }

      const diaryPageDetails = {
        id: diaryData.id.toString(),
        name: diaryData.name,
        created_at: diaryData.created_at,
        content: dairyPageContent,
        // diary_page_access_status: diaryPageAccessStatus,
        status: diaryData.is_private ? "Private" : "Public",
        diary_status: diaryData.status,
        diary_type: diaryData.diary_type,
        diary_page_status: diary_page_status,
        pageviewscount: pageviewscount,
        pagesharecount: pagesharecount,
        author_details: {
          author_uid: diaryData?.userdetails?.uuid || null,
          author_id: diaryData?.userdetails?.id.toString() || null,
          name: diaryData.userdetails?.name || "Unknown",
          profile_image: diaryData.userdetails?.profile_image || null,
        },
        added_by: dairypage?.added_by !== diaryData?.user_id ? dairypage?.added_by_details?.name : ''
      }

      prisma.$disconnect();
      return res.status(200).json({
        status: 'success',
        diaryPageDetails: diaryPageDetails,
        totaldiaryPagesCount: totaldiaryPagesCount,
      })
    } else {
      if (!user_uid) {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'access_denied',
          error: 'user_uid_is_required',
          message: "User uid is requird to access this diary"
        })
      }

      const user = await prisma.users.findFirst({
        where: {
          uuid: user_uid
        },
        select: {
          id: true
        }
      })

      if (!user) {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'access_denied',
          error: 'user_not_found',
          message: "User not found"
        })
      }

      if (diary_access_token) {
        const isValidToken = await prisma.sharediariesbylink.findFirst({
          where: {
            diary_id: diaryData?.id,
            access_token: diary_access_token,
          }
        })
        if (!isValidToken) {
          prisma.$disconnect();
          return res.status(200).json({
            status: 'access_denied',
            error: 'invalid_token',
            message: "You dont have access to this diary"
          })
        } else {
          let is_invited = await prisma.diaryinvitations.findMany({
            where: {
              diary_id: diaryData?.id,
              receiver_id: user.id,
            },
            select: {
              status: true
            }
          })

          if (is_invited.length > 0) {
            is_invited = is_invited[is_invited.length - 1];
          } else {
            is_invited = null;
          }

          if (!is_invited) {
            const sender = await prisma.users.findFirst({
              where: {
                uuid: senderUid
              },
              select: {
                id: true
              }
            })

            if (!sender) {
              return res.json({
                status: "error",
                message: "sender user id not found"
              })
            }

            const uuid = "DIARYINVTG" + Math.floor(100000 + Math.random() * 900000);
            await prisma.diaryinvitations.create({
              data: {
                uuid: uuid,
                sender_id: sender?.id,
                diary_id: diaryData?.id,
                receiver_id: user?.id,
                status: "Pending",
                type: "Group"
              }
            })

            prisma.$disconnect();
            return res.status(200).json({
              status: 'access_denied',
              error: 'diary_invitation_pending',
              message: "You dont have access to this diary"
            })
          } else if (is_invited.status === "Pending") {
            prisma.$disconnect();
            return res.status(200).json({
              status: 'access_denied',
              error: 'diary_invitation_pending',
              message: "You dont have access to this diary"
            })
          } else if (is_invited.status === "Rejected") {
            prisma.$disconnect();
            return res.status(200).json({
              status: 'access_denied',
              error: 'diary_invitation_rejected',
              message: "You dont have access to this diary"
            })
          }
        }
      }

      let isInvited = await prisma.diaryinvitations.findMany({
        where: {
          diary_id: diaryData?.id,
          receiver_id: user.id,
        },
        select: {
          status: true
        }
      })

      // i need latest invitation data
      if (isInvited.length > 0) {
        isInvited = isInvited[isInvited.length - 1];
      } else {
        isInvited = null;
      }

      if (!isInvited) {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'access_denied',
          error: 'access_denied',
          message: "You dont have access to this diary"
        })
      } else if (isInvited.status === "Pending") {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'access_denied',
          error: 'diary_invitation_pending',
          message: "You dont have access to this diary"
        })
      } else if (isInvited.status === "Rejected") {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'access_denied',
          error: 'diary_invitation_rejected',
          message: "You dont have access to this diary"
        })
      }

      const dairyid = diaryData.id.toString();

      //total pages count
      const totaldiaryPagesCount = await prisma.diarypages.count({
        where: {
          diary_id: parseInt(dairyid)
        }
      })

      let dairyPageContent = null;
      let dairypage = null;
      // let diaryPageAccessStatus = null;
      let diary_page_status;
      let pageviewscount;
      let pagesharecount;
      if (totaldiaryPagesCount > 0) {
        const pageno = 1;
        const dairyPages = await prisma.diarypages.findFirst({
          where: {
            diary_id: dairyid,
            page_no: pageno,
          },
          select: {
            content: true,
            added_by: true,
            added_by_details: {
              select: {
                name: true
              }
            },
            status: true,
            view_count: true,
            share_count: true
            // diary_access_status: true,
          }
        })
        dairyPageContent = dairyPages.content;
        dairypage = dairyPages;
        diary_page_status = dairyPages?.status
        // diaryPageAccessStatus = dairyPages.diary_access_status;        
        pageviewscount = dairyPages?.view_count?.toString() || 0;
        pagesharecount = dairyPages?.share_count?.toString() || 0;
      }

      const diaryPageDetails = {
        id: diaryData.id.toString(),
        name: diaryData.name,
        created_at: diaryData.created_at,
        content: dairyPageContent,
        // diary_page_access_status: diaryPageAccessStatus,
        status: diaryData.is_private ? "Private" : "Public",
        diary_status: diaryData.status,
        diary_page_status: diary_page_status,
        diary_type: diaryData.diary_type,
        pageviewscount: pageviewscount,
        pagesharecount: pagesharecount,
        author_details: {
          author_uid: diaryData?.userdetails?.uuid || null,
          author_id: diaryData?.userdetails?.id.toString() || null,
          name: diaryData.userdetails?.name || "Unknown",
          profile_image: diaryData.userdetails?.profile_image || null,
        },
        added_by: dairypage?.added_by !== diaryData?.user_id ? dairypage?.added_by_details?.name : ''
      }

      prisma.$disconnect();
      return res.status(200).json({
        status: 'success',
        diaryPageDetails: diaryPageDetails,
        totaldiaryPagesCount: totaldiaryPagesCount,
      })
    }
  }
  catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.getSingleDairyData = async (req, res) => {
  const { uid, user_uid, diary_access_token, senderUid, page_no, pageviewcount, unregistered_token } = req.query;

  try {

    const diaryData = await prisma.diaries.findFirst({
      where: {
        uuid: uid
      },
      include: {
        userdetails: {
          select: {
            id: true,
            name: true,
            profile_image: true
          }
        },
        Followeddiaries: {
          where: {
            userdetails: {
              uuid: user_uid
            }
          },
          select: {
            id: true,
            diary_id: true,
            user_id: true,
            status: true
          }
        },
        _count: {
          select: {
            diarylike: {
              where: {
                isliked: true
              }
            }
          }
        },
        diarylike: {
          where: {
            userdetails: {
              uuid: user_uid
            }
          },
          select: {
            isliked: true
          }
        },
      }
    })

    if (!diaryData) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary not found"
      })
    }

    if (diaryData?.is_private) {

      if (!user_uid) {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'access_denied',
          error: 'user_uid_is_required',
          message: "User uid is requird to access this diary"
        })
      }

      const user = await prisma.users.findFirst({
        where: {
          uuid: user_uid
        },
        select: {
          id: true
        }
      })

      if (!user) {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'access_denied',
          error: 'user_not_found',
          message: "User not found"
        })
      }

      // skipping the condition the diary author visits the diary page
      if (diaryData?.userdetails?.id !== user?.id) {

        if (diary_access_token) {
          const isValidToken = await prisma.sharediariesbylink.findFirst({
            where: {
              diary_id: diaryData?.id,
              access_token: diary_access_token,
            }
          })
          if (!isValidToken) {
            prisma.$disconnect();
            return res.status(200).json({
              status: 'access_denied',
              error: 'invalid_token',
              message: "You dont have access to this diary"
            })
          } else {
            let is_invited = await prisma.diaryinvitations.findMany({
              where: {
                diary_id: diaryData?.id,
                receiver_id: user.id,
              },
              select: {
                status: true
              }
            })

            if (is_invited.length > 0) {
              is_invited = is_invited[is_invited.length - 1];
            } else {
              is_invited = null;
            }

            if (!is_invited) {

              const sender = await prisma.users.findFirst({
                where: {
                  uuid: senderUid
                },
                select: {
                  id: true
                }
              })

              if (!sender) {
                return res.json({
                  status: "error",
                  message: "sender user id not found"
                })
              }

              const uuid = "DIARYINV" + Math.floor(100000 + Math.random() * 900000);
              await prisma.diaryinvitations.create({
                data: {
                  uuid: uuid,
                  sender_id: sender?.id,
                  diary_id: diaryData?.id,
                  receiver_id: user?.id,
                  status: "Pending"
                }
              })

              prisma.$disconnect();
              return res.status(200).json({
                status: 'access_denied',
                error: 'diary_invitation_pending',
                message: "You dont have access to this diary"
              })
            } else if (is_invited.status === "Pending") {
              prisma.$disconnect();
              return res.status(200).json({
                status: 'access_denied',
                error: 'diary_invitation_pending',
                message: "You dont have access to this diary"
              })
            } else if (is_invited.status === "Rejected") {
              prisma.$disconnect();
              return res.status(200).json({
                status: 'access_denied',
                error: 'diary_invitation_rejected',
                message: "You dont have access to this diary"
              })
            }
          }
        }

        let isInvited = await prisma.diaryinvitations.findMany({
          where: {
            diary_id: diaryData?.id,
            receiver_id: user.id,
            // status: "Accepted"
          },
          select: {
            status: true
          }
        })

        if (isInvited.length > 0) {
          isInvited = isInvited[isInvited.length - 1];
        } else {
          isInvited = null;
        }

        if (!isInvited) {
          prisma.$disconnect();
          return res.status(200).json({
            status: 'access_denied',
            error: 'access_denied',
            message: "You dont have access to this diary"
          })
        } else if (isInvited.status === "Pending") {
          prisma.$disconnect();
          return res.status(200).json({
            status: 'access_denied',
            error: 'diary_invitation_pending',
            message: "You dont have access to this diary"
          })
        } else if (isInvited.status === "Rejected") {
          prisma.$disconnect();
          return res.status(200).json({
            status: 'access_denied',
            error: 'diary_invitation_rejected',
            message: "You dont have access to this diary"
          })
        }
      }
    }

    if (diaryData?.diary_type === "Subscription" && page_no !== "1") {
      if (!user_uid) {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'access_denied',
          error: 'user_uid_is_required',
          message: "User uid is requird to access this diary"
        })
      }

      const user = await prisma.users.findFirst({
        where: {
          uuid: user_uid
        },
        select: {
          id: true
        }
      })

      if (!user) {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'access_denied',
          error: 'user_not_found',
          message: "User not found"
        })
      }

      // skipping the condition the diary author visits the diary page
      if (diaryData?.userdetails?.id !== user?.id) {

        const checkPageExists = await prisma.diarypages.findFirst({
          where: {
            diary_id: parseInt(diaryData.id),
            page_no: parseInt(page_no)
          }
        })
        if (!checkPageExists) {
          prisma.$disconnect();
          return res.status(200).json({
            status: 'error',
            message: "Diary page not found"
          })
        }

        if (pageviewcount) {
          await prisma.diarypages.update({
            where: {
              id: checkPageExists.id
            },
            data: {
              view_count: parseInt(checkPageExists?.view_count) + 1
            }
          })
        }

        const dairyPages = await prisma.diarypages.findFirst({
          where: {
            diary_id: parseInt(diaryData.id),
            page_no: parseInt(page_no) || 1,
          },
          include: {
            Siglediarypagelikes: {
              where: {
                userdetails: {
                  uuid: user_uid
                }
              },
              select: {
                isliked: true
              }
            },
            _count: {
              select: {
                Siglediarypagelikes: {
                  where: {
                    isliked: true
                  }
                }
              }
            },
            added_by_details: {
              select: {
                name: true
              }
            }
          }
        })

        // check the user has access to the subscription diary
        const isSubscriptionAccess = await prisma.subscriptiondiaries.findFirst({
          where: {
            user_id: user.id,
            diary_id: diaryData.id,
            status: "Active"
          }
        })

        if (!isSubscriptionAccess) {
          const diaryPageDetails = {
            id: diaryData.id.toString(),
            name: diaryData.name,
            created_at: diaryData.created_at,
            content: null,
            diary_type: diaryData?.diary_type,
            status: diaryData.is_private ? "Private" : "Public",
            featured_image_url: diaryData.featured_image_url,
            is_followed_diary: diaryData?.Followeddiaries[0]?.status,
            pagelikesCount: dairyPages?._count.Siglediarypagelikes,
            isuserlikedPage: dairyPages?.Siglediarypagelikes[0]?.isliked,
            pageviewscount: dairyPages?.view_count?.toString() || 0,
            pagesharecount: dairyPages?.share_count?.toString() || 0,
            diarylikecount: diaryData?._count?.diarylike,
            isuserlikeddiary: diaryData?.diarylike[0]?.isliked || false,
            author_details: {
              author_id: diaryData?.userdetails?.id.toString() || null,
              name: diaryData.userdetails?.name || "Unknown",
              profile_image: diaryData.userdetails?.profile_image || null,
            },
            diary_subscription_status: "diary_not_subscribed",
            added_by: dairyPages?.added_by !== diaryData?.user_id ? dairyPages?.added_by_details?.name : ''
          }
          prisma.$disconnect();
          return res.status(200).json({
            status: 'success',
            diaryPageDetails: diaryPageDetails,
          })
        }
      }
    }

    const dairyid = diaryData.id.toString();
    const totaldiaryPagesCount = await prisma.diarypages.count({
      where: {
        diary_id: parseInt(dairyid),
        NOT: {
          page_no: null
        },
        status: "Published"
      }
    })

    let dairyPageContent = null;
    let diarypage_featured_image = null;
    let pagelikesCount = null;
    let userlikedPage = false;
    let pageviewscount = null;
    let diaryPage = null;
    let pagesharecount = 0
    if (totaldiaryPagesCount > 0) {
      // const pageno = 1;
      const pageNo = parseInt(page_no) || 1;
      const checkPageExists = await prisma.diarypages.findFirst({
        where: {
          diary_id: parseInt(dairyid),
          page_no: pageNo
        }
      })
      if (!checkPageExists) {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'error',
          message: "Diary page not found"
        })
      }

      if (pageviewcount) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (user_uid) {
          const user = await prisma.users.findFirst({
            where: {
              uuid: user_uid
            },
            select: {
              id: true
            }
          })

          if (user?.id) {
            // first check whetheter 
            const existingview = await prisma.diarypageviews.findFirst({
              where: {
                single_page_id: checkPageExists?.id,
                user_id: user?.id,
                last_view_date: {
                  // lte: today
                  gte: today
                }
              }
            })

            if (!existingview) {
              // increase the page view count
              await prisma.diarypages.update({
                where: {
                  id: checkPageExists.id
                },
                data: {
                  view_count: { increment: 1 }
                }
              })
              await prisma.diarypageviews.create({
                data: {
                  diary_id: diaryData?.id,
                  single_page_id: checkPageExists?.id,
                  user_id: user?.id,
                  user_type: "user",
                  last_view_date: new Date()
                }
              })
            }
          }
        } else if (IP_ADDRESS) {
          const existingview = await prisma.diarypageviews.findFirst({
            where: {
              single_page_id: checkPageExists?.id,
              session_token: IP_ADDRESS,
              last_view_date: {
                gte: today
              }
            }
          })

          if (!existingview) {
            // increase the page view count
            await prisma.diarypages.update({
              where: {
                id: checkPageExists.id
              },
              data: {
                view_count: { increment: 1 }
              }
            })
            await prisma.diarypageviews.create({
              data: {
                diary_id: diaryData?.id,
                single_page_id: checkPageExists?.id,
                session_token: IP_ADDRESS,
                user_type: "guest",
                last_view_date: new Date()
              }
            })
          }
        }
      }

      const dairyPages = await prisma.diarypages.findFirst({
        where: {
          diary_id: dairyid,
          page_no: parseInt(page_no) || 1,
          status: "Published"
        },
        include: {
          Siglediarypagelikes: {
            where: {
              userdetails: {
                uuid: user_uid
              }
            },
            select: {
              isliked: true
            }
          },
          _count: {
            select: {
              Siglediarypagelikes: {
                where: {
                  isliked: true
                }
              }
            }
          },
          added_by_details: {
            select: {
              name: true
            }
          }
        }
      })

      dairyPageContent = dairyPages?.content;
      diarypage_featured_image = dairyPages?.featured_image
      pagelikesCount = dairyPages?._count.Siglediarypagelikes
      userlikedPage = dairyPages?.Siglediarypagelikes[0]?.isliked
      pageviewscount = dairyPages?.view_count?.toString() || 0;
      pagesharecount = dairyPages?.share_count?.toString() || 0;
      diaryPage = dairyPages;
    }

    const diaryPageDetails = {
      id: diaryData.id.toString(),
      name: diaryData.name,
      created_at: diaryData.created_at,
      content: dairyPageContent,
      diarypage_featured_image: diarypage_featured_image,
      status: diaryData.is_private ? "Private" : "Public",
      featured_image_url: diaryData.featured_image_url,
      is_followed_diary: diaryData?.Followeddiaries[0]?.status,
      pagelikesCount: pagelikesCount,
      isuserlikedPage: userlikedPage,
      pageviewscount: pageviewscount,
      pagesharecount: pagesharecount,
      diarylikecount: diaryData?._count?.diarylike,
      isuserlikeddiary: diaryData?.diarylike[0]?.isliked || false,
      diary_type: diaryData?.diary_type,
      author_details: {
        author_id: diaryData?.userdetails?.id.toString() || null,
        name: diaryData.userdetails?.name || "Unknown",
        profile_image: diaryData.userdetails?.profile_image || null,
      },
      added_by: diaryPage?.added_by !== diaryData?.user_id ? diaryPage?.added_by_details?.name : ''
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      diaryPageDetails: diaryPageDetails,
      totaldiaryPagesCount: totaldiaryPagesCount,
    })
  }
  catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.getDiaryPages = async (req, res) => {
  const { diary_uid, page_no } = req.query;
  try {
    const parsedPageNo = parseInt(page_no);
    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diary_uid
      },
      select: {
        id: true,
        user_id: true
      }
    })

    const diray_id = diary?.id;

    let diaryPage;
    if (page_no) {
      diaryPage = await prisma.diarypages.findFirst({
        where: {
          diary_id: diray_id,
          page_no: parsedPageNo
        },
        include: {
          added_by_details: {
            select: {
              name: true
            }
          }
        }
      });
      if (!diaryPage) {
        prisma.$disconnect();
        return res.status(200).json({
          status: 'error',
          message: "Diary page not found"
        });
      }
    }

    prisma.$disconnect();

    return res.status(200).json({
      status: 'success',
      content: diaryPage?.content,
      // diary_page_access_status: diaryPage?.diary_access_status,
      added_by: diaryPage.added_by !== diary.user_id ? diaryPage?.added_by_details?.name : ''
    });

  } catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.postComment = async (req, res) => {
  const { commentText, diary_id, user_id } = req.body;
  try {
    const diary = await prisma.diaries.findFirst({
      where: {
        id: BigInt(diary_id)
      },
      include: {
        userdetails: {
          select: {
            id: true
          }
        }
      }
    })

    if (!diary) {
      await prisma.$disconnect()
      return res.status(200).json({
        status: "error",
        message: "Diary is not found"
      })
    }

    const user = await prisma.users.findFirst({
      where: {
        id: BigInt(user_id)
      },
      select: {
        name: true
      }
    })

    if (!user) {
      prisma.$disconnect()
      return res.status(200).json({
        status: "error",
        message: "user not found"
      })
    }

    await prisma.diarycomments.create(
      {
        data: {
          comment: commentText,
          diary_id: diary_id,
          user_id: user_id,
          updated_at: new Date(),
        }
      }
    );

    await prisma.usernotification.create({
      data: {
        user_id: diary?.userdetails?.id,
        message: `${user.name} is Commented on your diry ${diary?.name}`,
        type: 'Comment',
        added_by: BigInt(user_id),
        link: `${process.env.MAIN_URL}/diarydetails/${diary?.uuid}/`
      }
    })

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'Commentted  successfully',
    });
  } catch (error) {
    console.error(error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

exports.postCommentonDiary = async (req, res) => {
  const { commentText, diary_id, user_id, diarypage_no } = req.body;
  try {

    const diary = await prisma.diaries.findFirst({
      where: {
        id: BigInt(diary_id)
      },
      include: {
        userdetails: {
          select: {
            id: true
          }
        }
      }
    })

    if (!diary) {
      await prisma.$disconnect()
      return res.status(200).json({
        status: "error",
        message: "Diary is not found"
      })
    }

    const diarypages = await prisma.diarypages.findFirst({
      where: {
        diary_id: diary.id,
        page_no: parseInt(diarypage_no)
      },
      select: { id: true }
    })

    if (!diarypages) {
      return res.status(200).json({
        status: 'error',
        message: 'diary page not found'
      })
    }

    const singlepageid = diarypages.id

    const user = await prisma.users.findFirst({
      where: {
        id: BigInt(user_id)
      },
      select: {
        name: true
      }
    })

    if (!user) {
      prisma.$disconnect()
      return res.status(200).json({
        status: "error",
        message: "user not found"
      })
    }

    const newPostcomment = await prisma.diarycomments.create(
      {
        data: {
          comment: commentText,
          diary_id: diary_id,
          user_id: user_id,
          single_page_id: singlepageid,
          updated_at: new Date(),
        }
      }
    );

    // send response to client
    const newComment = await prisma.diarycomments.findFirst({
      where: {
        id: newPostcomment.id,
        single_page_id: singlepageid,
      },
      include: {
        commentLikes: true,
        user: {
          select: {
            name: true,
            profile_image: true,
          }
        }
      }
    })
    const formattedComment = {
      id: newComment.id.toString(),
      diary_id: newComment.diary_id.toString(),
      user_id: newComment.user_id.toString(),
      comment: newComment.comment,
      created_at: newPostcomment.created_at,
      updated_at: newPostcomment.updated_at,
      user_name: newComment.user.name,
      user_image: newComment.user.profile_image,
      commentLikes: newComment.commentLikes,
      likeCount: newComment.commentLikes.length,
      replies: []
    };

    await prisma.usernotification.create({
      data: {
        user_id: diary?.userdetails?.id,
        message: `${user.name} is Commented on your diry ${diary?.name}`,
        type: 'Comment',
        added_by: BigInt(user_id),
        // link: `${process.env.MAIN_URL}/diarydetails/${diary?.uuid}`
        link: `${process.env.MAIN_URL}/myaccount/diary/${diary.name}?uid=${diary?.uuid}&page_no=${diarypage_no}`
      }
    })

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'Commentted  successfully',
      comment: formattedComment
    });
  } catch (error) {
    console.error(error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

exports.postReplyCommentonDiary = async (req, res) => {
  const { commentText, diary_id, user_id, parent_comment_id, diarypage_no } = req.body;
  try {
    const user = await prisma.users.findFirst({
      where: {
        id: BigInt(user_id)
      },
      select: {
        name: true
      }
    })

    if (!user) {
      prisma.$disconnect()
      return res.status(200).json({
        status: "error",
        message: "user not found"
      })
    }

    const diary = await prisma.diaries.findFirst({
      where: {
        id: BigInt(diary_id)
      },
      include: {
        userdetails: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!diary) {
      prisma.$disconnect()
      return res.status(200).json({
        status: "error",
        message: "Diary is not found"
      })
    }

    const diarypages = await prisma.diarypages.findFirst({
      where: {
        diary_id: diary.id,
        page_no: parseInt(diarypage_no)
      },
      select: { id: true }
    })

    if (!diarypages) {
      return res.status(200).json({
        status: 'error',
        message: 'diary page not found'
      })
    }

    const singlepageid = diarypages.id

    const parent_comment_details = await prisma.diarycomments.findFirst({
      where: {
        id: BigInt(parent_comment_id)
      },
      include: {
        user: {
          select: {
            id: true
          }
        }
      }
    })

    const newPostcomment = await prisma.diarycomments.create(
      {
        data: {
          comment: commentText,
          diary_id: diary_id,
          user_id: user_id,
          parent_comment_id: parent_comment_id,
          single_page_id: diarypages.id,
          updated_at: new Date(),
        }
      }
    );

    // send response to client
    const newComment = await prisma.diarycomments.findFirst({
      where: {
        id: newPostcomment.id,
        single_page_id: diarypages.id
      },
      include: {
        commentLikes: true,
        diary: {
          select: {
            userdetails: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            profile_image: true,
          }
        }
      }
    })

    const formattedComment = {
      id: newComment.id.toString(),
      diary_id: newComment.diary_id.toString(),
      user_id: newComment.user_id.toString(),
      comment: newComment.comment,
      created_at: newPostcomment.created_at,
      updated_at: newPostcomment.updated_at,
      user_name: newComment.user.name,
      user_image: newComment.user.profile_image,
      commentLikes: newComment.commentLikes,
      likeCount: newComment.commentLikes.length,
      replies: []
    };

    // send notification to the commented user
    await prisma.usernotification.create({
      data: {
        user_id: parent_comment_details?.user?.id,
        message: `${user?.name} is replied to your comment on diary ${diary?.name} `,
        type: 'Comment',
        added_by: BigInt(user_id),
        link: `${process.env.MAIN_URL}/diarydetails/${diary?.uuid}/${diarypage_no}`
      }
    })

    // send notification to the diary author
    if (diary?.userdetails.id !== BigInt(user_id)) {
      await prisma.usernotification.create({
        data: {
          user_id: diary?.userdetails.id,
          message: `${user?.name} is replied to a comment on diary ${diary?.name} `,
          type: 'Comment',
          added_by: BigInt(user_id),
          link: `${process.env.MAIN_URL}/myaccount/diary/${diary.name}?uid=${diary?.uuid}&page_no=${diarypage_no}`
        }
      })
    }

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'Commentted  successfully',
      comment: formattedComment
    });
  } catch (error) {
    console.error(error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

async function getReplies(commentId) {
  const replies = await prisma.diarycomments.findMany({
    where: {
      parent_comment_id: commentId,
    },
    include: {
      user: {
        select: {
          name: true,
          profile_image: true,
          gender: true,
        },
      },
      commentLikes: true,
      _count: {
        select: {
          commentLikes: true,
        }
      },
    },
    orderBy: {
      created_at: 'asc',
    },
  });

  return Promise.all(
    replies.map(async (reply) => ({
      id: reply.id.toString(),
      diary_id: reply.diary_id.toString(),
      user_id: reply.user_id.toString(),
      comment: reply.comment,
      created_at: reply.created_at,
      updated_at: reply.updated_at,
      user_name: reply.user?.name,
      user_image: reply.user?.profile_image,
      user_gender: reply?.user?.gender,
      commentLikes: reply.commentLikes.map((like) => ({
        id: like.id?.toString(),
        comment_id: like.comment_id?.toString(),
        user_id: like.user_id?.toString(),
      })),
      likeCount: reply._count.commentLikes,
      replies: await getReplies(reply.id), // recursion here
    }))
  );
}

exports.getDiaryComments = async (req, res) => {
  const { diary_id, diarypage_no } = req.query;

  try {

    const diary = await prisma.diaries.findFirst({
      where: {
        id: BigInt(diary_id)
      }
    })

    if (!diary) {
      return res.status(200).json({
        status: "error",
        message: "Diary not found"
      })
    }

    const diarypages = await prisma.diarypages.findFirst({
      where: {
        diary_id: diary.id,
        page_no: parseInt(diarypage_no) || 1,
      },
      select: { id: true }
    })

    if (!diarypages) {
      return res.status(200).json({
        status: 'error',
        message: 'diary page not found'
      })
    }

    const comments = await prisma.diarycomments.findMany({
      where: {
        diary_id: BigInt(diary_id),
        parent_comment_id: null,
        single_page_id: diarypages.id
      },
      include: {
        user: {
          select: {
            name: true,
            profile_image: true,
            gender: true,
          },
        },
        commentReplies: {
          include: {
            user: {
              select: {
                name: true,
                profile_image: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
        },
        commentLikes: true,
        // need count of likes
        _count: {
          select: {
            commentLikes: true,
          }
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const commentCount = await prisma.diarycomments.count({
      where: {
        diary_id: BigInt(diary_id),
        parent_comment_id: null,
        single_page_id: diarypages.id
      },
    });


    const formatComment = async (comment) => ({
      id: comment.id.toString(),
      diary_id: comment.diary_id.toString(),
      user_id: comment.user_id.toString(),
      comment: comment.comment,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      user_name: comment.user?.name,
      user_image: comment.user?.profile_image,
      user_gender: comment.user?.gender,
      commentLikes: comment.commentLikes.map((like) => ({
        id: like.id?.toString(),
        comment_id: like.comment_id?.toString(),
        user_id: like.user_id?.toString(),
      })),
      likeCount: comment._count.commentLikes,

      replies: await getReplies(comment.id)
    });

    const allComments = await Promise.all(comments.map(formatComment));

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      comments: allComments,
      commentCount: commentCount,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
};

exports.updateDiarypageContent = async (req, res) => {
  const { diary_uid, page_no, diary_content, diaryAccessStatus, useruid } = req.body;
  try {

    const user = await prisma.users.findFirst({
      where: {
        uuid: useruid
      },
      select: {
        id: true,
        name: true
      }
    })

    if (!user) {
      prisma.$disconnect()
      return res.status(200).json({
        status: "error",
        message: "user not found"
      })
    }

    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diary_uid
      },
      include: {
        userdetails: {
          select: {
            id: true,
            name: true
          }
        },
        Followeddiaries: {
          where: {
            status: "followed"
          },
          select: {
            user_id: true
          }
        },
        diaryinvitation: {
          where: {
            status: "Accepted"
          },
          select: {
            receiver_id: true,
            type: true
          }
        },
        SubscriptionDiaries: {
          where: {
            status: "Active"
          },
          select: {
            user_id: true
          }
        }
      }
    })

    if (!diary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Diary Not Found'
      })
    }

    const diary_id = diary.id;

    // Extract first image from content if exists
    let contentFeaturedImageUrl = null;
    // const base64ImageRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^">]+)"/;
    // const match = diary_content.match(base64ImageRegex);

    // const uploadDir = path.join(__dirname, '../uploads', `${diary_uid}`);
    // if (!fs.existsSync(uploadDir)) {
    //   fs.mkdirSync(uploadDir, { recursive: true });
    // }

    // if (match) {
    //   const imageType = match[1];
    //   const base64Data = match[2];
    //   const imageBuffer = Buffer.from(base64Data, 'base64');
    //   const timestamp = Date.now();

    //   const imageName = `content-featured-image-${page_no}-${timestamp}.${imageType}`;
    //   const imagePath = path.join(uploadDir, imageName);

    //   try {
    //     fs.writeFileSync(imagePath, imageBuffer);
    //     contentFeaturedImageUrl = `${process.env.API_URL}/uploads/${diary_uid}/${imageName}`;
    //   } catch (err) {
    //     console.error('Error saving content featured image:', err);
    //   }
    // }

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    if (diary_content) {
      contentFeaturedImageUrl = extractFirstImage(diary_content);
    }

    await prisma.diarypages.updateMany({
      where: {
        diary_id: diary_id,
        page_no: parseInt(page_no),
      },
      data: {
        content: diary_content,
        updated_at: new Date(),
        featured_image: contentFeaturedImageUrl
      },
    });

    // update the diary updated_at field
    // await prisma.diaries.update({
    //   where: {
    //     id: diary_id
    //   },
    //   data: {
    //     updated_at: new Date(),
    //   }
    // })

    const diary_followed_users = diary?.Followeddiaries || []
    const diary_invitations = diary?.diaryinvitation || []
    const group_diary_members = diary_invitations.filter(invite => invite.type === 'Group')
    const private_diary_members = diary_invitations.filter(invite => invite.type === "Private")
    const subscription_diary_members = diary?.SubscriptionDiaries || []

    // send the notification to the followed users only if the diary is public 
    if (!diary?.is_private) {
      if (diary_followed_users.length > 0) {
        const notificationPromises = diary_followed_users.map(follower => {
          return prisma.usernotification.create({
            data: {
              user_id: follower.user_id,
              message: `The diary "${diary?.name}" you followed has been updated with new content by ${diary?.userdetails.name}`,
              type: 'diary_page_edit',
              added_by: diary?.userdetails?.id,
              link: `${process.env.MAIN_URL}/diarydetails/${diary?.uuid}/${page_no}`
            }
          });
        });

        await Promise.all(notificationPromises);
      }
    }

    if (diary?.diary_type === "Group") {
      // send notification to the Group Members
      if (group_diary_members.length > 0) {
        const groupnotificationPromises = group_diary_members
          .filter(group => group.receiver_id !== user.id)
          .map(group => {
            return prisma.usernotification.create({
              data: {
                user_id: group.receiver_id,
                message: `The diary "${diary?.name}" has been updated with new content by ${user.name}`,
                type: 'diary_page_edit',
                added_by: user.id,
                link: `${process.env.MAIN_URL}/myaccount/diary/${diary.name}?uid=${diary?.uuid}&page_no=${page_no}`
              }
            });
          });
        await Promise.all(groupnotificationPromises);
      }

      // dont send the notification if the page is edited by diary author else any group member is edited the page then send notification to the author
      if (user?.id !== diary?.userdetails?.id)
        await prisma.usernotification.create({
          data: {
            user_id: diary?.userdetails?.id,
            message: `The diary "${diary?.name}" has been updated with new content by ${user.name}`,
            type: 'diary_page_edit',
            added_by: user.id,
            link: `${process.env.MAIN_URL}/myaccount/diary/${diary.name}?uid=${diary?.uuid}&page_no=${page_no}`
          }
        });
    }

    // for private diary invitation members
    if (diary?.diary_type === "Individual" && diary?.is_private) {
      if (private_diary_members.length > 0) {
        const privatediarynotificationPromises = private_diary_members
          .filter(private => private.receiver_id !== user.id)
          .map(private => {
            return prisma.usernotification.create({
              data: {
                user_id: private.receiver_id,
                message: `The diary "${diary?.name}" has been updated with new content by ${user.name} `,
                type: 'diary_page_edit',
                added_by: user.id,
                link: `${process.env.MAIN_URL}/diarydetails/${diary?.uuid}/${page_no}`
              }
            });
          });
        await Promise.all(privatediarynotificationPromises);
      }
    }

    // for Subscription diary members
    if (diary?.diary_type === "Subscription") {
      if (subscription_diary_members.length > 0) {
        const subscriptiondiarynotificationPromises = subscription_diary_members
          .map(subscr => {
            return prisma.usernotification.create({
              data: {
                user_id: subscr.user_id,
                message: `The diary "${diary?.name}" has been updated with new content by ${user.name} `,
                type: 'diary_page_edit',
                added_by: user.id,
                link: `${process.env.MAIN_URL}/diarydetails/${diary?.uuid}/${page_no}`
              }
            });
          });
        await Promise.all(subscriptiondiarynotificationPromises);
      }
    }

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'Diary page content updated successfully',
    });
  } catch (error) {
    console.error('Error updating diary page content:', error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
}

exports.likeComment = async (req, res) => {
  const { comment_id, user_id } = req.body;
  try {

    const user = await prisma.users.findFirst({
      where: {
        id: BigInt(user_id)
      },
      select: {
        name: true
      }
    })

    if (!user) {
      prisma.$disconnect()
      return res.status(200).json({
        status: "error",
        message: "user not found"
      })
    }

    const isComment = await prisma.diarycomments.findFirst({
      where: {
        id: BigInt(comment_id)
      },
      include: {
        diary: {
          select: {
            id: true,
            uuid: true,
            name: true,
            user_id: true,
            userdetails: {
              select: {
                name: true
              }
            }
          },
        },
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!isComment) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Comment Not Found'
      })
    }

    const isLike = await prisma.commentLike.findFirst({
      where: {
        comment_id: BigInt(comment_id),
        user_id: BigInt(user_id)
      }
    })

    if (isLike) {
      await prisma.commentLike.deleteMany({
        where: {
          comment_id: BigInt(comment_id),
          user_id: BigInt(user_id)
        }
      })
    } else {
      const uuid = "DIARYCL" + Math.floor(100000 + Math.random() * 900000);
      await prisma.commentLike.create({
        data: {
          uid: uuid,
          comment_id: BigInt(comment_id),
          user_id: BigInt(user_id)
        }
      })

      // send notification to the commented user
      await prisma.usernotification.create({
        data: {
          user_id: isComment?.user?.id,
          message: `your comment is Liked on diary ${isComment?.diary?.name} by ${user?.name}`,
          type: 'Like',
          added_by: BigInt(user_id),
          link: `${process.env.MAIN_URL}/diarydetails/${isComment?.diary?.uuid}/${isComment?.single_page_id}`
        }
      })

      // send notification to the diary author
      if (isComment?.diary?.user_id !== BigInt(user_id)) {
        await prisma.usernotification.create({
          data: {
            user_id: isComment?.diary?.user_id,
            message: `your diary  ${isComment?.diary?.name} comment is Liked by ${user?.name}`,
            type: 'Like',
            added_by: BigInt(user_id),
            link: `${process.env.MAIN_URL}/myaccount/diary/${isComment?.diary?.name}?uid=${isComment?.diary?.uuid}&page_no=${isComment?.single_page_id}`
          }
        })
      }
    }

    // send response to client
    const updatedComment = await prisma.diarycomments.findFirst({
      where: {
        id: BigInt(comment_id)
      },
      include: {
        commentLikes: true,
        user: {
          select: {
            name: true,
            profile_image: true,
          }
        }
      }
    })

    const formattedComment = {
      id: updatedComment.id.toString(),
      diary_id: updatedComment.diary_id.toString(),
      user_id: updatedComment.user_id.toString(),
      comment: updatedComment.comment,
      created_at: updatedComment.created_at,
      updated_at: updatedComment.updated_at,
      user_name: updatedComment.user.name,
      user_image: updatedComment.user.profile_image,
      commentLikes: updatedComment.commentLikes.map((like) => ({
        id: like.id?.toString(),
        comment_id: like.comment_id?.toString(),
        user_id: like.user_id?.toString(),
      })),
      likeCount: updatedComment.commentLikes.length,
    };

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'Comment liked successfully',
      comment: formattedComment
    });
  } catch (error) {
    console.error('Error liking comment:', error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
}

exports.sendDiaryInvitation = async (req, res) => {
  const { sender_user_id, diaryid, invited_user_id } = req.body;
  try {

    // check if invitation is already sent 
    const isInvitation = await prisma.diaryinvitations.findFirst({
      where: {
        sender_id: BigInt(sender_user_id),
        diary_id: BigInt(diaryid),
        receiver_id: BigInt(invited_user_id),
        NOT: {
          status: "Rejected"
        }
      }
    })

    if (isInvitation) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Invitation already sent to this user'
      })
    }

    const isDiary = await prisma.diaries.findFirst({
      where: {
        id: BigInt(diaryid)
      }
    })

    if (!isDiary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Diary Not Found'
      })
    }

    const isUser = await prisma.users.findFirst({
      where: {
        id: BigInt(invited_user_id)
      }
    })

    if (!isUser) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'User Not Found'
      })
    }

    const uuid = "DIARYINV" + Math.floor(100000 + Math.random() * 900000);
    await prisma.diaryinvitations.create({
      data: {
        uuid: uuid,
        sender_id: BigInt(sender_user_id),
        diary_id: BigInt(diaryid),
        receiver_id: BigInt(invited_user_id)
      }
    })

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'Invitation sent successfully'
    })
  }
  catch (error) {
    console.error('Error sending diary invitation:', error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
}

exports.sendDiaryInvitationToGroupMembers = async (req, res) => {
  const { sender_user_id, diaryid, invited_user_id } = req.body;
  try {

    // check if invitation is already sent 
    const isInvitation = await prisma.diaryinvitations.findFirst({
      where: {
        sender_id: BigInt(sender_user_id),
        diary_id: BigInt(diaryid),
        receiver_id: BigInt(invited_user_id),
        NOT: {
          status: "Rejected"
        }
      }
    })

    if (isInvitation) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Invitation already sent to this Member'
      })
    }

    const isDiary = await prisma.diaries.findFirst({
      where: {
        id: BigInt(diaryid)
      }
    })

    if (!isDiary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Diary Not Found'
      })
    }

    const isUser = await prisma.users.findFirst({
      where: {
        id: BigInt(invited_user_id)
      }
    })

    if (!isUser) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'User Not Found'
      })
    }

    const uuid = "DIARYINVTG" + Math.floor(100000 + Math.random() * 900000);
    await prisma.diaryinvitations.create({
      data: {
        uuid: uuid,
        sender_id: BigInt(sender_user_id),
        diary_id: BigInt(diaryid),
        receiver_id: BigInt(invited_user_id),
        type: "Group"
      }
    })

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'Invitation sent successfully'
    })
  }
  catch (error) {
    console.error('Error sending diary invitation:', error);
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
        status: "Accepted",
        type: "Private"
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
              where: {
                status: "Published"
              },
              select: {
                content: true,
                page_no: true,
                updated_at: true,
                view_count: true,
                share_count: true,
                _count: {
                  select: {
                    diarycomments: true
                  }
                }
              },
              orderBy: {
                created_at: "desc"
              },
              // take: 1,
            },
            diarylike: {
              where: {
                isliked: true
              },
              select: {
                id: true
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
        status: "Accepted",
        type: "Private"
      }
    });

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    let allInvitations = [];
    if (invitations.length > 0) {
      allInvitations = invitations.map((invitation) => {
        const recentContent = invitation.diary.diarycontent[0];
        const firstPage = invitation.diary.diarycontent.find(content => content.page_no === 1);
        const likesCount = invitation.diary.diarylike ? invitation.diary.diarylike.length : 0
        return {
          id: invitation.id.toString(),
          diary_id: invitation.diary.id.toString(),
          uuid: invitation.diary.uuid,
          name: invitation.diary.name,
          featured_image_url: invitation.diary.featured_image_url,
          created_at: invitation.diary.created_at,
          author_name: invitation.diary.userdetails?.name || "Unknown",
          author_image: invitation.diary.userdetails?.profile_image || null,
          diary_like_count: likesCount,
          // diarycontent: invitation.diary.diarycontent.map((content) => ({
          //   content: content.content,
          //   page_no: content.page_no,
          //   content_image: extractFirstImage(content?.content),
          //   view_count: content?.view_count?.toString() || 0,
          //   share_count: content?.share_count?.toString() || 0,
          //   comment_count: content._count.diarycomments
          // })),
          diarycontent: {
            content: recentContent?.content,
            page_no: recentContent?.page_no,
            content_image: extractFirstImage(recentContent?.content),
            view_count: recentContent?.view_count?.toString() || "0",
            share_count: recentContent?.share_count?.toString() || "0",
            comment_count: recentContent?._count?.diarycomments || 0,
            updated_at: recentContent?.updated_at
          }
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


exports.getGroupInvitedDiaries = async (req, res) => {
  const { user_id, limit = 4, offset = 0 } = req.query;
  try {
    const invitations = await prisma.diaryinvitations.findMany({
      where: {
        receiver_id: BigInt(user_id),
        status: "Accepted",
        type: "Group"
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
                page_no: true,
                updated_at: true,
                view_count: true,
                share_count: true,
                _count: {
                  select: {
                    diarycomments: true
                  }
                }
              },
              orderBy: {
                created_at: "desc"
              },
              // take: 1,
            },
            diarylike: {
              where: {
                isliked: true
              },
              select: {
                id: true
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
        status: "Accepted",
        type: "Group"
      }
    });

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    let allInvitations = [];
    if (invitations.length > 0) {
      allInvitations = invitations.map((invitation) => {
        const recentContent = invitation.diary.diarycontent[0];
        const firstPage = invitation.diary.diarycontent.find(content => content.page_no === 1);
        const likesCount = invitation.diary.diarylike ? invitation.diary.diarylike.length : 0

        return {
          id: invitation.id.toString(),
          diary_id: invitation.diary.id.toString(),
          uuid: invitation.diary.uuid,
          name: invitation.diary.name,
          featured_image_url: invitation.diary.featured_image_url,
          created_at: invitation.diary.created_at,
          author_name: invitation.diary.userdetails?.name || "Unknown",
          author_image: invitation.diary.userdetails?.profile_image || null,
          diary_like_count: likesCount,
          // diarycontent: invitation.diary.diarycontent.map((content) => ({
          //   content: content.content,
          //   page_no: content.page_no,
          //   content_image: extractFirstImage(content?.content),
          //   view_count: content?.view_count?.toString() || 0,
          //   share_count: content?.share_count?.toString() || 0,
          //   comment_count: content._count.diarycomments
          // })),
          diarycontent: {
            content: recentContent?.content,
            page_no: recentContent?.page_no,
            content_image: extractFirstImage(recentContent?.content),
            view_count: recentContent?.view_count?.toString() || "0",
            share_count: recentContent?.share_count?.toString() || "0",
            comment_count: recentContent?._count?.diarycomments || 0,
            updated_at: recentContent?.updated_at
          }
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

exports.getSubscriptionDiaries = async (req, res) => {
  const { user_id, limit = 4, offset = 0 } = req.query;
  try {

    const subscription_diaries = await prisma.subscriptiondiaries.findMany({
      where: {
        user_id: BigInt(user_id),
        status: "Active",
      },
      include: {
        diarydetails: {
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
              where: {
                status: "Published"
              },
              select: {
                content: true,
                page_no: true,
                updated_at: true,
                view_count: true,
                share_count: true,
                _count: {
                  select: {
                    diarycomments: true
                  }
                }
              },
              orderBy: {
                created_at: "desc"
              },
              // take: 1,
            },
            diarylike: {
              where: {
                isliked: true
              },
              select: {
                id: true
              }
            }
          }
        },
      },
      take: parseInt(limit),
      skip: parseInt(offset),
    })

    const totalSubscriptiondiariesCount = await prisma.subscriptiondiaries.count({
      where: {
        user_id: BigInt(user_id),
        status: "Active",
      }
    });

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    let allSubscriptiondiaries = [];
    if (subscription_diaries.length > 0) {
      allSubscriptiondiaries = subscription_diaries.map((subscription) => {
        const recentContent = subscription.diarydetails.diarycontent[0];
        const firstPage = subscription.diarydetails.diarycontent.find(content => content.page_no === 1);
        const likesCount = subscription.diarydetails.diarylike ? subscription.diarydetails.diarylike.length : 0
        return {
          id: subscription.id.toString(),
          diary_id: subscription.diarydetails.id.toString(),
          uuid: subscription.diarydetails.uuid,
          name: subscription.diarydetails.name,
          featured_image_url: subscription.diarydetails.featured_image_url,
          created_at: subscription.diarydetails.created_at,
          author_name: subscription.diarydetails.userdetails?.name || "Unknown",
          author_image: subscription.diarydetails.userdetails?.profile_image || null,
          diary_like_count: likesCount,
          // diarycontent: subscription.diarydetails.diarycontent.map((content) => ({
          //   content: content.content,
          //   page_no: content.page_no,
          //   content_image: extractFirstImage(content?.content),
          //   view_count: content?.view_count?.toString() || 0,
          //   share_count: content?.share_count?.toString() || 0,
          //   comment_count: content._count.diarycomments
          // })),
          diarycontent: {
            content: recentContent?.content,
            page_no: recentContent?.page_no,
            content_image: extractFirstImage(recentContent?.content),
            view_count: recentContent?.view_count?.toString() || "0",
            share_count: recentContent?.share_count?.toString() || "0",
            comment_count: recentContent?._count?.diarycomments || 0,
            updated_at: recentContent?.updated_at
          }
        }
      })
    }

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      diaries: allSubscriptiondiaries,
      totalDiariesCount: totalSubscriptiondiariesCount
    });
  }
  catch (error) {
    console.log(error)
    prisma.$disconnect()
    return res.status(200).json({
      status: "error",
      message: "Internl server error"
    })
  }
}

exports.getDiaryInvitationDetails = async (req, res) => {
  const { user_id, page } = req.query;

  try {
    const limit = 10;
    const offset = (page - 1) * limit;
    const diaryinvitations = await prisma.diaryinvitations.findMany({
      where: {
        receiver_id: parseInt(user_id),
        type: "Private"
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
        }
      },
      skip: offset,
      take: limit,
      orderBy: {
        created_at: 'desc'
      }
    })
    const totalpages = await prisma.diaryinvitations.count({
      where: {
        receiver_id: parseInt(user_id),
        type: "Private"
      }
    });

    const alldiaryinvitations = []
    if (diaryinvitations.length > 0) {
      diaryinvitations.map(invitations => {
        alldiaryinvitations.push({
          name: invitations.diary.name,
          uuid: invitations.diary.uuid,
          invitation_uuid: invitations.uuid,
          sender_name: invitations.sender.name,
          status: invitations.status,
        })
      });
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: "All Diary Invitations Fetched Successfully",
      alldiaryinvitations: alldiaryinvitations,
      totalpages: Math.ceil(totalpages / limit)
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

exports.getGroupDiaryInvitationDetails = async (req, res) => {
  const { user_id, page } = req.query;

  try {
    const limit = 10;
    const offset = (page - 1) * limit;
    const diaryinvitations = await prisma.diaryinvitations.findMany({
      where: {
        receiver_id: parseInt(user_id),
        type: "Group"
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
        }
      },
      skip: offset,
      take: limit,
      orderBy: {
        created_at: 'desc'
      }
    })
    const totalpages = await prisma.diaryinvitations.count({
      where: {
        receiver_id: parseInt(user_id),
        type: "Group"
      }
    });

    const alldiaryinvitations = []
    if (diaryinvitations.length > 0) {
      diaryinvitations.map(invitations => {
        alldiaryinvitations.push({
          name: invitations.diary.name,
          uuid: invitations.diary.uuid,
          invitation_uuid: invitations.uuid,
          sender_name: invitations.sender.name,
          status: invitations.status,
        })
      });
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: "All Diary Invitations Fetched Successfully",
      alldiaryinvitations: alldiaryinvitations,
      totalpages: Math.ceil(totalpages / limit)
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

exports.invitationStatusUpdate = async (req, res) => {
  const { diary_uuid, status } = req.body;

  try {
    const invitatitons = await prisma.diaryinvitations.findFirst({
      where: {
        uuid: diary_uuid,
      }
    })

    if (!invitatitons) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Diary invitation not found'
      })
    }

    await prisma.diaryinvitations.update({
      where: {
        uuid: diary_uuid,
      },
      data: {
        status: status
      }
    })

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'status updated successfully'
    })
  } catch (error) {
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.generateDiaryShareToken = async (req, res) => {
  const { diary_id, user_id } = req.body;
  try {
    const diary = await prisma.diaries.findFirst({
      where: {
        id: BigInt(diary_id)
      }
    })

    if (!diary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Diary Not Found'
      })
    }

    const uuid = "DIARYSGT" + Math.floor(100000 + Math.random() * 900000);
    const access_token = jwt.sign({ user_id: user_id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    await prisma.sharediariesbylink.create({
      data: {
        uuid: uuid,
        diary_id: BigInt(diary_id),
        user_id: BigInt(user_id),
        access_token: access_token
      }
    })

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'Token generated successfully',
      genrated_token: access_token
    })
  } catch (error) {
    console.error('Error generating diary share token:', error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
}

exports.generateDiaryShareTokenToGroupMembers = async (req, res) => {
  const { diary_id, user_id } = req.body;
  try {
    const diary = await prisma.diaries.findFirst({
      where: {
        id: BigInt(diary_id)
      }
    })

    if (!diary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Diary Not Found'
      })
    }

    const uuid = "DIARYSGTG" + Math.floor(100000 + Math.random() * 900000);
    const access_token = jwt.sign({ user_id: user_id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    await prisma.sharediariesbylink.create({
      data: {
        uuid: uuid,
        diary_id: BigInt(diary_id),
        user_id: BigInt(user_id),
        access_token: access_token,
        type: "Group"
      }
    })

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'Token generated successfully',
      genrated_token: access_token
    })
  } catch (error) {
    console.error('Error generating diary share token:', error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
}

exports.acceptRejectDiaryInvitation = async (req, res) => {
  const { diary_uid, sender_uid, receiver_uid, status } = req.body;

  try {

    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diary_uid
      },
      select: {
        id: true
      }
    })

    if (!diary) {
      return res.json({
        status: "error",
        message: "diary not found"
      })
    }

    // const sender = await prisma.users.findFirst({
    //   where: {
    //     uuid: sender_uid
    //   },
    //   select: {
    //     id: true
    //   }
    // })

    // if (!sender) {
    //   return res.json({
    //     status: "error",
    //     message: "sender user id not found"
    //   })
    // }

    const receiver = await prisma.users.findFirst({
      where: {
        uuid: receiver_uid
      },
      select: {
        id: true
      }
    })

    if (!receiver) {
      return res.json({
        status: "error",
        message: "receiver user id not found"
      })
    }

    const isInvitation = await prisma.diaryinvitations.findFirst({
      where: {
        // sender_id: sender?.id,
        diary_id: diary?.id,
        receiver_id: receiver?.id
      },
      select: {
        id: true
      }
    })

    let inviationStatus;

    if (isInvitation) {
      const isdiary = await prisma.diaryinvitations.update({
        where: {
          id: isInvitation?.id
        },
        data: {
          status: status
        }
      })
      inviationStatus = isdiary?.status
    } else {
      return res.json({
        status: "error",
        message: "Invitation not found"
      })
    }

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: `Diary invitation ${status}`,
      inviationStatus
    })
  }
  catch (error) {
    console.log(error)
    await prisma.$disconnect()
    return res.json({
      status: "error",
      message: "Internal server error"
    })
  }
}

exports.getDiaryGroupMembers = async (req, res) => {
  const { diary_id } = req.query;

  if (!diary_id) {
    return res.status(400).json({
      status: 'error',
      message: 'Diary ID is required'
    });
  }

  try {
    const diary = await prisma.diaries.findFirst({
      where: { id: BigInt(diary_id) },
      select: {
        id: true,
        uuid: true,
        name: true,
        userdetails: {
          select: {
            id: true,
            uuid: true, // Added uuid for consistency
            name: true,
            profile_image: true
          }
        },
        diaryinvitation: {
          where: {
            type: "Group",
            status: "Accepted"
          },
          select: {
            receiver: {
              select: {
                id: true,
                uuid: true,
                name: true,
                profile_image: true
              }
            }
          }
        }
      }
    });

    if (!diary) {
      return res.status(200).json({
        status: 'error',
        message: 'Diary not found'
      });
    }

    const groupMembers = diary.diaryinvitation.map(invitation => ({
      user_id: invitation.receiver.id.toString(),
      uuid: invitation.receiver.uuid,
      name: invitation.receiver.name,
      profile_image: invitation.receiver.profile_image
    }));

    // Add diary author to group members
    groupMembers.unshift({
      user_id: diary.userdetails.id.toString(),
      uuid: diary.userdetails.uuid,
      name: diary.userdetails.name,
      profile_image: diary.userdetails.profile_image
    });

    const diaryDetails = {
      id: diary.id.toString(),
      uuid: diary.uuid,
      name: diary.name,
      author_name: diary.userdetails.name,
      author_image: diary.userdetails.profile_image,
      groupMembers
    };

    return res.status(200).json({
      status: 'success',
      diary: diaryDetails,
      groupMembers: groupMembers
    });
  } catch (error) {
    console.error('Error fetching group members:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

exports.subscribeDiary = async (req, res) => {
  const { diaryuid, useruid } = req.body;

  try {
    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diaryuid
      },
      select: {
        id: true
      }
    })

    if (!diary) {
      return res.status(200).json({
        status: 'error',
        message: 'Diary not found'
      });
    }

    const user = await prisma.users.findFirst({
      where: {
        uuid: useruid
      },
      select: {
        id: true
      }
    })

    if (!user) {
      return res.status(200).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const isSubscribed = await prisma.subscriptiondiaries.findFirst({
      where: {
        diary_id: diary.id,
        user_id: user.id,
        status: 'Active'
      }
    })

    if (isSubscribed) {
      return res.status(200).json({
        status: 'error',
        message: 'Already subscribed to this diary'
      });
    }
    const uuid = "DIARYSUB" + Math.floor(100000 + Math.random() * 900000);
    await prisma.subscriptiondiaries.create({
      data: {
        uuid: uuid,
        diary_id: diary.id,
        user_id: user.id,
        status: 'Active'
      }
    });

    return res.status(200).json({
      status: 'success',
      message: 'Subscribed to diary successfully'
    });
  } catch (error) {
    console.error('Error subscribing to diary:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

exports.followDiary = async (req, res) => {
  const { diaryuid, useruid, diary_stus } = req.body;

  try {
    const diary = await prisma.diaries.findFirst({
      where: { uuid: diaryuid },
      include: {
        userdetails: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!diary) {
      return res.status(200).json({
        status: 'error',
        message: 'Diary not found'
      });
    }

    const user = await prisma.users.findFirst({
      where: { uuid: useruid },
      select: {
        id: true,
        name: true
      }
    });

    if (!user) {
      return res.status(200).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const followed_diary = await prisma.followeddiaries.findFirst({
      where: {
        diary_id: diary.id,
        user_id: user.id,
      }
    });

    if (followed_diary) {

      await prisma.followeddiaries.update({
        where: { id: followed_diary.id },
        data: { status: diary_stus }
      });

      return res.status(200).json({
        status: 'success',
        message: `Diary ${diary_stus} successfully`
      });
    } else {
      const uuid = "DIARYF" + Math.floor(100000 + Math.random() * 900000);
      await prisma.followeddiaries.create({
        data: {
          uid: uuid,
          diary_id: diary.id,
          user_id: user.id,
          status: diary_stus
        }
      });

      if (diary?.userdetails.id !== user?.id) {
        await prisma.usernotification.create({
          data: {
            user_id: diary?.userdetails.id,
            message: `Your diary "${diary?.name}" is followed by ${user?.name}`,
            type: 'Follow_diary',
            added_by: user?.id,
            link: `${process.env.MAIN_URL}/diarydetails/${diary?.uuid}`
          }
        })
      }
      return res.status(200).json({
        status: 'success',
        message: `${diary_stus} diary successfully`
      });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

exports.getFollowedDiaries = async (req, res) => {
  const { user_id, limit = 4, offset = 0 } = req.query;
  try {
    const followeddiaries = await prisma.followeddiaries.findMany({
      where: {
        user_id: BigInt(user_id),
        status: "followed"
      },
      include: {
        diarydetails: {
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
              where: {
                status: "Published"
              },
              select: {
                content: true,
                page_no: true,
                updated_at: true,
                view_count: true,
                share_count: true,
                _count: {
                  select: {
                    diarycomments: true
                  }
                }
              },
              orderBy: {
                created_at: "desc"
              },
              // take: 1,
            },
            diarylike: {
              where: {
                isliked: true
              },
              select: {
                id: true
              }
            }
          }
        },
      },
      take: parseInt(limit),
      skip: parseInt(offset),
    })

    const totalFolloweddiariesCount = await prisma.followeddiaries.count({
      where: {
        user_id: BigInt(user_id),
        status: "followed"
      }
    });

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    let allfolloweddiaries = [];
    if (followeddiaries.length > 0) {
      allfolloweddiaries = followeddiaries.map((invitation) => {
        const recentContent = invitation.diarydetails.diarycontent[0];
        const firstPage = invitation.diarydetails.diarycontent.find(content => content.page_no === 1);
        const likesCount = invitation.diarydetails.diarylike ? invitation.diarydetails.diarylike.length : 0
        return {
          id: invitation.id.toString(),
          diary_id: invitation.diarydetails.id.toString(),
          uuid: invitation.diarydetails.uuid,
          name: invitation.diarydetails.name,
          featured_image_url: invitation.diarydetails.featured_image_url,
          created_at: invitation.diarydetails.created_at,
          author_name: invitation.diarydetails.userdetails?.name || "Unknown",
          author_image: invitation.diarydetails.userdetails?.profile_image || null,
          diary_like_count: likesCount,
          // diarycontent: invitation.diarydetails.diarycontent.map((content) => ({
          //   content: content.content,
          //   page_no: content.page_no,
          //   content_image: extractFirstImage(content?.content),
          //   view_count: content?.view_count?.toString() || 0,
          //   share_count: content?.share_count?.toString() || 0,
          //   comment_count: content._count.diarycomments
          // })),
          diarycontent: {
            content: recentContent?.content,
            page_no: recentContent?.page_no,
            content_image: extractFirstImage(recentContent?.content),
            view_count: recentContent?.view_count?.toString() || "0",
            share_count: recentContent?.share_count?.toString() || "0",
            comment_count: recentContent?._count?.diarycomments || 0,
            updated_at: recentContent?.updated_at
          }
        }
      })
    }

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      diaries: allfolloweddiaries,
      totalDiariesCount: totalFolloweddiariesCount
    });
  } catch (error) {
    console.error('Error fetching diary followeddiaries:', error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
}

exports.likeDiaryPage = async (req, res) => {
  const { currentPageno, useruid, diary_uid } = req.body;
  try {
    const diary = await prisma.diaries.findFirst({
      where: { uuid: diary_uid },
      include: {
        userdetails: {
          select: {
            id: true
          }
        }
      }
    });


    if (!diary) {
      return res.status(200).json({
        status: 'error',
        message: 'Diary not found'
      });
    }

    const user = await prisma.users.findFirst({
      where: { uuid: useruid },
      select: {
        id: true,
        name: true
      }
    });

    if (!user) {
      return res.status(200).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const diarypages = await prisma.diarypages.findFirst({
      where: {
        diary_id: diary.id,
        page_no: parseInt(currentPageno)
      },
      select: { id: true }
    })

    if (!diarypages) {
      return res.status(200).json({
        status: 'error',
        message: 'diary page not found'
      })
    }

    const singlepageid = diarypages.id

    const diary_page_like = await prisma.siglediarypagelikes.findFirst({
      where: {
        diary_id: diary.id,
        user_id: user.id,
        single_page_id: singlepageid
      },
      select: {
        id: true,
        isliked: true
      }
    });

    if (diary_page_like) {
      await prisma.siglediarypagelikes.update({
        where: { id: diary_page_like.id },
        data: {
          isliked: !diary_page_like.isliked
        }
      });
    } else {
      const uuid = "DIARYPL" + Math.floor(100000 + Math.random() * 900000);
      await prisma.siglediarypagelikes.create({
        data: {
          uid: uuid,
          diary_id: diary.id,
          single_page_id: singlepageid,
          user_id: user.id,
          isliked: true
        }
      });
      if (diary?.userdetails.id !== user?.id) {
        await prisma.usernotification.create({
          data: {
            user_id: diary?.userdetails.id,
            message: `Your diary "${diary?.name}" page No ${currentPageno} is Liked by ${user?.name}`,
            type: 'Like',
            added_by: user?.id,
            link: `${process.env.MAIN_URL}/myaccount/diary/${diary?.name}?uid=${diary?.uuid}&page_no=${currentPageno}`
          }
        })
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Diary status updated'
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

exports.likeDiary = async (req, res) => {
  const { useruid, diary_uid } = req.body;
  try {
    const diary = await prisma.diaries.findFirst({
      where: { uuid: diary_uid },
      include: {
        userdetails: {
          select: {
            id: true
          }
        }
      }
    });

    if (!diary) {
      return res.status(200).json({
        status: 'error',
        message: 'Diary not found'
      });
    }

    const user = await prisma.users.findFirst({
      where: { uuid: useruid },
      select: {
        id: true,
        name: true
      }
    });

    if (!user) {
      return res.status(200).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const isdiary_liked = await prisma.diarylikes.findFirst({
      where: {
        diary_id: diary?.id,
        user_id: user?.id
      },
      select: {
        id: true,
        isliked: true
      }
    });

    if (isdiary_liked) {
      await prisma.diarylikes.update({
        where: {
          id: isdiary_liked?.id
        },
        data: {
          isliked: !isdiary_liked?.isliked
        }
      })
    } else {
      const like_uid = "DIARYL" + Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.diarylikes.create({
        data: {
          uid: like_uid,
          diary_id: diary?.id,
          user_id: user?.id,
          isliked: true
        }
      })
      if (diary?.userdetails.id !== user?.id) {
        await prisma.usernotification.create({
          data: {
            user_id: diary?.userdetails.id,
            message: `Your diary "${diary?.name}" is Liked by ${user?.name}`,
            type: 'Like',
            added_by: user?.id,
            link: `${process.env.MAIN_URL}/myaccount/diary/${diary.name}?uid=${diary?.uuid}`
          }
        })
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Diary Likes added successfully',
    });
  }
  catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

exports.getDiaryContribution = async (req, res) => {
  const { user_id, page, limit } = req.query;

  try {
    const offset = (Number(page) - 1) * Number(limit);
    const diaries = await prisma.diaries.findMany({
      where: {
        user_id: BigInt(user_id)
      }
    });

    const contributedDiaries = await prisma.diarypages.findMany({
      where: {
        diary_id: {
          in: diaries.map((item) => item.id)
        },
        NOT: {
          added_by: BigInt(user_id)
        },
        status: "Pending"
      },
      include: {
        diary: {
          select: {
            uuid: true,
            name: true,
          }
        },
        added_by_details: {
          select: {
            name: true
          }
        }
      },
      take: Number(limit),
      skip: Number(offset)
    });

    const contributedDiariesCount = await prisma.diarypages.count({
      where: {
        diary_id: {
          in: diaries.map((item) => item.id)
        },
        NOT: {
          added_by: BigInt(user_id)
        },
        status: "Pending"
      }
    })

    let alldiarycontributions = [];
    if (contributedDiaries.length > 0) {
      alldiarycontributions = contributedDiaries.map((item) => ({
        uuid: item?.diary?.uuid,
        name: item?.diary?.name,
        contributed_by: item?.added_by_details?.name,
        status: item?.status,
        content: item?.content,
        id: item?.id.toString()
      }));
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      alldiarycontributions: alldiarycontributions,
      totalpages: Math.ceil(contributedDiariesCount / Number(limit))
    })
  } catch (error) {
    console.error('Error:', error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

exports.contributionStatusUpdate = async (req, res) => {
  const { diarypage_id, status } = req.body;

  try {
    const isDiaryPage = await prisma.diarypages.findFirst({
      where: {
        id: BigInt(diarypage_id)
      },
      include: {
        diary: {
          select: {
            user_id: true,
            name: true
          }
        }
      }
    })
    if (!isDiaryPage) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "page not found"
      })
    }

    if (status === "Rejected") {
      await prisma.diarypages.update({
        where: {
          id: BigInt(diarypage_id)
        },
        data: {
          status: "Rejected"
        }
      })

      await prisma.usernotification.create({
        data: {
          user_id: isDiaryPage?.added_by,
          message: `The diary ${isDiaryPage?.diary?.name} that you contributed has been rejected.`,
          type: "contributions",
          added_by: isDiaryPage?.diary?.user_id
        }
      });
    } else if (status === "Published") {
      const totaldiaryPagesCount = await prisma.diarypages.count({
        where: {
          diary_id: isDiaryPage.diary_id,
          NOT: {
            page_no: null
          },
          status: "Published"
        }
      })
      await prisma.diarypages.update({
        where: {
          id: BigInt(diarypage_id)
        },
        data: {
          status: "Published",
          page_no: parseInt(totaldiaryPagesCount) + 1
        }
      })
      await prisma.usernotification.create({
        data: {
          user_id: isDiaryPage?.added_by,
          message: `The diary ${isDiaryPage?.diary?.name} that you contributed has been published.`,
          type: "contributions",
          added_by: isDiaryPage?.diary?.user_id
        }
      });
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: "Successfully Updated"
    })
  } catch (error) {
    console.error('Error:', error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

exports.getMyDiaryContribution = async (req, res) => {
  const { user_id, page, limit } = req.query;

  try {
    const offset = (Number(page) - 1) * Number(limit);
    const diaries = await prisma.diaries.findMany({
      where: {
        user_id: BigInt(user_id)
      }
    });

    const contributedDiaries = await prisma.diarypages.findMany({
      where: {
        NOT: {
          diary_id: {
            in: diaries.map((item) => item.id)
          }
        },
        added_by: BigInt(user_id),
      },
      include: {
        diary: {
          select: {
            uuid: true,
            name: true,
          }
        },
        added_by_details: {
          select: {
            name: true
          }
        }
      },
      take: Number(limit),
      skip: Number(offset)
    });

    const contributedDiariesCount = await prisma.diarypages.count({
      where: {
        NOT: {
          diary_id: {
            in: diaries.map((item) => item.id)
          }
        },
        added_by: BigInt(user_id),
      }
    })

    let alldiarycontributions = [];
    if (contributedDiaries.length > 0) {
      alldiarycontributions = contributedDiaries.map((item) => ({
        uuid: item?.diary?.uuid,
        name: item?.diary?.name,
        contributed_by: item?.added_by_details?.name,
        status: item?.status,
        content: item?.content,
        id: item?.id.toString()
      }));
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      alldiarycontributions: alldiarycontributions,
      totalpages: Math.ceil(contributedDiariesCount / Number(limit))
    })
  } catch (error) {
    console.error('Error:', error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

exports.updateContributionContent = async (req, res) => {
  const { pageid, diaryContentChange } = req.body;

  try {
    const isDiariesPage = await prisma.diarypages.findFirst({
      where: {
        id: BigInt(pageid)
      }
    });

    if (!isDiariesPage) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Page not found"
      })
    }

    await prisma.diarypages.update({
      where: {
        id: BigInt(pageid)
      },
      data: {
        content: diaryContentChange
      }
    });

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: "Content Updated Successfull"
    })
  } catch (error) {
    console.error('Error:', error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

// 1 Year remainder of diary
exports.diaryAnniversary = async (req, res) => {
  try {
    const alldiaries = await prisma.diaries.findMany({
      where: {
        // difference between today date and created_at should be 1 year
      }
    });

    if (alldiaries.length > 0) {
      alldiaries.map(async (item) => {
        const views = await prisma.diarypages.findFirst({
          where: {
            diary_id: item.id
          },
          select: {
            view_count: true
          }
        });

        await prisma.usernotification.create({
          data: {
            user_id: item?.user_id,
            message: `Congratulations! Your diary ${item.name} have been completed 1 year with ${views.view_count}.`,
            type: 'anniversary',
            link: `${process.env.MAIN_URL}/myaccount/diary/${item.name}?uid=${item?.uuid}`
          }
        });
      })
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: "Successfully send the notifications of diary anniversaries"
    })
  } catch (error) {
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.checkAndUpdateDiaryPages = async () => {
  try {
    const result = await prisma.diarypages.updateMany({
      where: {
        is_publish_date: { lte: new Date() },
        status: { not: 'Published' }
      },
      data: { status: 'Published' }
    });

    console.log(`${result.count} diary pages updated to Published.`);
  } catch (error) {
    console.error("Error in cron job:", error.message);
  }
};


exports.increaseDiaryShareCount = async (req, res) => {
  const { diarypage_no, diary_uid } = req.body;
  try {
    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diary_uid
      }
    });

    if (!diary) {
      return res.status(200).json({
        status: 'error',
        message: 'Diary not found'
      });
    }

    const diarypages = await prisma.diarypages.findFirst({
      where: {
        diary_id: diary.id,
        page_no: parseInt(diarypage_no)
      },
      select: {
        id: true,
        share_count: true
      }
    })

    if (!diarypages) {
      return res.status(200).json({
        status: 'error',
        message: 'diary page not found'
      })
    }

    const share_count = await prisma.diarypages.update({
      where: {
        id: diarypages.id
      },
      data: {
        share_count: parseInt(diarypages?.share_count) + 1
      }
    })

    return res.status(200).json({
      status: 'success',
      message: 'Diary shared',
      share_count: share_count?.share_count?.toString()
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}


exports.getLatestPublishDate = async (req, res) => {
  const { diary_id } = req.query;

  try {
    const lastPublishDate = await prisma.diarypages.findFirst({
      where: {
        diary_id: BigInt(diary_id), // ensure diary_id is BigInt (since your model uses BigInt)
        is_publish_date: {
          not: null // only consider rows where publish date is set
        }
      },
      orderBy: {
        is_publish_date: 'desc' // latest publish date
      },
      select: {
        is_publish_date: true
      }
    });

    return res.status(200).json({
      status: 'success',
      lastPublishDate: lastPublishDate?.is_publish_date || null
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};


exports.deleteDiaryPage = async (req, res) => {
  const { diary_uid, diarypage_no } = req.body;
  try {

    const diary = await prisma.diaries.findFirst({
      where: {
        uuid: diary_uid
      },
      select: {
        id: true,
        featured_image_path: true
      }
    })

    if (!diary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary not found"
      })
    }

    const diarypage = await prisma.diarypages.findFirst({
      where: {
        diary_id: diary?.id,
        page_no: diarypage_no
      }
    })

    if (!diarypage) {
      return res.status(200).json({
        status: "error",
        message: "diary page not found"
      })
    }

    const comments = await prisma.diarycomments.findMany({
      where: {
        diary_id: diary.id,
        single_page_id: diarypage?.id
      },
      select: { id: true }
    });

    const commentIds = comments.map(comment => comment.id);

    if (commentIds.length > 0) {
      await prisma.commentLike.deleteMany({
        where: {
          comment_id: {
            in: commentIds
          }
        }
      });
    }

    await prisma.diarycomments.deleteMany({
      where: {
        diary_id: diary?.id,
        single_page_id: diarypage?.id
      }
    })

    await prisma.diarypages.deleteMany({
      where: {
        id: diarypage?.id,
        diary_id: diary?.id,
      }
    })

    // re arrange the diary page_no number in diary pages table
    await prisma.diarypages.updateMany({
      where: {
        diary_id: diary.id,
        page_no: {
          gt: diarypage_no
        }
      },
      data: {
        page_no: {
          decrement: 1
        }
      }
    });

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: "Diary Page deleted successfully"
    })
  } catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    })
  }
}

exports.deleteDiaryComment = async (req, res) => {
  const { diaryid, comment_id } = req.body;
  try {

    const diary = await prisma.diaries.findFirst({
      where: {
        id: diaryid
      }
    })

    if (!diary) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary not found"
      })
    }

    await prisma.commentLike.deleteMany({
      where: {
        comment_id: comment_id
      }
    });

    await prisma.diarycomments.deleteMany({
      where: {
        parent_comment_id: comment_id
      }
    })

    await prisma.diarycomments.deleteMany({
      where: {
        id: comment_id
      }
    })

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: "Diary comment deleted successfully"
    })
  } catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    })
  }
}

exports.diaryPageImageUpload = async (req, res) => {
  const form = new multiparty.Form();

  form.parse(req, async (error, fields, files) => {
    if (error) {
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }

    const profilePic = files.file?.[0];

    if (!profilePic) {
      return res.status(400).json({
        status: "error",
        message: "Image file is missing",
      });
    }

    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const tempImagePath = profilePic.path || profilePic.filepath;

    if (!tempImagePath) {
      return res.status(400).json({
        status: "error",
        message: "Image file path is missing",
      });
    }

    const newFileName = Date.now() + '-' + profilePic.originalFilename;
    const finalImagePath = path.join(uploadDir, newFileName);

    try {
      fs.copyFileSync(tempImagePath, finalImagePath);
      fs.unlinkSync(tempImagePath); // Clean up temp file

      const imageUrl = `${process.env.API_URL}/uploads/${newFileName}`;

      return res.status(200).json({
        status: "success",
        imageUrl,
      });
    } catch (err) {
      return res.status(500).json({
        status: "error",
        message: "Failed to save the image",
      });
    }
  });
};

exports.getDiarydataformetainfo = async (req, res) => {
  const { uid, page_no } = req.query;

  try {

    const diaryData = await prisma.diaries.findFirst({
      where: {
        uuid: uid
      },
    })

    if (!diaryData) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: "Diary not found"
      })
    }

    const dairyPages = await prisma.diarypages.findFirst({
      where: {
        diary_id: diaryData.id,
        page_no: parseInt(page_no) || 1,
        status: "Published"
      },
    })

    const diaryPageDetails = {
      name: diaryData.name,
      featured_image_url: diaryData.featured_image_url,
      content: dairyPages.content,
      diarypage_featured_image: dairyPages.featured_image,
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      diaryPageDetails: diaryPageDetails,
    })
  }
  catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
}

exports.getUserDiaries = async (req, res) => {
  const { take, skip, user_uid } = req.query;

  try {
    const user = await prisma.users.findFirst({
      where: {
        uuid: user_uid
      }
    })

    if (!user) {
      await prisma.$disconnect();
      return res.status(200).json({
        status: "error",
        message: "User not found"
      });
    }

    const diaries = await prisma.diaries.findMany({
      where: {
        is_private: false,
        status: "Active",
        user_id: user.id,
        diarycontent: {
          some: {
            status: 'Published'
          }
        }
      },
      take: parseInt(take),
      skip: parseInt(skip),
      orderBy: { updated_at: "desc" },
      include: {
        userdetails: {
          select: {
            name: true,
            profile_image: true,
            email: true
          },
        },
        diarycontent: {
          where: {
            status: 'Published'
          },
          select: {
            content: true,
            page_no: true,
            updated_at: true,
            view_count: true,
            share_count: true,
            _count: {
              select: {
                diarycomments: true
              }
            },
            status: true
          },
          orderBy: {
            created_at: 'desc',
          },
          // take: 1,
        },
        diarylike: {
          where: {
            isliked: true
          },
          select: {
            id: true
          }
        }
      },
    });

    const totalDiariesCount = await prisma.diaries.count({
      where: {
        is_private: false,
        status: "Active",
        user_id: user.id,
        diarycontent: {
          some: {
            status: 'Published'
          }
        }
      },
    });

    const extractFirstImage = (html) => {
      if (!html) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = html.match(imgRegex);
      return match ? match[1] : null;
    };

    const diaryDetails = diaries.map((diary) => {
      const likesCount = diary.diarylike ? diary.diarylike.length : 0;
      const recentContent = diary.diarycontent[0];
      const firstPage = diary.diarycontent.find(content => content.page_no === 1);

      return {
        id: diary.id.toString(),
        uuid: diary?.uuid,
        user_id: diary.user_id?.toString() || null,
        author_name: diary.userdetails?.name || "Unknown",
        author_image: diary.userdetails?.profile_image,
        name: diary.name,
        featured_image_url: diary.featured_image_url,
        created_at: diary.created_at,
        updated_at: diary.updated_at,
        likes_count: likesCount,
        diarycontent: {
          content: recentContent?.content,
          page_no: recentContent?.page_no,
          content_image: extractFirstImage(recentContent?.content),
          view_count: recentContent?.view_count?.toString() || "0",
          share_count: recentContent?.share_count?.toString() || "0",
          comment_count: recentContent?._count?.diarycomments || 0,
          updated_at: recentContent?.updated_at
        }
      };
    });

    await prisma.$disconnect();
    return res.status(200).json({
      status: "success",
      diaries: diaryDetails,
      totalDiariesCount
    });
  } catch (err) {
    console.error(err);
    await prisma.$disconnect();
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

exports.getUserdetails = async (req, res) => {
  const { user_uid } = req.query;
  try {
    const user = await prisma.users.findFirst({
      where: {
        uuid: user_uid
      }
    })

    if (!user) {
      await prisma.$disconnect();
      return res.status(200).json({
        status: "error",
        message: "User not found"
      });
    }

    await prisma.$disconnect();
    return res.status(200).json({
      status: "success",
      userdetails: {
        user_id: user.id?.toString(),
        gender: user.gender,
        user_uid: user.uuid,
        name: user.name,
        email: user.email,
        profile_pic: user.profile_image,
        phone_number: user.phone_number,
        phone_code: user.phone_code
      }
    });
  } catch (err) {
    console.error(err);
    await prisma.$disconnect();
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}