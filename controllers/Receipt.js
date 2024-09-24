import "dotenv/config.js";
import multer from "multer";
import Router from "express";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import isLoggedIn from "./middleware.js";

// models
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import Receipt from "../models/Receipt.js";
import Settings from "../models/Settings.js";
import ReceiptReason from "../models/ReceiptReason.js";

// helpers
import { CONSTANTS, LOG, RESPONSE, toMongoRegex } from "../utility.js";
// import { GoogleDriveService } from "../googleDriveService.js";
import { CloudinaryService } from "../cloudinary.js";

const router = Router();

const storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, CONSTANTS.TMP);
	},
	filename: function (req, file, callback) {
		const extArray = file.mimetype.split("/");
		const ext = extArray[extArray.length - 1];
		callback(null, `${req.user.accountNumber}.${Date.now()}.${ext}`);
	},
});

const upload = multer({ storage: storage });

// GET info
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
			const search = parsedFilter.search;

			// default filters. e.g: data, cutoff type, status
			filter = {
				...filter,
				...(parsedFilter.dateRange
					? Object.keys(parsedFilter.dateRange).length
						? {
								updatedAt: { $gte: parsedFilter.dateRange.start, $lte: parsedFilter.dateRange.end },
						  }
						: {}
					: {}),
				...(parsedFilter.cutOffType && parsedFilter.cutOffType !== "BOTH"
					? { cutoff: parsedFilter.cutOffType }
					: {}),
				...(parsedFilter.status && parsedFilter.status !== "ALL"
					? { status: parsedFilter.status }
					: {}),
			};

			// if has search
			if (search) {
				// get matched from users
				const usersRes = await User.find({
					$or: [
						{ accountNumber: toMongoRegex(search) },
						{ firstName: toMongoRegex(search) },
						{ middleName: toMongoRegex(search) },
						{ lastName: toMongoRegex(search) },
						{ address: toMongoRegex(search) },
						{ contactNo: toMongoRegex(search) },
						{ email: toMongoRegex(search) },
					],
				}).select("_id");

				// get matched from plans
				const plansRes = await Plan.find({
					$or: [
						{ name: toMongoRegex(search) },
						{ description: toMongoRegex(search) },
						search
							? {
									$expr: {
										$regexMatch: {
											input: { $toString: `$price` },
											regex: search,
										},
									},
							  }
							: {},
					],
				}).select("_id");

				// concat matched users and plans
				const or = [
					...(plansRes.length
						? plansRes.map((plan) => {
								return { planRef: plan._id };
						  })
						: []),
					...(usersRes.length
						? usersRes.map((user) => {
								return { userRef: user._id };
						  })
						: []),
				];

				// concat to final filter
				filter = {
					...filter,
					...{
						$or: [
							...[
								{
									referenceNumber: toMongoRegex(search),
								},
								{ "referenceType.name": toMongoRegex(search) },
							],
							...or,
						],
					},
				};
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

// GET image
router.get("/image", async (req, res) => {
	try {
		const { query } = req;
		// GDRIVE GET
		// const googleDriveService = new GoogleDriveService();
		// const gdriveRes = await googleDriveService.downloadFile(query.id);
		// console.log(gdriveRes.data);
		// res.header("Content-Type", "image/jpeg");
		// res.header("Content-Length", gdriveRes.data.size);
		// gdriveRes.data.stream().pipe(res);

		// CLOUDINARY GET
		const cloudinaryService = new CloudinaryService();
		const cloudinaryRes = await cloudinaryService.url(query.id);
		console.log("cloudinaryRes", cloudinaryRes);
		res.status(200).json(RESPONSE.success(200, cloudinaryRes));
	} catch (e) {
		console.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

// GET reason
router.get("/reason", isLoggedIn, async (req, res) => {
	try {
		const { query } = req;
		const filters = JSON.parse(query.filter);

		if (!filters) res.status(400).json(RESPONSE.fail(400, { message: "No receipt found" }));

		const reasonRes = await ReceiptReason.findOne(filters, null, { sort: { createdAt: -1 } });

		res.status(200).json(RESPONSE.success(200, reasonRes));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

// CREATE info + image
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

			// GDRIVE UPLOAD
			// const googleDriveService = new GoogleDriveService();
			// const imageId = await googleDriveService
			// .saveFile(req.file.filename, req.file.path, req.file.mimetype, CONSTANTS.GDRIVE_ID.RECEIPT)
			// 	.catch((error) => {
			// 		throw error;
			// 	});

			// CLOUDINARY UPLOAD
			const cloudinaryService = new CloudinaryService();
			const cloudinaryRes = await cloudinaryService.upload(
				req.file.filename,
				req.file.path,
				CONSTANTS.FOLDER_ID.RECEIPT
			);
			console.log("cloudinaryRes", cloudinaryRes);

			const formData = {
				_id: new mongoose.Types.ObjectId(),
				imageId: cloudinaryRes.public_id,
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

// UPDATE info
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

// UPDATE image
router.post("/update", isLoggedIn, upload.single("receipt"), async (req, res) => {
	try {
		const form = req.body;
		console.log("form", form);

		const formData = {
			receiptName: req.file.filename,
			status: CONSTANTS.RECEIPT_STATUS.pending,
		};

		// const googleDriveService = new GoogleDriveService();
		const cloudinaryService = new CloudinaryService();

		// delete old file
		if (form.imageId) {
			// GDRIVE DELETE
			// const gdriveDeleteRes = await googleDriveService.deleteFile(form.imageId);
			// console.log("gdriveDeleteRes", gdriveDeleteRes);

			// CLOUDINARY DELETE
			const deleteRes = await cloudinaryService.destroy(form.imageId);
			LOG.info("deleteRes", deleteRes);
		}

		// GDRIVE UPLOAD
		// const imageId = await googleDriveService
		// 	.saveFile(req.file.filename, req.file.path, req.file.mimetype, folderId)
		// 	.catch((error) => {
		// 		throw error;
		// 	});

		// CLOUDINARY UPLOAD
		const cloudinaryRes = await cloudinaryService.upload(
			req.file.filename,
			req.file.path,
			CONSTANTS.FOLDER_ID.RECEIPT
		);
		console.log("cloudinaryRes", cloudinaryRes);

		const receiptRes = await Receipt.findOneAndUpdate(
			{ _id: form._id },
			{ ...formData, ...{ imageId: cloudinaryRes.public_id } },
			{ new: true }
		);

		res.json(RESPONSE.success(200, receiptRes));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

// TODO: convert to luxon
const dateToCutOff = async (date, cutOffType) => {
	const gracePeriod = await Settings.find({ _id: "66f05edc10a64439d3807f83" });
	return date.set({
		day: (cutOffType === CONSTANTS.CUTOFF.mid ? 15 : date.endOf("month").day) + gracePeriod,
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
		const lastCutoffEndDate = await dateToCutOff(
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
