const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/adduser', userController.AddUser);
router.get('/getusers', userController.GetUsers);
router.post('/updateusers', userController.UpdateUser);
router.get('/getsingleuserdata', userController.GetSingleUserData);
router.post('/updateuserpassword', userController.UpdateUserPassword);
router.post('/deleteuser', userController.DeleteUser);
router.post('/updateprofile', userController.updateProfile);
router.get('/searchusers', userController.searchUsers);

module.exports = router;
