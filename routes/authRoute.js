const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

router.post('/admin/login', authController.AuthAdminLogin);
router.get('/passwordgenerator', authController.PasswordGenerator);


router.post('/login', authController.AuthLogin);
router.post('/register', authController.AuthRegister);

router.get('/isuserexists', authController.isUserExists);
router.post('/resetpassword', authController.resetPassword);




module.exports = router;