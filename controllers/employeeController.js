const jwt = require('jsonwebtoken')   // Import the jsonwebtoken library
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

const GetAllEmployees = async (req, res) => {
    const { page, limit, searchQuery } = req.query;
    try {
        let offset = 0;
        if (page > 1) {
            offset = limit * (page - 1);
        };

        const searchcondition = {
            user_type: 'employee',
            ...(searchQuery && {
                name: {
                    contains: searchQuery,
                    mode: 'insensitive'
                }
            })
        };

        const employees = await prisma.users.findMany({
            where: searchcondition,
            take: parseInt(limit),
            skip: offset,
            select: {
                id: true,
                uuid: true,
                name: true,
                email: true,
                phone_code: true,
                phone: true,
                role_id: true,
                gender: true,
                reporting_head_id: true,
                createdAt: true,
                roledetails: {
                    select: {
                        name: true,
                    }
                },
                reporting_head_details: {
                    select: {
                        name: true,
                    }
                },
                joinedAt: true,
                users_status: true,
            }
        });

        const totalEmployees = await prisma.users.count({
            where: searchcondition
        });

        const employedetails = employees.map(employee => {
            let role_name = null;
            let role_id = null;
            if (employee.role_id !== null) {
                role_name = employee.roledetails.name;
                role_id = employee.role_id?.toString();
            }

            let reporting_head_id = null;
            if (employee.reporting_head_id !== null) {
                reporting_head_id = employee?.reporting_head_id?.toString();
            }

            return {
                id: employee.id.toString(),
                uuid: employee.uuid,
                name: employee.name,
                email: employee.email,
                phone_code: employee.phone_code,
                phone: employee.phone,
                gender: employee.gender,
                role_name: employee.roledetails?.name,
                reporting_head_name: employee?.reporting_head_details?.name,
                joinedAt: employee.createdAt,
                status: employee.users_status
            }
        });

        await prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Employees fetched successfully',
            totalEmployees: totalEmployees,
            employees: employedetails,
            totalpages: Math.ceil(totalEmployees / limit)
        });

    } catch (error) {
        console.log(error);
        await prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        })
    }
}

const AddEmployee = async (req, res) => {
    const { name, email, phone, phone_code, gender, role_id, reporting_head, password } = req.body;

    try {
        const isEmailExist = await prisma.users.findFirst({
            where: {
                email: email,
                user_type: 'employee'
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
                phone: phone,
                phone_code: phone_code,
                user_type: 'employee'
            }
        })

        if (isPhoneExist) {
            return res.status(200).json({
                status: 'error',
                message: 'Phone number already exist'
            })
        }

        //generate the UUID and  hash the Password
        const uuid = "DIARYE" + Math.floor(100000000 + Math.random() * 900000000).toString();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        //create the new employee
        await prisma.users.create({
            data: {
                email: email,
                name: name,
                phone_code: phone_code,
                gender: gender,
                phone: phone,
                reporting_head_id: parseInt(reporting_head),
                role_id: parseInt(role_id),
                password: hashedPassword,
                uuid: uuid,
                user_type: 'employee',
            }
        })

        // disconnect the prisma client
        await prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Employee added successfully'
        })
    }
    catch (error) {
        console.log(error);
        await prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        })
    }
}

const getRoles = async (req, res) => {
    try {
        const roles = await prisma.roles.findMany({
            where: {
                NOT: {
                    name: "Super Admin"
                },
                status: 'Active'
            }
        });

        let data = [];
        if (roles !== null) {
            roles.map((role) => {
                data.push({
                    value: role.id.toString(),
                    label: role.name
                });
            });
        }

        await prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            roledata: data
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

const getReportingHeads = async (req, res) => {
    try {
        const reporting_head = await prisma.users.findMany({
            where: {
                user_type: 'employee',
            },
            select: {
                id: true,
                name: true
            }
        });

        if (reporting_head === null) {
            return res.status(200).json({
                status: 'error',
                message: 'No reporting heads found',
            });
        }
        const reporting_head_details = reporting_head.map((user) => {
            return {
                value: user.id.toString(),
                label: user.name
            };
        });

        return res.status(200).json({
            status: 'success',
            message: 'Reporting heads found',
            reporting_heads: reporting_head_details
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'An error occurred while retrieving reporting heads',
            error: error.message
        });
    }
};

const getSingleEmployeeData = async (req, res) => {
    const { single_user_id } = req.query;
    try {
        const employee = await prisma.users.findFirst({
            where: {
                id: BigInt(single_user_id)
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone_code: true,
                gender: true,
                phone: true,
                gender: true,
                role_id: true,
                reporting_head_id: true,
                roledetails: {
                    select: {
                        name: true,
                    }
                },
                reporting_head_details: {
                    select: {
                        name: true,
                    }
                },
                joinedAt: true,
                users_status: true,
            }
        });

        if (employee === null) {
            return res.status(200).json({
                status: 'error',
                message: 'Employee not found',
            });
        }
        let reporting_head_id = null;
        let reporting_head_details = null;
        if (employee.reporting_head_id !== null) {
            reporting_head_id = employee.reporting_head_id.toString();
            reporting_head_details = employee.reporting_head_details.name;
        }
        let role_id = null;
        let role_name = null;
        if (employee.role_id !== null) {
            role_id = employee.role_id.toString();
            role_name = employee.roledetails.name;
        }

        const employeeData = {
            id: employee.id.toString(),
            name: employee.name,
            email: employee.email,
            phone_code: employee.phone_code,
            phone: employee.phone,
            gender: employee.gender,
            role_id: role_id !== undefined ? role_id : null,
            role_name: role_name || null,
            reporting_head_id: reporting_head_id !== undefined ? reporting_head_id : null,
            reporting_head_name: reporting_head_details || null,
            joinedAt: employee.joinedAt,
            status: employee.users_status
        };

        return res.status(200).json({
            status: 'success',
            message: 'Employee found',
            employee_data: employeeData
        });

    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

const UpdateEmployee = async (req, res) => {
    const { singleuser_id, name, email, phone_code, phone, gender,
        role_id, reporting_head_id, joinedAt, status } = req.body;
    try {

        const isEmailExist = await prisma.users.findFirst({
            where: {
                email: email,
                user_type: 'employee',
                id: {
                    not: parseInt(singleuser_id)
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
                phone: phone,
                phone_code: phone_code,
                user_type: 'employee',
                id: {
                    not: parseInt(singleuser_id)
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
                id: BigInt(singleuser_id)
            },
            data: {
                name: name,
                email: email,
                phone_code: phone_code,
                gender: gender,
                phone: phone,
                role_id: role_id || null,
                reporting_head_id: reporting_head_id || null,
                joinedAt: joinedAt,
                users_status: status
            }
        });
        await prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Employee updated successfully'
        });

    }
    catch (error) {
        console.error(error);
        await prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

const DeleteEmployee = async (req, res) => {
    const { singleuser_id } = req.body;
    try {
        await prisma.users.delete({
            where: {
                id: BigInt(singleuser_id)
            }
        });
        await prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Employee deleted successfully'
        });
    }
    catch (error) {
        console.error(error);
        await prisma.$disconnect();
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

const updateUserPassword = async (req, res) => {
    const { singleuser_id, singleuser_password } = req.body;

    try {
        const user = await prisma.users.findUnique({
            where: {
                id: parseInt(singleuser_id), // Fixing BigInt issue
            },
        });
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
            });
        }

        // Hash the new password before storing
        const hashedPassword = await bcrypt.hash(singleuser_password, 10);

        // Update password in the database
        await prisma.users.update({
            where: {
                id: parseInt(singleuser_id), // Fixing BigInt issue
            },
            data: {
                password: hashedPassword,
            },
        });

        return res.status(200).json({
            status: 'success',
            message: 'Password updated successfully',
        });

    } catch (error) {
        console.error('Error updating password:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};

const addNewRole = async (req, res) => {
    const { role_name } = req.body;
    try {
        const isRoleExist = await prisma.roles.findFirst({
            where: {
                name: role_name
            }
        })
        if (isRoleExist) {
            return res.status(200).json({
                status: 'error',
                message: 'Role already exist'
            })
        }
        await prisma.roles.create({
            data: {
                name: role_name
            }
        })
        await prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Role added successfully'
        })
    }
    catch (error) {
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        })
    }
}

const getAllRoleData = async (req, res) => {
    const { page, limit } = req.query;
    try {
        let offset = 0;
        if (page > 1) {
            offset = (page - 1) * limit;
        }

        const roles = await prisma.roles.findMany({
            skip: offset,
            take: parseInt(limit),
        });

        const totalrolescount = await prisma.roles.count();

        let data = [];
        if (roles.length === 0) {
            data = [];
        } else {
            roles.forEach((role) => {
                data.push({
                    role_id: role.id.toString(),
                    role_name: role.name,
                    status: role.status
                });
            });
        }

        await prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            roledata: data,
            totalrolescount: totalrolescount,
            totalpages: Math.ceil(totalrolescount / limit),
            currentpage: parseInt(page)
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

const updateRole = async (req, res) => {
    const { role_name, role_id } = req.body;
    try {
        const isRoleExist = await prisma.roles.findFirst({
            where: {
                name: role_name,
                NOT: {
                    id: parseInt(role_id)
                }
            }
        })
        if (isRoleExist) {
            return res.status(200).json({
                status: 'error',
                message: 'Role already exist'
            })
        }
        await prisma.roles.update({
            where: {
                id: parseInt(role_id)
            },
            data: {
                name: role_name
            }
        })
        await prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Role updated successfully'
        })
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

const deleteRole = async (req, res) => {
    const { role_id } = req.body;
    try {
        await prisma.roles.delete({
            where: {
                id: parseInt(role_id)
            }
        })
        await prisma.$disconnect();
        return res.status(200).json({
            status: 'success',
            message: 'Role deleted successfully'
        })
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

module.exports = {
    GetAllEmployees,
    AddEmployee,
    getRoles,
    getReportingHeads,
    getSingleEmployeeData,
    UpdateEmployee,
    DeleteEmployee,
    updateUserPassword,
    addNewRole,
    getAllRoleData,
    updateRole,
    deleteRole,
};