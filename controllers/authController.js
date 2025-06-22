const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken')

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient();

const AuthAdminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.users.findFirst({
      where: {
        email: email,
        user_type: "employee"
      }
    })

    if (!user) {
      return res.status(200).json({
        status: 'error_user_not_found',
        message: 'User not found'
      })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(200).json({
        status: 'error_invalid_password',
        message: 'Invalid Password'
      })
    }

    let user_id = user.id.toString();

    const access_token = jwt.sign({ user_id: user_id }, process.env.JWT_SECRET, { expiresIn: '7d' })

    let user_details = {
      user_id: user_id,
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      phone_code: user.phone_code,
      phone: user.phone,
      user_type: user.user_type,
      profile_pic: user.profile_image,
    }

    await prisma.$disconnect()
    return res.status(200).json({
      status: 'success',
      message: 'User logged in successfully',
      user_details: user_details,
      access_token: access_token,
    })

  } catch (error) {
    console.log(error);
    await prisma.$disconnect()
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    })
  }

}

const PasswordGenerator = async (req, res) => {
  const { password } = req.query;
  //create hash
  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(password, salt);

  return res.status(200).json({
    status: 'success',
    message: 'Password generated successfully',
    password: password,
    hash_password: hashPassword
  });
}

const AuthLogin = async (req, res) => {
  const { email, password, diaryuid, diary_access_token, sender_uid } = req.body;
  try {
    const user = await prisma.users.findFirst({
      where: {
        email: email,
        user_type: "user"
      }
    });

    if (!user) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error_user_not_found',
        message: 'User not found'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error_invalid_password',
        message: 'Invalid password'
      });
    }

    let user_id = user.id.toString();

    // generate a access token
    const access_token = jwt.sign({ user_id: user_id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    let user_details = {
      user_id: user.id.toString(),
      user_type: user.user_type,
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      phone_code: user.phone_code,
      phone_number: user.phone,
      gender: user.gender,
      profile_pic: user.profile_image,
    }

    if (diary_access_token && sender_uid && diaryuid) {

      const diary = await prisma.diaries.findFirst({
        where: {
          uuid: diaryuid
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

      const sender = await prisma.users.findFirst({
        where: {
          uuid: sender_uid
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

      const isInvitation = await prisma.diaryinvitations.findFirst({
        where: {
          sender_id: sender?.id,
          diary_id: diary?.id,
          receiver_id: user?.id
        },
        select: {
          id: true
        }
      })

      if (!isInvitation) {
        const invitation_uuid = "DIARYINV" + Math.floor(100000 + Math.random() * 900000);
        await prisma.diaryinvitations.create({
          data: {
            uuid: invitation_uuid,
            sender_id: sender?.id,
            diary_id: diary?.id,
            receiver_id: user?.id,
            status: "Pending"
          }
        })
      }
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'User logged in successfully',
      user_details: user_details,
      access_token: access_token
    });
  }
  catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}


const AuthRegister = async (req, res) => {
  const { first_name, last_name, email, phoneCode, phoneNumber, password, diaryuid, diary_access_token, sender_uid } = req.body;

  try {
    const existingUser = await prisma.users.findFirst({
      where: {
        email: email,
      }
    });

    if (existingUser) {
      prisma.$disconnect();
      return res.status(200).json({
        status: 'error_user_exists',
        message: 'user already exists'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    let uid_type = 'DIARYU';

    const uuid = uid_type + Math.floor(100000 + Math.random() * 900000);
    const newUser = await prisma.users.create({
      data: {
        uuid: uuid,
        name: first_name + " " + last_name,
        email: email,
        phone_code: phoneCode,
        phone: phoneNumber,
        password: hashPassword,
      }
    });

    let user_id = newUser.id.toString();

    // generate a access token
    const access_token = jwt.sign({ user_id: user_id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    let user_details = {
      user_id: newUser.id.toString(),
      user_type: newUser.user_type,
      uuid: newUser.uuid,
      name: newUser.name,
      email: newUser.email,
      phone_code: newUser.phone_code,
      phone_number: newUser.phone,
      gender: newUser.gender,
      profile_pic: newUser.profile_image,
    }

    if (diary_access_token && sender_uid && diaryuid) {

      const diary = await prisma.diaries.findFirst({
        where: {
          uuid: diaryuid
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

      const sender = await prisma.users.findFirst({
        where: {
          uuid: sender_uid
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

      const isInvitation = await prisma.diaryinvitations.findFirst({
        where: {
          sender_id: sender?.id,
          diary_id: diary?.id,
          receiver_id: newUser?.id
        },
        select: {
          id: true
        }
      })

      if (!isInvitation) {
        const invitation_uuid = "DIARYINV" + Math.floor(100000 + Math.random() * 900000);
        await prisma.diaryinvitations.create({
          data: {
            uuid: invitation_uuid,
            sender_id: sender?.id,
            diary_id: diary?.id,
            receiver_id: newUser?.id,
            status: "Pending"
          }
        })
      }
    }

    prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'User created successfully',
      user_details: user_details,
      access_token: access_token
    });
  }
  catch (error) {
    console.log(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}



const isUserExists = async (req, res) => {
  const { email } = req.query;

  try {
    const user = await prisma.users.findUnique({
      where: { email }
    });

    prisma.$disconnect();

    if (!user) {
      await prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Email does not exist',
        is_userexist: false
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now

    // Save OTP and expiry in DB
    await prisma.users.update({
      where: { email },
      data: {
        otp,
        otp_expiry: otpExpiry,
        is_verified: false
      }
    });

    console.log(`Generated OTP for ${email}: ${otp}`);
    ////////////////////////////////////////////

    prisma.$disconnect();

    return res.status(200).json({
      status: 'success',
      message: 'User found',
      is_userexist: true
    });
  } catch (error) {
    console.error(error);
    prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      is_userexist: false
    });
  }
};


const resetPassword = async (req, res) => {
  const { email, otp, new_password } = req.body;

  try {
    const user = await prisma.users.findUnique({
      where: { email }
    });

    if (!user) {
      await prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Validate OTP
    if (!user.otp || user.otp !== otp) {
      await prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'Invalid OTP'
      });
    }

    // Check if OTP expired
    const now = new Date();
    if (!user.otp_expiry || new Date(user.otp_expiry) < now) {
      await prisma.$disconnect();
      return res.status(200).json({
        status: 'error',
        message: 'OTP has expired'
      });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    await prisma.users.update({
      where: { email },
      data: {
        password: hashedPassword,
        otp: null,
        otp_expiry: null,
        is_verified: true
      }
    });

    await prisma.$disconnect();
    return res.status(200).json({
      status: 'success',
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error(error);
    await prisma.$disconnect();
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};



module.exports = {
  AuthAdminLogin,
  PasswordGenerator,
  AuthRegister,
  AuthLogin,
  isUserExists,
  resetPassword
};