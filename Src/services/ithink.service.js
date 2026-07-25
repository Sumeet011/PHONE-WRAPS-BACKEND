const ithinkClient =require("./ithink.client");
const { ITL_CONFIG } =require("../config/ithink");

class IThinkService {

    async getWarehouses() {

        const response = await ithinkClient.post(
            "/warehouse/get.json",
            {
                data: {
                    access_token: ITL_CONFIG.accessToken,
                    secret_key: ITL_CONFIG.secretKey
                }
            }
        );

        return response.data;
    }

}

module.exports = new IThinkService();