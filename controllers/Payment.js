import "dotenv/config.js";
import multer from "multer";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import { LOG, RESPONSE } from "../utility.js";

const router = Router();

const storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, "uploads/receipts");
	},
	filename: function (req, file, callback) {
		const extArray = file.mimetype.split("/");
		const ext = extArray[extArray.length - 1];
		callback(null, `${req.user.accountNumber}.${Date.now()}.${ext}`);
	},
});

const upload = multer({ storage: storage });

const hasFailed = async (user, date, currentPayment) => {
	const { _id, cutoff } = user;
	const startDate = new Date();
	const endDate = new Date();
	switch (cutoff) {
		case "MID":
			// if (date.getDate() > 15) {
			startDate.setMonth(date.getMonth() - (date.getDate() > 15 ? 1 : 2));
			startDate.setDate(15);
			endDate.setMonth(date.getMonth() - (date.getDate() > 15 ? 0 : 1));
			endDate.setDate(15);
			// } else {
			// 	startDate.setMonth(date.getMonth() - 2);
			// 	startDate.setDate(15);
			// 	endDate.setMonth(date.getMonth() - 1);
			// 	endDate.setDate(15);
			// }
			break;
		case "END":
			startDate.setMonth(date.getMonth());
			startDate.setDate(0);
			endDate.setMonth(date.getMonth() + 1);
			endDate.setDate(0);
			break;
		default:
			return RESPONSE.fail(400, { message: "No cutoff info found." });
	}

	const range = {
		$gte: startDate,
		$lt: endDate,
	};

	const hasFailed =
		(await Payment.findOne({
			userRef: user._id,
			paymentDate: range,
			status: "FAILED",
		})) || "";

	console.log("date", date);
	console.log("range", range);
	console.log("hasFailed", hasFailed);
	if (!(date > startDate && date < endDate) && !currentPayment && !hasFailed) {
		const formData = {
			_id: new mongoose.Types.ObjectId(),
			userRef: user._id,
			planRef: user.planRef,
			referenceType: {},
			referenceNumber: "",
			receiptName: "",
			paymentDate: endDate,
			cutoff: user.cutoff,
			status: "FAILED",
		};
		const SavePayment = new Payment(formData);
		await SavePayment.save();
	}
};

const getCurrentPayment = async (req, user) => {
	const { _id, cutoff } = user;
	const date = new Date(); //"2024-04-11"

	// get date range based on user's chosen cutoff
	const startDate = new Date();
	const endDate = new Date();
	switch (cutoff) {
		case "MID":
			if (date.getDate() > 15) {
				startDate.setMonth(date.getMonth());
				startDate.setDate(15);
				endDate.setMonth(date.getMonth() + 1);
				endDate.setDate(15);
			} else {
				startDate.setMonth(date.getMonth() - 1);
				startDate.setDate(15);
				endDate.setMonth(date.getMonth());
				endDate.setDate(15);
			}
			break;
		case "END":
			startDate.setMonth(date.getMonth());
			startDate.setDate(0);
			endDate.setMonth(date.getMonth() + 1);
			endDate.setDate(0);
			break;
		default:
			return RESPONSE.fail(400, { message: "No cutoff info found." });
	}

	const range = {
		$gte: startDate,
		$lt: endDate,
	};

	const currentPayment =
		(await Payment.findOne({
			userRef: _id,
			paymentDate: range,
			status: { $nin: ["DENIED", "FAILED"] },
		})) || "";

	console.log("currentPayment", currentPayment);

	await hasFailed(user, date, currentPayment, cutoff);

	return currentPayment;
};

router.get("/", isLoggedIn, async (req, res) => {
	try {
		const { query } = req;
		const isAdmin = req.user.admin;
		const user = await User.findOne({ accountNumber: req.user.accountNumber });
		const payments = await Payment.find(isAdmin ? {} : { userRef: user._id }, null, {
			skip: (query.page - 1) * query.limit, // Starting Row
			limit: query.limit, // Ending Row
			sort: {
				[query.sortBy]: query.sortOrder === "ASC" ? 1 : -1, //Sort by createdAt DESC
			},
		}).populate(
			isAdmin && [
				{
					path: "planRef",
					populate: {
						path: "subdRef",
					},
				},
				"userRef",
			]
		);
		// check if already paid current cutoff
		const data = {
			list: payments.length ? payments : [],
			currentPayment: !isAdmin ? await getCurrentPayment(req, user) : null,
		};
		res.status(200).json(RESPONSE.success(200, data));
	} catch (e) {
		LOG.error(e);
		res.status(400).json(RESPONSE.fail(400, { e }));
	}
});

router.post("/create", isLoggedIn, upload.single("receipt"), async (req, res) => {
	try {
		const user = await User.findOne(
			{ accountNumber: req.user.accountNumber },
			"_id planRef cutoff"
		);
		if (user) {
			const currentPayment = await getCurrentPayment(req, user);
			const paymentDate = new Date();
			if (currentPayment) paymentDate.setMonth(paymentDate.getMonth() + 1);
			const formData = {
				_id: new mongoose.Types.ObjectId(),
				userRef: user._id,
				planRef: user.planRef,
				referenceType: req.body.referenceType,
				referenceNumber: req.body.referenceNumber,
				receiptName: req.body.receiptName,
				paymentDate: paymentDate,
				cutoff: user.cutoff,
				status: "PENDING",
			};
			const SavePayment = new Payment(formData);
			const uploadProcess = await SavePayment.save();
			return res.json(RESPONSE.success(200, uploadProcess));
		}
	} catch (e) {
		LOG.error(e);
		return res.status(400).json(RESPONSE.fail(400, { e }));
	}
});

router.post("/update", isLoggedIn, async (req, res) => {
	try {
		const updatedItem = await Payment.findOneAndUpdate(
			{ _id: req.body.id },
			{ status: req.body.newStatus },
			{ new: true }
		).populate([
			{
				path: "planRef",
				populate: {
					path: "subdRef",
				},
			},
			"userRef",
		]);
		console.log(updatedItem);
		return res.json(RESPONSE.success(200, updatedItem));
	} catch (e) {
		LOG.error(e);
		return res.status(400).json(RESPONSE.fail(400, { e }));
	}
});

export default router;
