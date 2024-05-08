import "dotenv/config.js";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import Plan from "../models/Plan.js";
import { RESPONSE } from "../utility.js";

const router = Router();

router.get("/", isLoggedIn, async (req, res) => {
	const data = await Plan.find({ subdRef: req.query.subd }).catch((error) =>
		res.status(400).json(RESPONSE.fail(400, { error }))
	);
	res.status(200).json(RESPONSE.success(200, data));
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
