const express = require('express');
const router = express.Router();

const chatController = require('../controllers/chatController');

//Admin-Diaries
router.get('/getchatusers', chatController.getChatUsers);
router.get('/getmessagesbetweenusers', chatController.getMessagesBetweenUsers);
router.get('/getuserbyid', chatController.getUserById);
router.post('/markmessagesasread', chatController.markMessagesAsRead);






module.exports = router;
