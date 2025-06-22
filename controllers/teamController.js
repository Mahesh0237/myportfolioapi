const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const path = require("path");

const multiparty = require("multiparty");
const fs = require("fs");
const deleteEmptyFolders = require("../helper/deleteEmptyFolders");

exports.addTeamMember = async (req, res) => {
  const form = new multiparty.Form();

  form.parse(req, async (error, fields, files) => {
    if (error) {
      prisma.$disconnect();
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }

    const name = fields.name?.[0];
    const designation = fields.designation?.[0];
    const experience = fields?.experience?.[0] || "";
    const imageFile = files.image?.[0];

    // Validate fields
    if (!name || !designation || !imageFile) {
      prisma.$disconnect();
      return res.status(200).json({
        status: "error",
        message:
          "All fields (name, designation, image) are required",
      });
    }

    // Generate UUID for file path
    const uuid =
      "DST" + Math.floor(100000 + Math.random() * 900000).toString();
    const uploadDir = path.join(__dirname, "../uploads", `${uuid}`);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Get image path and move file
    const tempImagePath = imageFile.path || imageFile.filepath;
    if (!tempImagePath) {
      prisma.$disconnect();
      return res.status(400).json({
        status: "error",
        message: "Image file path is missing",
      });
    }

    const imagePath = path.join(uploadDir, imageFile.originalFilename);
    fs.copyFileSync(tempImagePath, imagePath);
    fs.unlinkSync(tempImagePath); // Remove temp file

    const imageUrl = `${process.env.API_URL}/uploads/${uuid}/${imageFile.originalFilename}`;

    try {
      const newMember = await prisma.team.create({
        data: {
          name,
          designation,
          experience,
          profile_image_url: imageUrl,
          profile_image_path: imagePath,
          uuid,
        },
      });

      prisma.$disconnect();
      return res.status(201).json({
        status: "success",
        message: "Team member added successfully",
      });
    } catch (error) {
      console.error("[Add Team Member Error]", error);
      prisma.$disconnect();
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  });
};

// exports.updateTeamMember = async (req, res) => {
//   const form = new multiparty.Form();

//   form.parse(req, async (error, fields, files) => {
//     if (error) {
//       prisma.$disconnect();
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     console.log("fields:", fields);
//     console.log("files:", files);

//     const id = fields.id?.[0]; // Get team member ID
//     const name = fields.first_name?.[0];
//     const designation = fields.designation?.[0];
//     const experience = fields.experience?.[0] || "";
//     const imageFile = files.image?.[0]; // If an image is uploaded, it will be here

//     // Validate fields
//     if (!id || !name || !designation) {
//       prisma.$disconnect();
//       return res.status(400).json({
//         status: "error",
//         message: "ID, name, designation are required",
//       });
//     }

//     // Generate UUID for file path if a new image is uploaded
//     let imageUrl = null;
//     let imagePath = null;

//     if (imageFile) {
//       const uuid =
//         "TEAM" + Math.floor(100000 + Math.random() * 900000).toString();
//       const uploadDir = path.join(__dirname, "../uploads", `${uuid}`);
//       if (!fs.existsSync(uploadDir)) {
//         fs.mkdirSync(uploadDir, { recursive: true });
//       }

//       // Get image path and move the file
//       const tempImagePath = imageFile.path || imageFile.filepath;
//       if (!tempImagePath) {
//         prisma.$disconnect();
//         return res.status(400).json({
//           status: "error",
//           message: "Image file path is missing",
//         });
//       }

//       imagePath = path.join(uploadDir, imageFile.originalFilename);
//       fs.copyFileSync(tempImagePath, imagePath);
//       fs.unlinkSync(tempImagePath); // Remove the temporary file

//       imageUrl = `${process.env.API_URL}/uploads/${uuid}/${imageFile.originalFilename}`;
//     }

//     try {
//       // Update the team member record
//       const updatedMember = await prisma.team.update({
//         where: { id: parseInt(id) }, // Ensure ID is parsed as an integer
//         data: {
//           name,
//           designation,
//           experience,
//           profile_image_url: imageUrl || undefined,
//           profile_image_path: imagePath || undefined,
//         },
//       });

//       const dataDetails = {
//         id: updatedMember.id.toString(),
//         name: updatedMember.name,
//         designation: updatedMember.designation,
//         experience: updatedMember?.experience,
//         imageUrl: updatedMember.profile_image_url,
//       };

//       prisma.$disconnect();
//       return res.status(200).json({
//         status: "success",
//         message: "Team member updated successfully",
//         data: dataDetails,
//       });
//     } catch (error) {
//       console.error("[Update Team Member Error]", error);
//       prisma.$disconnect();
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }
//   });
// };

// Admin-API


exports.updateTeamMember = async (req, res) => {
  const form = new multiparty.Form();

  form.parse(req, async (error, fields, files) => {
    if (error) {
      prisma.$disconnect();
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }

    const id = fields.id?.[0];
    const name = fields.first_name?.[0];
    const designation = fields.designation?.[0];
    const experience = fields.experience?.[0] || "";
    const imageFile = files.image?.[0];

    if (!id || !name || !designation) {
      prisma.$disconnect();
      return res.status(400).json({
        status: "error",
        message: "ID, name, designation are required",
      });
    }

    let imageUrl = null;
    let imagePath = null;

    try {
      // 1. Fetch the existing member to get the old image path
      const existingMember = await prisma.team.findUnique({
        where: { id: parseInt(id) },
      });

      if (!existingMember) {
        prisma.$disconnect();
        return res.status(404).json({
          status: "error",
          message: "Team member not found",
        });
      }

      if (imageFile) {
        // 2. Generate new path for the new image
        const uuid = "TEAM" + Math.floor(100000 + Math.random() * 900000).toString();
        const uploadDir = path.join(__dirname, "../uploads", `${uuid}`);

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const tempImagePath = imageFile.path || imageFile.filepath;
        if (!tempImagePath) {
          prisma.$disconnect();
          return res.status(400).json({
            status: "error",
            message: "Image file path is missing",
          });
        }

        imagePath = path.join(uploadDir, imageFile.originalFilename);
        fs.copyFileSync(tempImagePath, imagePath);
        fs.unlinkSync(tempImagePath); // Delete temp file

        imageUrl = `${process.env.API_URL}/uploads/${uuid}/${imageFile.originalFilename}`;

        // 3. Delete the old image file if exists
        if (existingMember.profile_image_path && fs.existsSync(existingMember.profile_image_path)) {
          fs.unlinkSync(existingMember.profile_image_path);
        }
      }

      // 4. Update DB record
      const updatedMember = await prisma.team.update({
        where: { id: parseInt(id) },
        data: {
          name,
          designation,
          experience,
          profile_image_url: imageUrl || existingMember.profile_image_url,
          profile_image_path: imagePath || existingMember.profile_image_path,
        },
      });

      const dataDetails = {
        id: updatedMember.id.toString(),
        name: updatedMember.name,
        designation: updatedMember.designation,
        experience: updatedMember.experience,
        imageUrl: updatedMember.profile_image_url,
      };

      prisma.$disconnect();
      return res.status(200).json({
        status: "success",
        message: "Team member updated successfully",
        data: dataDetails,
      });

    } catch (error) {
      console.error("[Update Team Member Error]", error);
      prisma.$disconnect();
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  });
};

exports.getAllTeamMembers = async (req, res) => {
  const { page = 1, limit = 10, searchQuery = "" } = req.query;

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Optional search filter on name or designation
    const whereClause = searchQuery
      ? {
        OR: [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { designation: { contains: searchQuery, mode: "insensitive" } },
        ],
      }
      : {};

    const totalCount = await prisma.team.count({
      where: whereClause,
    });
    const members = await prisma.team.findMany({
      where: whereClause,
      skip: skip,
      take: parseInt(limit),
      orderBy: {
        created_at: "desc",
      },
    });

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    const dataDetails = members.map((member) => ({
      id: member.id.toString(),
      uuid: member.uuid,
      name: member.name,
      designation: member.designation,
      experience: member.experience,
      profile_image_url: member.profile_image_url,
    }));

    prisma.$disconnect();
    return res.status(200).json({
      status: "success",
      message: "Team members fetched successfully",
      data: dataDetails,
      page: parseInt(page),
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error("[Get Team Members Error]", error);
    prisma.$disconnect();
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

exports.getSingleTeamMember = async (req, res) => {
  const { single_member_id } = req.body;
  try {
    const member = await prisma.team.findUnique({
      where: {
        uuid: single_member_id,
      },
    });

    if (!member) {
      return res.status(404).json({
        status: "error",
        message: "Team member not found",
      });
    }

    const dataDetails = {
      id: member.id.toString(),
      name: member.name,
      designation: member.designation,
      experience: member.experience,
      profile_image_url: member.profile_image_url,
    };

    prisma.$disconnect();
    return res.status(200).json({
      status: "success",
      message: "Team member fetched successfully",
      data: dataDetails,
    });
  } catch (error) {
    console.error("[Get Single Team Member Error]", error);
    prisma.$disconnect();
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

exports.DeleteMember = async (req, res) => {
  const { singleMember_id } = req.body;

  try {
    const isMemebr = await prisma.team.findFirst({
      where: {
        uuid: singleMember_id,
      },
      select: {
        profile_image_path: true,
      },
    });

    if (!isMemebr) {
      prisma.$disconnect();
      res.status(200).json({
        status: "error",
        message: "Team Member Not Exist",
      });
    }

    if (isMemebr?.profile_image_path) {
      const imagePath = isMemebr.profile_image_path;

      // Check if file exists before trying to delete
      if (fs.existsSync(imagePath)) {
        fs.unlink(imagePath, (err) => {
          if (err) {
            console.error("Error deleting image:", err);
          }
        });
      } else {
        console.warn("File not found:", imagePath);
      }
    }

    await prisma.team.delete({
      where: {
        uuid: singleMember_id,
      },
    });

    deleteEmptyFolders();

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
      message: "Internal server error",
    });
  }
};

//Frontend API- to get all team-Members
exports.getAllTeamMembersFrontend = async (req, res) => {
  try {
    const members = await prisma.team.findMany({
      orderBy: {
        created_at: "desc",
      },
    });

    const dataDetails = members.map((member) => ({
      id: member.id.toString(),
      name: member.name,
      designation: member.designation,
      experience: member.experience,
      profile_image_url: member.profile_image_url,
    }));

    prisma.$disconnect();
    return res.status(200).json({
      status: "success",
      message: "Team members fetched successfully",
      data: dataDetails,
      totalCount: dataDetails.length,
    });
  } catch (error) {
    console.error("[Get Team Members Error]", error);
    prisma.$disconnect();
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
