const express = require('express');
const router = express.Router();

const teamController = require('../controllers/teamController');


router.post('/addteammember', teamController.addTeamMember);
router.get('/getallteammembers', teamController.getAllTeamMembers);
router.post('/getsingleteammember', teamController.getSingleTeamMember);
router.post('/updateteammember', teamController.updateTeamMember);

router.post('/deletemember', teamController.DeleteMember);

router.get('/getallteammembersfrontend', teamController.getAllTeamMembersFrontend);






module.exports = router;
