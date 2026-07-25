const axios = require("axios");
const { ITL_CONFIG } = require("../config/ithink")

const ithinkClient = axios.create({
    baseURL: ITL_CONFIG.baseUrl,
    timeout: 15000,
    headers: {
        "Content-Type": "application/json",
    },
});

module.exports= (ithinkClient);