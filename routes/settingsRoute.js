const express = require('express');
const router = express.Router();

const settingsController = require('../controllers/settingsController');

router.get('/getcompanyinfo', settingsController.getCompanyInfo);
router.post('/updatecompanyinfo', settingsController.updateCompanyInfo);
router.get('/getcompanylogos', settingsController.getCompanyLogos);
router.post('/updatelogos', settingsController.updateLogos);
router.post('/updatesocialmedialinks', settingsController.updateSocialMediaLinks);
router.get('/getsocialmedialinks', settingsController.getSocialMediaLinks);
router.get('/getallcompnayinfo', settingsController.getAllCompnayInfo);

module.exports = router;