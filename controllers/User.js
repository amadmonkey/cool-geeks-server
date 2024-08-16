import "dotenv/config.js";
import Router from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import User from "../models/User.js";
import Receipt from "../models/Receipt.js";
import { email, from } from "../mailing.js";
import { CONSTANTS, getFullUrl, LOG, RESPONSE } from "../utility.js";

const router = Router();

const { ORIGIN } = process.env;

router.get("/", isLoggedIn, async (req, res) => {
	try {
		const { query } = req;
		const isAdmin = req.user.admin;
		if (isAdmin) {
			const users = await User.find(
				query.filter ? { ...JSON.parse(query.filter), ...{ admin: false } } : { admin: false },
				null,
				{
					skip: (query.page - 1) * query.limit, // Starting Row
					limit: query.limit || 0, // Ending Row
					sort: JSON.parse(query.sort),
				}
			).populate("subdRef planRef");
			const data = {
				list: users.length ? users : [],
			};
			return res.status(200).json(RESPONSE.success(200, data));
		} else {
			return res.status(400).json(RESPONSE.fail(400, { message: "User not authorized" }));
		}
	} catch (e) {
		LOG.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.get("/dashboard-info", isLoggedIn, async (req, res) => {
	try {
		if (req.user.admin) {
			const pendingReceipts = await Receipt.countDocuments({
				status: CONSTANTS.RECEIPT_STATUS.pending,
			});
			const pendingUsers = await User.countDocuments({ status: CONSTANTS.RECEIPT_STATUS.pending });
			// check users that have no receipts in current cutoff
			const overdueAccounts = 0;

			const data = {
				pendingReceipts,
				pendingUsers,
				overdueAccounts,
			};

			res.status(200).json(RESPONSE.success(200, data));
		} else {
			res.status(400).json(RESPONSE.fail(400, { message: "User not authorized" }));
		}
	} catch (e) {
		LOG.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
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
		const createRes = await User.create({
			...{ _id: new mongoose.Types.ObjectId() },
			...{ ...req.body, ...{ subdRef: req.body.subd._id, planRef: req.body.plan._id } },
		});

		res.status(200).json(RESPONSE.success(200, { general: "User created" }));

		console.log("getFullUrl", getFullUrl(req));

		// if dev preview = true, if prod preview = false
		email({ send: true, preview: false })
			.send({
				template: "account-created",
				message: {
					to: createRes.email,
					from: from,
				},
				locals: {
					name: `${createRes.firstName} ${createRes.lastName}`,
					dirname: getFullUrl(req),
					accountNumber: createRes.accountNumber,
					link: `${ORIGIN}/login?u=${createRes.accountNumber}`,
				},
			})
			.then(console.log)
			.catch(console.error);
	} catch (e) {
		let message = "";
		switch (e.code) {
			case 11000:
				message = "Email already in use";
				break;
			default:
				message = e.message;
				break;
		}
		res.status(400).json(RESPONSE.fail(400, { message: message }));
	}
});

router.put("/update", isLoggedIn, async (req, res) => {
	try {
		const updateRes = await User.findOneAndUpdate({ _id: req.body._id }, req.body, {
			new: true,
		}).populate("subdRef planRef");
		res.status(200).json(RESPONSE.success(200, updateRes));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

export default router;
