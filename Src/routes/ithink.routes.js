const { Router }=require("express");
const { getWarehouses } =require("../controllers/ithink.controller");

const router = Router();

router.get("/warehouse",getWarehouses);
module.exports = router;