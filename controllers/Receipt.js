import "dotenv/config.js";
import multer from "multer";
import Router from "express";
import mongoose from "mongoose";
import { DateTime } from "luxon";

import isLoggedIn from "./middleware.js";
import Receipt from "../models/Receipt.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import ReceiptReason from "../models/ReceiptReason.js";

import { CONSTANTS, LOG, RESPONSE, SEARCH_TYPE, toRegex } from "../utility.js";
import { GoogleDriveService } from "../googleDriveService.js";

const router = Router();

const storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, "public/uploads/receipts");
		// callback(null, "https://www.googleapis.com/upload/drive/v3/files?uploadType=media");
	},
	filename: function (req, file, callback) {
		const extArray = file.mimetype.split("/");
		const ext = extArray[extArray.length - 1];
		callback(null, `${req.user.accountNumber}.${Date.now()}.${ext}`);
	},
});

const upload = multer({ storage: storage });

router.get("/test", async (req, res) => {
	const googleDriveService = new GoogleDriveService();
	console.log(await googleDriveService.createFolder("qr"));
});

router.get("/image", async (req, res) => {
	try {
		const { query } = req;
		const googleDriveService = new GoogleDriveService();
		const gdriveRes = await googleDriveService.downloadFile(query.id);
		console.log(gdriveRes.data);

		res.header("Content-Type", "image/jpeg");
		res.header("Content-Length", gdriveRes.data.size);
		gdriveRes.data.stream().pipe(res);
	} catch (e) {
		console.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.get("/", isLoggedIn, async (req, res) => {
	try {
		const { query: filters } = req;

		const isAdmin = req.user.admin;
		const user = await User.findOne({ accountNumber: req.user.accountNumber });
		if (!user.admin) await createFailed(req.user.accountNumber);

		let filter = isAdmin
			? { status: { $ne: CONSTANTS.RECEIPT_STATUS.failed } }
			: { userRef: user._id };

		if (filters.query) {
			const parsedFilter = JSON.parse(filters.query);
			const s = parsedFilter.search;

			filter = {
				...filter,
				...(parsedFilter.dateRange
					? Object.keys(parsedFilter.dateRange).length
						? {
								createdAt: { $gte: parsedFilter.dateRange.start, $lte: parsedFilter.dateRange.end },
						  }
						: {}
					: {}),
				...(parsedFilter.cutOffType && parsedFilter.cutOffType !== "BOTH"
					? { cutoff: parsedFilter.cutOffType }
					: {}),
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

		const receipts = await Receipt.find(filter)
			.skip((filters.pagesCurrent - 1) * filters.limit)
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
			totalCount: count,
			latestReceipt: isAdmin ? null : await getLatestReceipt(user),
		};
		res.status(200).json(RESPONSE.success(200, data));
	} catch (e) {
		console.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.get("/reason", isLoggedIn, async (req, res) => {
	try {
		const { query } = req;
		const filters = JSON.parse(query.filter);

		if (!filters) res.status(400).json(RESPONSE.fail(400, { message: "No receipt found" }));

		const reasonRes = await ReceiptReason.findOne(filters);

		console.log(reasonRes);

		res.status(200).json(RESPONSE.success(200, reasonRes));
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
				? DateTime.fromJSDate(latestReceipt.receiptDate).plus({ month: 1 })
				: DateTime.now().toJSDate(); //"2024-04-11"

			// gdrive upload file
			const googleDriveService = new GoogleDriveService();
			const folderId = "12THjHe9r195AnhV_wCGxozGMT0gmxnJZ";
			const gdriveId = await googleDriveService
				.saveFile(req.file.filename, req.file.destination, req.file.mimetype, folderId)
				.catch((error) => {
					throw error;
				});

			const formData = {
				_id: new mongoose.Types.ObjectId(),
				gdriveId: gdriveId,
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

// update db fields
router.put("/update", isLoggedIn, async (req, res) => {
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

// update receipt image
router.post("/update", isLoggedIn, upload.single("receipt"), async (req, res) => {
	try {
		const form = req.body;
		console.log("form", form);

		const formData = {
			receiptName: req.file.filename,
			status: CONSTANTS.RECEIPT_STATUS.pending,
		};

		const googleDriveService = new GoogleDriveService();
		const folderId = "12THjHe9r195AnhV_wCGxozGMT0gmxnJZ";

		// delete old file
		const gdriveDeleteRes = await googleDriveService.deleteFile(form.gdriveId);
		console.log("gdriveDeleteRes", gdriveDeleteRes);

		// create new file
		const gdriveId = await googleDriveService
			.saveFile(req.file.filename, req.file.destination, req.file.mimetype, folderId)
			.catch((error) => {
				throw error;
			});

		const receiptRes = await Receipt.findOneAndUpdate(
			{ _id: form._id },
			{ ...formData, ...{ gdriveId: gdriveId } },
			{
				new: true,
			}
		).lean();
		res.json(RESPONSE.success(200, receiptRes));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

// TODO: convert to luxon
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

		if (months) {
			for (let monthToAdd = 0; monthToAdd < months; monthToAdd++) {
				const range = {
					$gte: dateToCutOff(latestReceiptDate.plus({ month: monthToAdd }), cutOffType),
					$lte: dateToCutOff(latestReceiptDate.plus({ month: monthToAdd + 1 }), cutOffType),
				};

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
