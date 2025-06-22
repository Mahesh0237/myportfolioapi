const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getCountries = async (req, res) => {
    try {
        //connect Country model
        const country = await prisma.country.findMany();
        let data = [];
        if (country !== null) {
            country.map((country) => {
                data.push({
                    value: country.phone_code,
                    label: `+${country.phone_code}`
                });
            });
        }


        await prisma.$disconnect();

        return res.status(200).json({
            status: 'success',
            countrydata: data
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: `Internal server error`
        });
    }
}
