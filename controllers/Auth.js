import "dotenv/config.js";
import Router from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
// import isLoggedIn from "./middleware.js";
import User from "../models/User.js";
import Subd from "../models/Subd.js";
import Plan from "../models/Plan.js";
import Token from "../models/Token.js";
import { CONSTANTS, LOG, RESPONSE, TOKEN } from "../utility.js";

const router = Router();

router.post("/login", async (req, res) => {
	try {
		const user = await User.findOne(
			{
				$or: [{ accountNumber: req.body.emailAccountNo }, { email: req.body.emailAccountNo }],
				status: CONSTANTS.ACCOUNT_STATUS.active,
			},
			"-_id"
		).populate("planRef subdRef");

		if (user) {
			if (!user.active)
				return res.status(403).json(
					RESPONSE.fail(403, {
						general:
							"Account has been deactivated. Please contact [number here] or [number here] for info or reactivation",
					})
				);
			const result = await bcrypt.compare(req.body.password, user.password);
			if (result) {
				const userObj = {
					accountNumber: user.accountNumber,
					admin: user.admin,
					generatedVia: "LOGIN",
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

				const subd = await Subd.findOne({ _id: user.subdRef });
				const plan = await Plan.findOne({ _id: user.planRef });
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
		console.error(e);
		res.status(400).json(RESPONSE.fail(400, { e }));
	}
});

router.post("/signup", async (req, res) => {
	try {
		req.body.password = await bcrypt.hash(req.body.password, 10);
		await User.create({
			...{ _id: new mongoose.Types.ObjectId() },
			...req.body,
		});
		res.status(200).json(RESPONSE.success(200, { general: "Registration successful" }));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(403, { e }));
	}
});

router.post("/create", async (req, res) => {
	try {
		await User.create({
			...{ _id: new mongoose.Types.ObjectId() },
			...{ ...req.body, ...{ subdRef: req.body.subd._id, planRef: req.body.plan._id } },
		});
		res.status(200).json(RESPONSE.success(200, { general: "User created" }));
	} catch (e) {
		console.log(e);
		res.status(400).json(RESPONSE.fail(403, { message: e.message }));
	}
});

router.delete("/logout", async (req, res) => {
	try {
		res.clearCookie("accessToken", { path: "/" });
		res.clearCookie("refreshToken", { path: "/" });
		LOG.success("LOGOUT", "Logout successful");
		res.status(200).json(RESPONSE.success(200, { general: "Logout successful" }));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, e));
	}
});

// router.get("/", isLoggedIn, async (req, res) => {
// 	try {
// 		const { query } = req;
// 		const isAdmin = req.user.admin;
// 		console.log(query.filter);
// 		if (isAdmin) {
// 			const users = await User.find(query.filter ? JSON.parse(query.filter) : {}, null, {
// 				skip: (query.page - 1) * query.limit, // Starting Row
// 				limit: query.limit, // Ending Row
// 				sort: JSON.parse(query.sort),
// 			}).populate("subdRef planRef");
// 			const data = {
// 				list: users.length ? users : [],
// 			};
// 			res.status(200).json(RESPONSE.success(200, data));
// 		} else {
// 			res.status(400).json(RESPONSE.fail(400, { message: "User not authorized" }));
// 		}
// 	} catch (e) {
// 		LOG.error(e);
// 		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
// 	}
// });

// router.put("/update", isLoggedIn, async (req, res) => {
// 	try {
// 		const updateRes = await User.findOneAndUpdate({ _id: req.body._id }, req.body, {
// 			new: true,
// 		}).populate("subdRef planRef");
// 		res.status(200).json(RESPONSE.success(200, updateRes));
// 	} catch (e) {
// 		console.log(RESPONSE.fail(400, { e }));
// 		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
// 	}
// });

export default router;
