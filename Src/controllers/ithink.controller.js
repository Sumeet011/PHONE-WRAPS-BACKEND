const { Request, Response } = require ("express");
const IThinkService = require ("../services/ithink.service");

 const getWarehouses = async (
    req,
    res
) => {

    try {

        const response = await IThinkService.getWarehouses();

        return res.status(200).json(response);

    } catch (error) {

        console.error(error.response?.data || error);

        return res.status(
            error.response?.status || 500
        ).json(
            error.response?.data || {
                message: "Internal Server Error"
            }
        );
    }

};

module.exports = {
    getWarehouses
};
