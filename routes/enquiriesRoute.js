const express = require("express");
const router = express.Router();
const enquiryController = require("../controllers/enquiriesController");


router.post('/submitenquiry',enquiryController.submitEnquiry);
router.get('/getallenquiries',enquiryController.getAllEnquiries);
router.get('/getsingleenquiry',enquiryController.getSingleEnquiry);




module.exports = router;

