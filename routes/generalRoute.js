const express = require('express');
const router = express.Router();

const generalController = require('../controllers/generalController');

router.get('/getcountries', generalController.getCountries);

module.exports = router;