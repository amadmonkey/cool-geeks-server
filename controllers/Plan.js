import "dotenv/config.js";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import Plan from "../models/Plan.js";
import { RESPONSE } from "../utility.js";

const router = Router();

router.get("/", isLoggedIn, async (req, res) => {
	const { query } = req;
	console.log("---", query.filter);
	const data = await Plan.find(query.filter ? JSON.parse(query.filter) : {}).catch((error) =>
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
		res.status(200).json(RESPONSE.success(200, plan));
	} catch (e) {
		res.status(400).json(RESPONSE.error(400, { e }));
	}
});

router.put("/update", isLoggedIn, async (req, res) => {
	try {
		const updateRes = await Plan.findOneAndUpdate({ _id: req.body._id }, req.body, {
			new: true,
		});
		console.log("updateRes", updateRes);
		res.status(200).json(RESPONSE.success(200, updateRes));
	} catch (e) {
		console.log(RESPONSE.fail(400, { e }));
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

export default router;
