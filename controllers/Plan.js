import "dotenv/config.js";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import Plan from "../models/Plan.js";
import { RESPONSE } from "../utility.js";

const router = Router();

router.get("/", isLoggedIn, async (req, res) => {
	res.json(
		await Plan.find().catch((error) => res.status(400).json(RESPONSE.error(400, { error })))
	);
});

router.post("/create", isLoggedIn, async (req, res) => {
	try {
		const plan = await Plan.create({
			...{ _id: new mongoose.Types.ObjectId() },
			...req.body,
		});
		res.json(plan);
	} catch (e) {
		res.status(400).json(RESPONSE.error(400, { e }));
	}
});

export default router;
