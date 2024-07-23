import "dotenv/config.js";
import multer from "multer";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import Receipt from "../models/Receipt.js";
import User from "../models/User.js";
import { DateTime } from "luxon";
import { CONSTANTS, LOG, RESPONSE } from "../utility.js";

const router = Router();

const storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, "public/uploads/receipts");
	},
	filename: function (req, file, callback) {
		const extArray = file.mimetype.split("/");
		const ext = extArray[extArray.length - 1];
		callback(null, `${req.user.accountNumber}.${Date.now()}.${ext}`);
	},
});

const upload = multer({ storage: storage });

router.get("/", isLoggedIn, async (req, res) => {
	try {
		const { query } = req;
		const isAdmin = req.user.admin;
		const user = await User.findOne({ accountNumber: req.user.accountNumber });

		if (!user.admin) await createFailed(req.user.accountNumber);

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
		).populate([
			{
				path: "planRef",
				populate: {
					path: "subdRef",
				},
			},
			"userRef",
		]);
		// check if already paid current cutoff
		const data = {
			list: receipts.length ? receipts : [],
			latestReceipt: isAdmin ? null : await getLatestReceipt(user),
		};
		res.status(200).json(RESPONSE.success(200, data));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
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
				? DateTime.fromISO(latestReceipt.receiptDate).plus({ month: 1 })
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
		const updatedItem = await Receipt.findOneAndUpdate({ _id: req.body._id }, req.body, {
			new: true,
		}).populate([
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
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

const dateToCutOff = (date, cutOffType) => {
	return date.set({
		day: cutOffType === CONSTANTS.CUTOFF.mid ? 15 : date.endOf("month").day,
		hour: 23,
		minute: 59,
		second: 59,
		millisecond: 999,
	});
};

const createFailed = async (accountNumber) => {
	try {
		const user = await User.findOne({ accountNumber: accountNumber });
		const { _id, cutoff: cutOffType, createdAt } = user;

		const d = DateTime.now();

		// set last cutoff depending on type (e.g: mid, end)
		const lastCutoffEndDate = dateToCutOff(
			d.minus({
				month: cutOffType === CONSTANTS.CUTOFF.mid ? (d.day > 15 ? 0 : 1) : 1,
			}),
			cutOffType
		);

		// get latest receipt. if none, use createdAt to set how many missed months
		const c = DateTime.fromJSDate(createdAt).plus({ month: 1 }).toJSDate();
		let latestReceiptDate = DateTime.fromJSDate((await getLatestReceipt(user))?.receiptDate || c);
		latestReceiptDate = dateToCutOff(latestReceiptDate, cutOffType);

		const { months } = lastCutoffEndDate.diff(latestReceiptDate, ["months"]);

		// log info
		LOG.info("======================");
		LOG.info("+ lastCutoffEndDate:", lastCutoffEndDate);
		LOG.info("+ latestReceiptDate:", latestReceiptDate);
		LOG.info("+ monthsDiff:", months);
		LOG.info("======================");

		if (months) {
			for (let monthToAdd = 0; monthToAdd < months; monthToAdd++) {
				const range = {
					$gte: dateToCutOff(latestReceiptDate.plus({ month: monthToAdd }), cutOffType),
					$lte: dateToCutOff(latestReceiptDate.plus({ month: monthToAdd + 1 }), cutOffType),
				};
				LOG.info("------- Loop " + (monthToAdd + 1));
				LOG.info("range", range);

				// // if already has failed for current range don't do shit
				const hasFailed =
					(await Receipt.findOne({
						userRef: _id,
						receiptDate: range,
						status: CONSTANTS.RECEIPT_STATUS.failed,
					})) || null;
				LOG.info("hasFailed", hasFailed ? true : false);

				if (!hasFailed) {
					const formData = {
						_id: new mongoose.Types.ObjectId(),
						userRef: user._id,
						planRef: user.planRef,
						referenceType: {},
						referenceNumber: "",
						receiptName: "",
						receiptDate: range.$gte,
						cutoff: user.cutoff,
						status: "FAILED",
					};
					await Receipt.create(formData);
				}
			}
		}
	} catch (e) {
		LOG.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
};

const getLatestReceipt = async (user) => {
	const { _id } = user;

	return await Receipt.findOne(
		{
			userRef: _id,
			status: {
				$nin: [
					CONSTANTS.RECEIPT_STATUS.denied,
					// CONSTANTS.RECEIPT_STATUS.failed
				],
			},
		},
		null,
		{
			sort: {
				createdAt: -1,
			},
		}
	);
};

export default router;
