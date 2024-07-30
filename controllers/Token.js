import "dotenv/config.js";
import Router from "express";
import Token from "../models/Token.js";
import { TOKEN } from "../utility.js";

const router = Router();

router.post("/refresh", (req, res) => {
	return TOKEN.refresh(req, res, Token);
});

export default router;
