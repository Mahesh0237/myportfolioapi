const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const multiparty = require('multiparty');

exports.getCompanyInfo = async (req, res) => {
    try {
        const companyInfo = await prisma.companyinfo.findFirst({
            where: {
                id: 1
            },
            select: {
                companyname: true,
                address_one: true,
                address_two: true,
                city: true,
                state: true,
                zipcode: true,
                country: true,
                phone: true,
                phone_code: true,
                email: true
            }
        });
        let companyDetails = {};

        if (companyInfo) {
            companyDetails = {
                name: companyInfo.companyname,
                address_line1: companyInfo.address_one,
                address_line2: companyInfo.address_two,
                city: companyInfo.city,
                state: companyInfo.state,
                zip_code: companyInfo.zipcode,
                country: companyInfo.country,
                phone: companyInfo.phone,
                email: companyInfo.email,
                phone_code: companyInfo.phone_code
            };
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Company details retrieved successfully',
            companyinfo: companyDetails
        });
    } catch (error) {
        console.error(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

exports.getCompanyLogos = async (req, res) => {
    try {
        const companyInfo = await prisma.companyinfo.findFirst({
            where: {
                id: 1
            },
            select: {
                dark_logo_url: true,
                white_logo_url: true,
                favicon_url: true
            }
        });

        let logoUrls = {};

        if (companyInfo) {
            logoUrls = {
                light_logo: companyInfo.white_logo_url,
                dark_logo: companyInfo.dark_logo_url,
                favicon: companyInfo.favicon_url
            };
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Company details retrieved successfully',
            logoUrls: logoUrls
        });
    } catch (error) {
        console.error(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

exports.updateCompanyInfo = async (req, res) => {
    const { company_name, email, phone, addressone, addresstwo, city, state, country, pincode } = req.body;

    try {
        const isCompanyInfoExists = await prisma.companyinfo.findFirst({
            where: {
                id: 1
            }
        });
        if (!isCompanyInfoExists) {
            await prisma.companyinfo.create({
                data: {
                    companyname: company_name,
                    email: email,
                    phone: phone,
                    phone_code: '+91',
                    address_one: addressone,
                    address_two: addresstwo,
                    city: city,
                    state: state,
                    country: country,
                    zipcode: pincode.toString()
                }
            });
        } else {
            await prisma.companyinfo.update({
                where: {
                    id: 1
                },
                data: {
                    companyname: company_name,
                    email: email,
                    phone: phone,
                    phone_code: '+91',
                    address_one: addressone,
                    address_two: addresstwo,
                    city: city,
                    state: state,
                    country: country,
                    zipcode: pincode.toString()
                }
            });
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Company details updated successfully'
        });
    }
    catch (error) {
        console.error(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

exports.updateLogos = async (req, res) => {
    const form = new multiparty.Form();

    form.parse(req, async (err, fields, files) => {
        // Handle parsing errors
        if (err) {
            prisma.$disconnect();
            return res.status(500).json({
                status: 'error',
                message: err.message
            });
        }

        // Accessing uploaded files and form fields
        const lightLogo = files.lightlogo ? files.lightlogo[0] : null; // First element in the array
        const darkLogo = files.darklogo ? files.darklogo[0] : null;
        const favicon = files.favicon ? files.favicon[0] : null;

        // Main directory for the customer
        const maindir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(maindir)) {
            fs.mkdirSync(maindir, { recursive: true });
        }

        const folderdir = path.join(maindir, 'logos');
        if (!fs.existsSync(folderdir)) {
            fs.mkdirSync(folderdir, { recursive: true });
        }

        const moveFile = (tempPath, targetPath) => {
            fs.copyFileSync(tempPath, targetPath); // Copy the file
            fs.unlinkSync(tempPath); // Delete the original file
        };

        const paths = {
            lightLogoPath: null,
            darkLogoPath: null,
            faviconPath: null
        };

        try {
            // Get current logo paths from the database
            const company = await prisma.companyinfo.findFirst({
                where: {
                    id: 1
                },
                select: {
                    white_logo_path: true,
                    white_logo_url: true,
                    dark_logo_path: true,
                    dark_logo_url: true,
                    favicon_path: true,
                    favicon_url: true
                }
            });

            if (!company) {
                prisma.$disconnect();
                return res.status(200).json({
                    status: 'error',
                    message: "Company doesn't exist"
                })
            }

            // Only move and update the file if it exists in the request
            if (lightLogo) {
                const lightLogoPath = path.join(folderdir, lightLogo.originalFilename);
                moveFile(lightLogo.path, lightLogoPath);
                paths.lightLogoPath = lightLogoPath;
            } else {
                paths.lightLogoPath = company.white_logo_path;
            }

            if (darkLogo) {
                const darkLogoPath = path.join(folderdir, darkLogo.originalFilename);
                moveFile(darkLogo.path, darkLogoPath);
                paths.darkLogoPath = darkLogoPath;
            } else {
                paths.darkLogoPath = company.dark_logo_path;
            }

            if (favicon) {
                const faviconPath = path.join(folderdir, favicon.originalFilename);
                moveFile(favicon.path, faviconPath);
                paths.faviconPath = faviconPath;
            } else {
                paths.faviconPath = company.favicon_path;
            }

            const baseUrl = `${process.env.API_URL}/uploads/logos/`;

            const removeOldFiles = (folderPath, validPaths) => {
                const filesInFolder = fs.readdirSync(folderPath);
                filesInFolder.forEach((file) => {
                    const filePath = path.join(folderPath, file);
                    // If the file is not in the validPaths, remove it
                    if (!validPaths.includes(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                });
            };

            const validPaths = [
                paths.lightLogoPath && path.join(folderdir, path.basename(paths.lightLogoPath)),
                paths.darkLogoPath && path.join(folderdir, path.basename(paths.darkLogoPath)),
                paths.faviconPath && path.join(folderdir, path.basename(paths.faviconPath))
            ].filter(Boolean); // Filter out null values

            removeOldFiles(folderdir, validPaths);

            // Update the database with new or existing paths
            await prisma.companyinfo.update({
                where: {
                    id: 1
                },
                data: {
                    white_logo_path: paths.lightLogoPath ? `${paths.lightLogoPath}` : company.white_logo_path,
                    white_logo_url: paths.lightLogoPath ? `${baseUrl}${path.basename(paths.lightLogoPath)}` : company.white_logo_url,
                    dark_logo_path: paths.darkLogoPath ? `${paths.darkLogoPath}` : company.dark_logo_path,
                    dark_logo_url: paths.darkLogoPath ? `${baseUrl}${path.basename(paths.darkLogoPath)}` : company.dark_logo_url,
                    favicon_path: paths.faviconPath ? `${paths.faviconPath}` : company.favicon_path,
                    favicon_url: paths.faviconPath ? `${baseUrl}${path.basename(paths.faviconPath)}` : company.favicon_url
                }
            });

            await prisma.$disconnect();
            return res.status(200).json({
                status: 'success',
                message: 'Logos uploaded successfully'
            });
        } catch (error) {
            console.log(error);
            prisma.$disconnect();
            return res.status(500).json({
                status: 'error',
                message: 'Internal server error',
                error: error.message
            });
        }
    });
}

exports.updateSocialMediaLinks = async (req, res) => {
    const { facebook, twitter, instagram, linkedin, youtube } = req.body;

    try {
        const isCompanyInfoExists = await prisma.companyinfo.findFirst({
            where: {
                id: 1
            }
        });

        if (!isCompanyInfoExists) {
            await prisma.companyinfo.create({
                data: {
                    facebook_url: facebook,
                    twitter_url: twitter,
                    instagram_url: instagram,
                    linkedin_url: linkedin,
                    youtube_url: youtube
                }
            });
        } else {
            await prisma.companyinfo.update({
                where: {
                    id: 1
                },
                data: {
                    facebook_url: facebook,
                    twitter_url: twitter,
                    instagram_url: instagram,
                    linkedin_url: linkedin,
                    youtube_url: youtube
                }
            });
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Social media links updated successfully'
        });
    }
    catch (error) {
        console.error(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

exports.getSocialMediaLinks = async (req, res) => {
    try {
        const companyInfo = await prisma.companyinfo.findFirst({
            where: {
                id: 1
            },
            select: {
                facebook_url: true,
                twitter_url: true,
                instagram_url: true,
                linkedin_url: true,
                youtube_url: true
            }
        });

        let socialMediaLinks = {};

        if (companyInfo) {
            socialMediaLinks = {
                facebook: companyInfo.facebook_url,
                twitter: companyInfo.twitter_url,
                instagram: companyInfo.instagram_url,
                linkedin: companyInfo.linkedin_url,
                youtube: companyInfo.youtube_url
            };
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Company details retrieved successfully',
            socialmedialinks: socialMediaLinks
        });
    } catch (error) {
        console.error(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

exports.getAllCompnayInfo = async (req, res) => {
    try {
        const companyInfo = await prisma.companyinfo.findFirst({
            where: {
                id: 1
            },
            select: {
                companyname: true,
                address_one: true,
                address_two: true,
                city: true,
                state: true,
                zipcode: true,
                country: true,
                phone: true,
                phone_code: true,
                email: true,
                white_logo_url: true,
                dark_logo_url: true,
                favicon_url: true,
                facebook_url: true,
                twitter_url: true,
                instagram_url: true,
                linkedin_url: true,
                youtube_url: true
            }
        });
        let companyDetails = {};

        if (companyInfo) {
            companyDetails = {
                name: companyInfo.companyname,
                address_line1: companyInfo.address_one,
                address_line2: companyInfo.address_two,
                city: companyInfo.city,
                state: companyInfo.state,
                zip_code: companyInfo.zipcode,
                country: companyInfo.country,
                phone: companyInfo.phone,
                email: companyInfo.email,
                phone_code: companyInfo.phone_code,
                light_logo: companyInfo.white_logo_url,
                dark_logo: companyInfo.dark_logo_url,
                favicon: companyInfo.favicon_url,
                facebook: companyInfo.facebook_url,
                twitter: companyInfo.twitter_url,
                instagram: companyInfo.instagram_url,
                linkedin: companyInfo.linkedin_url,
                youtube: companyInfo.youtube_url
            };
        }

        prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Company details retrieved successfully',
            companyinfo: companyDetails
        });
    } catch (error) {
        console.error(error);
        prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}
