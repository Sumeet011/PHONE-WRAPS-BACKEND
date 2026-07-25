
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });


const ITL_CONFIG = {
    baseUrl: process.env.ITHINK_BASE_URL,
    accessToken: process.env.ITHINK_ACCESS_TOKEN,
    secretKey: process.env.ITHINK_SECRET_KEY,
};

console.log(ITL_CONFIG);

module.exports = { ITL_CONFIG };