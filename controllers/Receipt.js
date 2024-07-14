import "dotenv/config.js";
import multer from "multer";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import Receipt from "../models/Receipt.js";
import User from "../models/User.js";
import { DateTime, Interval } from "luxon";
import { CONSTANTS, LOG, RESPONSE, addMonths } from "../utility.js";

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

// check missed months then add failed receipts. move this to cron jobs
router.use(isLoggedIn, async (req, res, next) => {
	if (!req.user.admin) await createFailed(req.user.accountNumber);
	next();
});

router.get("/", isLoggedIn, async (req, res) => {
	try {
		const { query } = req;
		const isAdmin = req.user.admin;
		const user = await User.findOne({ accountNumber: req.user.accountNumber });
		const receipts = await Receipt.find(
			isAdmin ? { status: { $ne: CONSTANTS.RECEIPT_STATUS.failed } } : { userRef: user._id },
			null,
			{
				skip: (query.page - 1) * query.limit, // Starting Row
				limit: query.limit, // Ending Row
				sort: {
					[query.sortBy]: query.sortOrder.toLowerCase(), //Sort by createdAt DESC
				},
			}
		).populate(
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
			list: receipts.length ? receipts : [],
			latestReceipt: isAdmin ? null : await getLatestReceipt(user),
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
			const latestReceipt = await getLatestReceipt(user);
			const receiptDate = latestReceipt
				? addMonths(latestReceipt.receiptDate, 1)
				: DateTime.now().toJSDate(); //"2024-04-11"

			const formData = {
				_id: new mongoose.Types.ObjectId(),
				userRef: user._id,
				planRef: user.planRef,
				referenceType: req.body.referenceType,
				referenceNumber: req.body.referenceNumber,
				receiptName: req.file.filename,
				receiptDate: receiptDate,
				cutoff: user.cutoff,
				status: "PENDING",
			};
			const SaveReceipt = new Receipt(formData);
			const uploadProcess = await SaveReceipt.save();
			return res.status(200).json(RESPONSE.success(200, uploadProcess));
		}
	} catch (e) {
		LOG.error(e);
		return res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.post("/update", isLoggedIn, async (req, res) => {
	try {
		const updatedItem = await Receipt.findOneAndUpdate(
			{ _id: req.body.toUpdate },
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
		return res.json(RESPONSE.success(200, updatedItem));
	} catch (e) {
		LOG.error(e);
		return res.status(400).json(RESPONSE.fail(400, { e }));
	}
});

const createFailed = async (accountNumber) => {
	const user = await User.findOne({ accountNumber: accountNumber });
	const { _id, cutoff, createdAt } = user;
	const date = DateTime.now();
	const startDate = DateTime.now().set({ hour: 0, minute: 0, second: 0, millisecond: 1 });
	const endDate = DateTime.now().set({ hour: 23, minute: 59, second: 59, millisecond: 999 });

	const latestReceiptDate = (await getLatestReceipt(user).receiptDate) || new Date(createdAt);
	console.log("latestReceiptDate", latestReceiptDate);

	switch (cutoff) {
		case CONSTANTS.CUTOFF.mid:
			Object.assign(
				startDate,
				startDate.set({ month: date.month - (date.day > 15 ? 0 : 1), day: 17 })
			);
			Object.assign(endDate, endDate.set({ month: date.month - (date.day > 15 ? 1 : 0), day: 15 }));
			break;
		case CONSTANTS.CUTOFF.end:
			Object.assign(startDate, startDate.set({ month: date.month - 1, day: 2 }));
			Object.assign(endDate, endDate.set({ month: date.month, day: 0 }));
			break;
		default:
			return RESPONSE.fail(400, { message: "No cutoff info found." });
	}

	const range = {
		$gte: startDate.toJSDate(),
		$lte: endDate.toJSDate(),
	};

	// if already has failed for current range don't do shit
	const hasFailed =
		(await Receipt.findOne({
			userRef: _id,
			receiptDate: range,
			status: CONSTANTS.RECEIPT_STATUS.failed,
		})) || "";

	if (!(date > startDate && date < endDate) && !hasFailed) {
		const formData = {
			_id: new mongoose.Types.ObjectId(),
			userRef: user._id,
			planRef: user.planRef,
			referenceType: {},
			referenceNumber: "",
			receiptName: "",
			receiptDate: endDate,
			cutoff: user.cutoff,
			status: "FAILED",
		};
		const SaveReceipt = new Receipt(formData);
		await SaveReceipt.save();
	}
};

const getLatestReceipt = async (user) => {
	const { _id } = user;

	return await Receipt.findOne(
		{
			userRef: _id,
			status: { $nin: [CONSTANTS.RECEIPT_STATUS.denied, CONSTANTS.RECEIPT_STATUS.failed] },
		},
		null,
		{
			sort: {
				createdAt: "desc",
			},
		}
	);
};

// https://stackoverflow.com/a/26930998
const monthDiff = (startDate, endDate, roundUpFractionalMonths) => {
	//Calculate the differences between the start and end dates
	var yearsDifference = endDate.getFullYear() - startDate.getFullYear();
	var monthsDifference = endDate.getMonth() - startDate.getMonth();
	var daysDifference = endDate.getDate() - startDate.getDate();

	var monthCorrection = 0;
	//If roundUpFractionalMonths is true, check if an extra month needs to be added from rounding up.
	//The difference is done by ceiling (round up), e.g. 3 months and 1 day will be 4 months.
	if (roundUpFractionalMonths === true && daysDifference > 0) {
		monthCorrection = 1;
	}
	//If the day difference between the 2 months is negative, the last month is not a whole month.
	else if (roundUpFractionalMonths !== true && daysDifference < 0) {
		monthCorrection = -1;
	}

	return yearsDifference * 12 + monthsDifference + monthCorrection;
};

export default router;
