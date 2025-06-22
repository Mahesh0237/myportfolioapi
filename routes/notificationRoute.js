const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notificationController');

router.get('/getnotifications', notificationController.getNotifications);
router.post('/marknotificationasread', notificationController.markNotificationAsRead);
router.post('/clearallnotifications', notificationController.clearAllNotifications);
router.get('/getunreadnotificationcount', notificationController.getUnreadNotificationCount);

module.exports = router;