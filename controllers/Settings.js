import "dotenv/config.js";
import Router from "express";
import isLoggedIn from "./middleware.js";

import Settings from "../models/Settings.js";
import { RESPONSE } from "../utility.js";

const router = Router();

router.get("/", isLoggedIn, async (req, res) => {
	try {
		const data = await Settings.find({ active: true });
		res.status(200).json(RESPONSE.success(200, data));
	} catch (e) {
		console.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

export default router;
