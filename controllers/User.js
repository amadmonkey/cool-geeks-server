import "dotenv/config.js";
import Router from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";

// models
import User from "../models/User.js";
import Subd from "../models/Subd.js";
import Plan from "../models/Plan.js";
import Receipt from "../models/Receipt.js";

// helpers
import { email, from } from "../mailing.js";
import { CONSTANTS, getFullUrl, LOG, RESPONSE, toMongoRegex } from "../utility.js";

const router = Router();

const { ORIGIN } = process.env;

router.get("/", isLoggedIn, async (req, res) => {
	try {
		if (req.user.admin) {
			const { query: filters } = req;
			console.log("filters user", filters);
			let filter = { ...(filters.filter ? JSON.parse(filters.filter) : {}), admin: false };

			if (filters.query) {
				const parsedFilter = JSON.parse(filters.query);
				const s = parsedFilter.search;

				// default filters. e.g: data, cutoff type, status
				filter = {
					...filter,
					...(parsedFilter.cutOffType && parsedFilter.cutOffType !== "BOTH"
						? { cutoff: parsedFilter.cutOffType }
						: {}),
					...(parsedFilter.status && parsedFilter.status !== "ALL"
						? { status: parsedFilter.status }
						: {}),
				};

				if (parsedFilter.searchType) {
					switch (parsedFilter.searchType.value) {
						case CONSTANTS.SEARCH_TYPE.ACCOUNT.USER:
							filter = {
								...filter,
								...{
									$or: [
										{ accountNumber: toMongoRegex(s) },
										{ firstName: toMongoRegex(s) },
										{ middleName: toMongoRegex(s) },
										{ lastName: toMongoRegex(s) },
										{ address: toMongoRegex(s) },
										{ contactNo: toMongoRegex(s) },
										{ email: toMongoRegex(s) },
									],
								},
							};
							break;
						case CONSTANTS.SEARCH_TYPE.ACCOUNT.SUBD:
							const subdsRes = await Subd.find({
								$or: [
									{ name: toMongoRegex(s) },
									{ code: toMongoRegex(s) },
									{ number: toMongoRegex(s) },
								],
							}).select("_id");
							filter = {
								...filter,
								...{
									$or: subdsRes.length
										? subdsRes.map((subd) => {
												return { subdRef: subd._id };
										  })
										: [{ subdRef: null }],
								},
							};
							break;
						case CONSTANTS.SEARCH_TYPE.ACCOUNT.PLAN:
							const plansRes = await Plan.find({
								$or: [
									{ name: toMongoRegex(s) },
									{ description: toMongoRegex(s) },
									s
										? {
												$where: `function() { return this.price.toString().match(/${s}/) != null; }`,
										  }
										: {},
								],
							}).select("_id");
							filter = {
								...filter,
								...{
									$or: plansRes.length
										? plansRes.map((plan) => {
												return { planRef: plan._id };
										  })
										: [{ planRef: null }],
								},
							};
							break;
						default:
							break;
					}
				}
			}

			const users = await User.find(filter, null, {
				skip: (filters.page - 1) * filters.limit, // Starting Row
				limit: filters.limit || 0, // Ending Row
				sort: JSON.parse(filters.sort),
			}).populate("subdRef planRef");
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
		console.log("dashboard-info", req.user);
		if (req.user.admin) {
			const pendingReceipts = await Receipt.countDocuments({
				status: CONSTANTS.RECEIPT_STATUS.pending,
			});
			const pendingUsers = await User.countDocuments({ status: CONSTANTS.RECEIPT_STATUS.pending });
			// check users that have no receipts in current cutoff
			const overdueAccounts = 0;
			console.log(pendingReceipts);

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
			.then((res) => console.log(res))
			.catch((err) => console.error(err));

		res.status(200).json(RESPONSE.success(200, { general: "User created" }));
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
