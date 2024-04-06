import "dotenv/config.js";
import Router from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Subd from "../models/Subd.js";
import Plan from "../models/Plan.js";
import Token from "../models/Token.js";
import { CONSTANTS, LOG, RESPONSE, TOKEN } from "../utility.js";

const router = Router();

router.post("/signup", async (req, res) => {
	try {
		req.body.password = await bcrypt.hash(req.body.password, 10);
		const user = await User.create({
			...{ _id: new mongoose.Types.ObjectId() },
			...req.body,
		});
		res.json(user);
	} catch (e) {
		res.status(400).json(RESPONSE.fail(403, { e }));
	}
});

router.post("/login", async (req, res) => {
	try {
		const user = await User.findOne(
			{
				$or: [{ accountNumber: req.body.emailAccountNo }, { email: req.body.emailAccountNo }],
			},
			"-_id"
		);
		if (user) {
			const result = await bcrypt.compare(req.body.password, user.password);
			if (result) {
				const userObj = {
					accountNumber: user.accountNumber,
					generatedVia: "login",
				};
				const accessToken = TOKEN.create(userObj);
				const refreshToken = jwt.sign(userObj, process.env.REFRESH_TOKEN_SECRET);

				Token.create({
					...{ _id: new mongoose.Types.ObjectId() },
					...{
						accountNumber: user.accountNumber,
						token: refreshToken,
					},
				});

				const subd = await Subd.findOne({ _id: user.subdId });
				const plan = await Plan.findOne({ _id: user.planId });
				user.password = undefined;

				res.cookie("accessToken", accessToken, TOKEN.options(CONSTANTS.accessTokenAge));
				res.cookie("refreshToken", refreshToken, TOKEN.options(CONSTANTS.refreshTokenAge));
				res.status(200).json(RESPONSE.success(200, { user, plan, subd }));
			} else {
				res.status(400).json(RESPONSE.fail(400, { general: "Email or Password is incorrect" }));
			}
		} else {
			res.status(400).json(RESPONSE.fail(400, { general: "User doesn't exist" }));
		}
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { e }));
	}
});

export default router;
