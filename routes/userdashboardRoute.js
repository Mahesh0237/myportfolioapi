const express = require('express');
const router = express.Router();

const userDashboardController = require('../controllers/userDashboardController');

router.get('/getlatestinvitationrequests', userDashboardController.getLatestInvitationRequests);
router.get('/getlatestdiarycomments', userDashboardController.getLatestDiaryComments);
router.get('/getlatestdiarys', userDashboardController.getLatestDiarys)
router.get('/getlatestinviteddiries', userDashboardController.getLatestInvitedDiries);

module.exports = router;