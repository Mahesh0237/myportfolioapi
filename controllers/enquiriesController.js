const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const crypto = require('crypto');



// To Generate New Unique UUID for Enquiry(user)
const generateCustomUUID = () => {
  const randomPart = Math.floor(100000 + Math.random() * 900000); // 6-digit number
  return `DSE${randomPart}`;
};

exports.submitEnquiry = async (req, res) => {
  try {
    const { name, email, mobile, message, user_id, uuid } = req.body;

    const isGuest = !user_id;

    // generated UUID storing in customUUID
    const customUUID = generateCustomUUID();

    const enquiry = await prisma.enquiries.create({
      data: {
        name,
        email,
        mobile,
        message,
        // user_id: user_id ? BigInt(user_id) : null,
        user_id: user_id ? Number(user_id) : null,
        // uuid: uuid || null,
        uuid: customUUID,
        is_guest: isGuest,
      },
    });

    // Convert BigInt values to string for safe JSON serialization
    const sanitizedEnquiry = JSON.parse(
      JSON.stringify(enquiry, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    res.status(200).json({
      status: "success",
      message: "Enquiry submitted successfully",
      // enquiry: sanitizedEnquiry,
    });
  } catch (err) {
    console.error("Submit Enquiry Error:",err);
    res.status(500).json({
      status: "error",
      message: "Failed to submit enquiry",
    });
  }
};



// Helper function to recursively convert BigInt to string
function convertBigIntToString(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        typeof value === 'bigint' ? value.toString() : convertBigIntToString(value),
      ])
    );
  }
  return obj;
}


exports.getAllEnquiries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const [enquiries, totalCount] = await Promise.all([
      prisma.enquiries.findMany({
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
      }),
      prisma.enquiries.count(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Convert all BigInt fields to string before sending
    const sanitizedData = convertBigIntToString(enquiries);

    res.status(200).json({ data: sanitizedData, totalPages });
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};




exports.getSingleEnquiry = async (req, res) => {
  const { enquiry_id } = req.query;

  if (!enquiry_id) {
    return res.status(400).json({ status: 'error', message: 'Enquiry ID is required' });
  }

  const singleContact = await prisma.enquiries.findUnique({
    where: { id: BigInt(enquiry_id) },
  });

  if (!singleContact) {
    return res.status(404).json({ status: 'error', message: 'Enquiry not found' });
  }

    // Convert BigInt fields to string
    const formattedData = {
      name : singleContact.name,
      email: singleContact.email,
      mobile: singleContact.mobile,
      message:singleContact.message,
      is_guest:singleContact.is_guest,
      id: singleContact.id?.toString(),
      user_id: singleContact.user_id ? singleContact.user_id.toString() : null,
    };
  
    return res.status(200).json({
      status: 'success',
      singleContact: formattedData
    });
};
