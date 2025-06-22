const cron = require('node-cron');
const { checkAndUpdateDiaryPages } = require('../controllers/diaryController');

cron.schedule('0 0 * * *', async () => {
    console.log("Cron job running every day at midnight...");
    await checkAndUpdateDiaryPages();
});

module.exports = {};