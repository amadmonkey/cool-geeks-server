import "dotenv/config.js";
import multer from "multer";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import { DateTime } from "luxon";

import Receipt from "../models/Receipt.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import ReceiptReason from "../models/ReceiptReason.js";

import { CONSTANTS, LOG, RESPONSE, SEARCH_TYPE, toRegex } from "../utility.js";

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
		const { query: filters } = req;

		const isAdmin = req.user.admin;
		const user = await User.findOne({ accountNumber: req.user.accountNumber });
		if (!user.admin) await createFailed(req.user.accountNumber);

		let filter = isAdmin
			? { status: { $ne: CONSTANTS.RECEIPT_STATUS.failed } }
			: { userRef: user._id };

		console.log(filters);

		if (filters.query) {
			const parsedFilter = JSON.parse(filters.query);
			const s = parsedFilter.search;

			console.log("parsedFilter", parsedFilter);

			filter = {
				...filter,
				...(Object.keys(parsedFilter.dateRange).length
					? { createdAt: { $gte: parsedFilter.dateRange.start, $lte: parsedFilter.dateRange.end } }
					: {}),
				...(parsedFilter.cutOffType !== "BOTH" ? { cutoff: parsedFilter.cutOffType } : {}),
				...(parsedFilter.status !== "ALL" ? { status: parsedFilter.status } : {}),
			};

			// if has search
			if (parsedFilter.searchType) {
				switch (parsedFilter.searchType.value) {
					case SEARCH_TYPE.RECEIPT.REFNO:
						// search in receipts
						filter = {
							...filter,
							...{
								$or: [
									{
										referenceNumber: toRegex(s),
									},
									{ "referenceType.name": toRegex(s) },
								],
							},
						};
						break;
					case SEARCH_TYPE.RECEIPT.USER:
						const usersRes = await User.find({
							$or: [
								{ accountNumber: toRegex(s) },
								{ firstName: toRegex(s) },
								{ middleName: toRegex(s) },
								{ lastName: toRegex(s) },
								{ address: toRegex(s) },
								{ contactNo: toRegex(s) },
								{ email: toRegex(s) },
							],
						}).select("_id");
						filter = {
							...filter,
							...{
								$or: usersRes.length
									? usersRes.map((user) => {
											return { userRef: user._id };
									  })
									: [{ userRef: null }],
							},
						};
						break;
					case SEARCH_TYPE.RECEIPT.PLAN:
						const plansRes = await Plan.find({
							$or: [{ name: toRegex(s) }, { description: toRegex(s) }],
						}).select("_id");
						console.log("plansRes", plansRes);
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

			// search in users by name, loop users then get receipts by those users

			console.log("parsed filter", parsedFilter);
		}

		console.log("filters", filters);
		console.log("final filter", filter);
		const receipts = await Receipt.find(filter)
			.skip((filters.page - 1) * filters.limit)
			.limit(filters.limit)
			.sort(JSON.parse(filters.sort))
			.collation({ locale: "en", strength: 2 })
			.populate([
				{
					path: "planRef",
					populate: {
						path: "subdRef",
					},
				},
				"userRef",
			]);

		const count = await Receipt.countDocuments(filter);

		// check if already paid current cutoff
		const data = {
			list: receipts.length ? receipts : [],
			count: Math.ceil(count / filters.limit),
			latestReceipt: isAdmin ? null : await getLatestReceipt(user),
		};
		res.status(200).json(RESPONSE.success(200, data));
	} catch (e) {
		console.error(e);
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
				? DateTime.fromJSDate(latestReceipt.receiptDate).plus({ month: 1 })
				: DateTime.now().toJSDate(); //"2024-04-11"

			const formData = {
				_id: new mongoose.Types.ObjectId(),
				userRef: user._id,
				planRef: user.planRef,
				referenceType: JSON.parse(req.body.referenceType),
				referenceNumber: req.body.referenceNumber,
				receiptName: req.file.filename,
				receiptDate: receiptDate,
				cutoff: user.cutoff,
				status: "PENDING",
			};

			const createRes = await Receipt.create(formData);
			const newReceipt = await createRes.populate("planRef");
			res.status(200).json(RESPONSE.success(200, newReceipt));
		}
	} catch (e) {
		LOG.error(e);
		return res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.post("/update", isLoggedIn, async (req, res) => {
	try {
		const form = req.body;

		console.log(form);

		const updatedItem = await Receipt.findOneAndUpdate({ _id: form._id }, form, {
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

		if (form.rejectReason) {
			await ReceiptReason.create({
				...{ _id: new mongoose.Types.ObjectId() },
				...{ receiptRef: updatedItem._id, content: form.rejectReason },
			});
		}

		return res.json(RESPONSE.success(200, updatedItem));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.put("/update", isLoggedIn, upload.single("receipt"), async (req, res) => {
	try {
		const form = req.body;
		console.log("form", form);

		const formData = {
			receiptName: req.file.filename,
			status: CONSTANTS.RECEIPT_STATUS.pending,
		};

		console.log("formData", formData);

		const receiptRes = await Receipt.findOneAndUpdate({ _id: form._id }, formData, {
			new: true,
		}).lean();
		// const plansRes = await Plan.find({ subdRef: subdRes._id }).catch((error) =>
		// 	res.status(400).json(RESPONSE.fail(400, { error }))
		// );
		res.json(RESPONSE.success(200, receiptRes));

		// if (form.rejectReason) {
		// 	await ReceiptReason.create({
		// 		...{ _id: new mongoose.Types.ObjectId() },
		// 		...{ receiptRef: updatedItem._id, content: form.rejectReason },
		// 	});
		// }

		// return res.json(RESPONSE.success(200, updatedItem));
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
