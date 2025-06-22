const express = require('express');
const router = express.Router();

const diaryController = require('../controllers/diaryController');

//Admin-Diaries
router.get('/getdiaries', diaryController.GetDiaries);
router.get('/getadminsingleviewdairydata', diaryController.getAdminSingleViewDairyData);
router.get('/getadmindiarycomments', diaryController.getAdminDiaryComments);
router.get('/getadmindiarypages', diaryController.getAdminDiaryPages);
router.post('/suspendorunsuspenddiary', diaryController.suspendOrUnsuspenddiary);
router.post('/admindeletediary', diaryController.adminDeleteDiary);
router.post('/featuredorunfeatureddiary', diaryController.featuredOrUnfeaturedDiary);

//Frontend-Diaries
router.get('/getfrontenddiaries', diaryController.getFrontendDiaries);
router.get('/getlatestdiaries', diaryController.getLatestDiaries);
router.get('/getfeatureddiaries', diaryController.getFeaturedDiaries);
router.get('/getMyDiaries', diaryController.getMyDiaries);
router.get('/getcategories', diaryController.getCategories);
router.get('/getsinglediarydataforedit', diaryController.getSingleDiaryData);
router.post('/adddiary', diaryController.addDiary);
router.post('/addpagecontent', diaryController.addPageContent);
router.post('/editdiary', diaryController.editDiary);
router.post('/deletediary', diaryController.deleteDiary);
router.get('/getmysingledairydata', diaryController.getSingleViewDairyData);
router.get('/getsingledairydata', diaryController.getSingleDairyData);
router.get('/getdiarypages', diaryController.getDiaryPages);
router.post('/postcomment', diaryController.postComment);
router.get('/getdiarycomments', diaryController.getDiaryComments);
router.post('/postcommentondiary', diaryController.postCommentonDiary);
router.post('/postreplycommentondiary', diaryController.postReplyCommentonDiary);
router.post('/updatediarypagecontent', diaryController.updateDiarypageContent);
router.post('/likecomment', diaryController.likeComment);
router.post('/senddiaryinvitation', diaryController.sendDiaryInvitation);
router.get('/getinviteddiaries', diaryController.getInvitedDiaries);
router.get('/getgroupinviteddiaries', diaryController.getGroupInvitedDiaries)
router.post('/senddiaryinvitationtogroupmember', diaryController.sendDiaryInvitationToGroupMembers);
router.get('/getdiaryinvitationdetails', diaryController.getDiaryInvitationDetails)
router.get('/getgroupdiaryinvitationdetails', diaryController.getGroupDiaryInvitationDetails)
router.post('/generatediarysharetoken', diaryController.generateDiaryShareToken);
router.post('/generatediarysharetokentogroupmember', diaryController.generateDiaryShareTokenToGroupMembers);
router.post('/invitationstatusupdate', diaryController.invitationStatusUpdate);
router.post('/acceptrejectdiaryinvitation', diaryController.acceptRejectDiaryInvitation)
router.get('/getdiarygroupmembers', diaryController.getDiaryGroupMembers);
router.post('/subscribediary', diaryController.subscribeDiary);
router.get('/getsubscriptiondiaries', diaryController.getSubscriptionDiaries)
router.post('/followdiary', diaryController.followDiary)
router.get('/getfolloweddiaries', diaryController.getFollowedDiaries)
router.post('/likediarypage', diaryController.likeDiaryPage)
router.post('/likediary', diaryController.likeDiary)
router.get('/getdiarycontributiondetails', diaryController.getDiaryContribution);
router.post('/contributionstatusupdate', diaryController.contributionStatusUpdate);
router.get('/getmydiarycontributiondetails', diaryController.getMyDiaryContribution);
router.post('/updatecontributioncontent', diaryController.updateContributionContent);
router.get('/getdiaryanniversary', diaryController.diaryAnniversary);
router.post('/increasediarysharecount', diaryController.increaseDiaryShareCount)
router.get('/getlatestpublisheddate', diaryController.getLatestPublishDate);
router.post('/deletediarypage', diaryController.deleteDiaryPage)
router.post('/deletediarycomment', diaryController.deleteDiaryComment)
router.post('/diarypageimageupload', diaryController.diaryPageImageUpload)
router.get('/getdiarydataformetainfo', diaryController.getDiarydataformetainfo)
router.get('/getuserdiaries', diaryController.getUserDiaries)
router.get('/getuserdetails', diaryController.getUserdetails)
module.exports = router;