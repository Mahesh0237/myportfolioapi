const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const path = require("path");
const fs = require("fs");
const multiparty = require("multiparty");

exports.AddUser = async (req, res) => {
    const { first_name, email, phone_code, phone_number, gender, password } = req.body;

    try {
        // Check if email already exists
        const isUserEmailExists = await prisma.users.findFirst({
            where: {
                email: email,
                user_type: "user",
            },
        });

        if (isUserEmailExists) {
            return res.status(200).json({
                status: "error",
                message: "Email already exists",
            });
        }

        // Check if phone number already exists
        const isUserPhoneExists = await prisma.users.findFirst({
            where: {
                phone: phone_number,
                user_type: "user",
            },
        });

        if (isUserPhoneExists) {
            return res.status(200).json({
                status: "error",
                message: "Phone Number already exists",
            });
        }

        // Generate UUID and hash the password
        const uuid = "DIARYU" + Math.floor(100000000 + Math.random() * 900000000).toString();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new employee
        await prisma.users.create({
            data: {
                name: first_name,
                email: email,
                phone_code: phone_code,
                phone: phone_number,
                gender: gender,
                uuid: uuid,
                password: hashedPassword,
                user_type: "user",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });

        prisma.$disconnect();
        return res.status(200).json({
            status: "success",
            message: "Employee added successfully",
        });
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};

exports.GetUsers = async (req, res) => {
    const { page, limit = 10, searchQuery } = req.query;
    try {
        let offset = 0;
        if (page > 1) {
            offset = (page - 1) * limit;
        };

        const searchCondition = {
            user_type: 'user',
            ...(searchQuery && {
                name: {
                    contains: searchQuery,
                    mode: 'insensitive'
                }
            })
        };

        const users = await prisma.users.findMany({
            where: searchCondition,
            take: parseInt(limit),
            skip: (offset),
            select: {
                id: true,
                uuid: true,
                name: true,
                email: true,
                phone_code: true,
                phone: true,
                gender: true,
                users_status: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        const totalUsersCount = await prisma.users.count({
            where: searchCondition,
        });

        const userDetails = users.map((user) => ({
            id: user.id.toString(),
            uuid: user.uuid,
            name: user.name,
            email: user.email,
            phone_code: user.phone_code,
            phone_number: user.phone,
            gender: user.gender,
            users_status: user.users_status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }));
        prisma.$disconnect();
        return res.status(200).json({
            status: "success",
            users: userDetails,
            totalUsersCount,
            totalPages: Math.ceil(totalUsersCount / limit),
        });
    } catch (err) {
        console.log(err);
        prisma.$disconnect();
        return res.status(500).json({
            status: "error",
            message: "Internal server error",
        });
    }
};

exports.UpdateUser = async (req, res) => {
    const { first_name, email, phone_code, phone_number, gender, uuid } = req.body;

    try {
        //  get user by uuid
        const user = await prisma.users.findFirst({
            where: {
                uuid: uuid,
            },
            select: {
                id: true,
            }
        });

        const user_id = user?.id;

        const isEmailExist = await prisma.users.findFirst({
            where: {
                email: email,
                user_type: 'user',
                id: {
                    not: parseInt(user_id)
                }
            }
        })

        if (isEmailExist) {
            return res.status(200).json({
                status: 'error',
                message: 'Email already exist'
            })
        }

        //check if phone number already exist
        const isPhoneExist = await prisma.users.findFirst({
            where: {
                phone: phone_number,
                phone_code: phone_code,
                user_type: 'user',
                id: {
                    not: parseInt(user_id)
                }
            }
        })

        if (isPhoneExist) {
            return res.status(200).json({
                status: 'error',
                message: 'Phone number already exist'
            })
        }

        await prisma.users.update({
            where: {
                uuid: uuid,
            },
            data: {
                name: first_name,
                email: email,
                phone_code: phone_code,
                phone: phone_number,
                gender: gender,
                updatedAt: new Date(),
            },
        });

        prisma.$disconnect();
        return res.status(200).json({
            status: "success",
            message: "user details updated successfully",
        });
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};

exports.GetSingleUserData = async (req, res) => {
    const { single_user_uid } = req.query;
    try {
        const user = await prisma.users.findFirst({
            where: {
                uuid: single_user_uid
            },
            select: {
                id: true,
                uuid: true,
                name: true,
                email: true,
                phone_code: true,
                phone: true,
                gender: true,
                users_status: true,
            },
        });

        if (user === null) {
            return res.status(200).json({
                status: "error",
                message: "No user found",
            });
        }

        const usersData = {
            id: user.id.toString(),
            uuid: user.uuid,
            first_name: user.name,
            email: user.email,
            phone_code: user.phone_code,
            phone_number: user.phone,
            gender: user.gender,
            status: user.users_status,
        };

        prisma.$disconnect();
        res.status(200).json({
            status: "success",
            message: "App users fetched successfully",
            user_details: usersData,
        });
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};

exports.UpdateUserPassword = async (req, res) => {
    const { password, singleuser_uid } = req.body;

    try {
        const user = await prisma.users.findFirst({
            where: {
                uuid: singleuser_uid,
            },
        });

        if (!user) {
            return res.status(200).json({
                status: "error",
                message: "User not found",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await prisma.users.update({
            where: {
                uuid: singleuser_uid,
            },
            data: {
                password: hashedPassword,
            },
        });

        prisma.$disconnect();
        return res.status(200).json({
            status: "success",
            message: "Password updated successfully",
        });
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: "error",
            message: "Internal server error",
        });
    }
};

exports.DeleteUser = async (req, res) => {
    const { single_user_uid } = req.body;

    try {
        await prisma.users.delete({
            where: {
                uuid: single_user_uid,
            },
        });

        prisma.$disconnect();
        return res.status(200).json({
            status: "success",
            message: "User deleted Successfully",
        });
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};

exports.updateProfile = async (req, res) => {
    const form = new multiparty.Form();

    form.parse(req, async (error, fields, files) => {
        if (error) {
            prisma.$disconnect();
            return res.status(500).json({
                status: "error",
                message: error.message,
            });
        }

        const id = fields.userId?.[0];
        const name = fields.userName?.[0];
        const email = fields.userEmail?.[0];
        const phoneNumber = fields.userPhoneNumber?.[0];
        const gender = fields.userGender?.[0];
        const profilePic = files.profilePic?.[0];

        const isUser = await prisma.users.findFirst({
            where: {
                id: id
            },
            select: {
                uuid: true,
                profile_image_path: true,
                profile_image: true
            }
        })

        if (!isUser) {
            prisma.$disconnect();
            res.status(200).json({
                status: 'error',
                message: "User Not Found"
            })
        }

        let profilePicUrl = isUser.profile_image ? isUser.profile_image : null;
        let profilePicPath = isUser.profile_image_path ? isUser.profile_image_path : null;

        if (profilePic) {
            if (profilePicPath) {
                fs.unlink(profilePicPath, (err) => {
                    if (err) {
                        console.error('Error deleting image:', err);
                    }
                });
            }

            const uuid = isUser?.uuid;
            const uploadDir = path.join(__dirname, "../uploads", `${uuid}`);
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            // Get image path and move the file
            const tempImagePath = profilePic.path || profilePic.filepath;
            if (!tempImagePath) {
                prisma.$disconnect();
                return res.status(400).json({
                    status: "error",
                    message: "Image file path is missing",
                });
            }

            profilePicPath = path.join(uploadDir, profilePic.originalFilename);
            fs.copyFileSync(tempImagePath, profilePicPath);
            fs.unlinkSync(tempImagePath); // Remove the temporary file

            profilePicUrl = `${process.env.API_URL}/uploads/${uuid}/${profilePic.originalFilename}`;
        }

        try {
            // Update the team member record
            const updateduser = await prisma.users.update({
                where: { id: parseInt(id) }, // Ensure ID is parsed as an integer
                data: {
                    name: name,
                    email: email,
                    phone: phoneNumber,
                    gender: gender,
                    profile_image: profilePicUrl,
                    profile_image_path: profilePicPath
                },
            });

            const user_details = {
                user_id: updateduser.id.toString(),
                user_type: updateduser.user_type,
                uuid: updateduser.uuid,
                name: updateduser.name,
                email: updateduser.email,
                phone_code: updateduser.phone_code,
                phone_number: updateduser.phone,
                gender: updateduser.gender,
                profile_pic: updateduser.profile_image,
            }

            prisma.$disconnect();
            return res.status(200).json({
                status: "success",
                message: "Profile updated successfully",
                user_details: user_details,
            });
        } catch (error) {
            console.error("[Update user info Error]", error);
            prisma.$disconnect();
            return res.status(500).json({
                status: "error",
                message: error.message,
            });
        }
    });
};

exports.searchUsers = async (req, res) => {
    const { searchQuery, user_id } = req.query;
    try {
        let searchConditions = [];
        if (searchQuery) {
            searchConditions.push(
                { name: { contains: searchQuery, mode: 'insensitive' } },
                { email: { contains: searchQuery, mode: 'insensitive' } },
                { phone: { contains: searchQuery, mode: 'insensitive' } },
            );
        }

        const users = await prisma.users.findMany({
            where: {
                ...searchConditions.length > 0 ? { OR: searchConditions } : {},
                user_type: 'user',
                id: {
                    not: parseInt(user_id)
                }
            },
            select: {
                id: true,
                uuid: true,
                name: true,
                email: true,
                phone_code: true,
                phone: true,
            }
        });
        const userDetails = users.map((user) => ({
            value: user.id.toString(),
            label: user.name
        }));

        prisma.$disconnect();
        return res.status(200).json({
            status: "success",
            users: userDetails,
        });
    }
    catch (err) {
        console.log(err);
        prisma.$disconnect();
        return res.status(500).json({
            status: "error",
            message: "Internal server error",
        });
    }
}