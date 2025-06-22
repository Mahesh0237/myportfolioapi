const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

router.get('/getallemployees', employeeController.GetAllEmployees);
router.post('/addemployee', employeeController.AddEmployee);
router.post('/updateemployee', employeeController.UpdateEmployee);
router.get('/getroles', employeeController.getRoles);
router.get('/getreportingheads', employeeController.getReportingHeads);
router.get('/getsingleemployeedata', employeeController.getSingleEmployeeData);
router.post('/deleteemployee', employeeController.DeleteEmployee);
router.post('/updateuserpassword', employeeController.updateUserPassword);
router.post('/addnewrole', employeeController.addNewRole);
router.get('/getallroledata', employeeController.getAllRoleData);

router.post('/updaterole', employeeController.updateRole);
router.post('/deleterole', employeeController.deleteRole);


module.exports = router;


