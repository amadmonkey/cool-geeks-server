import "dotenv/config.js";
import multer from "multer";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import Subd from "../models/Subd.js";
import Plan from "../models/Plan.js";
import { LOG, RESPONSE } from "../utility.js";

const router = Router();

const storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, "uploads/qr");
	},
	filename: function (req, file, callback) {
		const extArray = file.mimetype.split("/");
		const ext = extArray[extArray.length - 1];
		callback(null, file.originalname);
	},
});

const upload = multer({ storage: storage });

router.get("/", isLoggedIn, async (req, res) => {
	try {
		const { query } = req;
		const subdData = await Subd.find(query.filter ? JSON.parse(query.filter) : {})
			.collation({ locale: "en" })
			.skip((query.page - 1) * query.limit)
			.limit(query.limit)
			.sort(JSON.parse(query.sort))
			.lean();

		// for (let x = 0; x < subdData.length; x++) {
		// 	const plans = await Plan.find({ subdRef: subdData[x]._id }).sort({ price: "asc" }).lean();
		// 	updatedSubds.push({ ...subdData[x], ...{ plans: plans } });
		// }

		// res.status(200).json(RESPONSE.success(200, updatedSubds));
		res.status(200).json(RESPONSE.success(200, subdData));
	} catch (error) {
		LOG.error(error);
		res.status(400).json(RESPONSE.fail(400, { error }));
	}
});

router.post("/create", isLoggedIn, upload.single("qr"), async (req, res) => {
	try {
		const form = {
			_id: new mongoose.Types.ObjectId(),
			name: req.body.name,
			code: req.body.code,
			gcash: {
				qr: {
					filename: req.file.filename,
					contentType: req.file.mimetype,
				},
				number: req.body.number,
			},
		};
		const SaveSubd = new Subd(form);
		const subdRes = await SaveSubd.save();
		const plans = JSON.parse(req.body.plans).map((plan) => ({
			...plan,
			...{ _id: new mongoose.Types.ObjectId(), subdRef: subdRes._id },
		}));
		await Plan.insertMany(plans);
		res.status(200).json(RESPONSE.success(200, subdRes));
	} catch (e) {
		console.log(RESPONSE.fail({ message: e.message }));
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.put("/update", isLoggedIn, upload.single("qr"), async (req, res) => {
	try {
		const form = {
			name: req.body.name.toUpperCase(),
			code: req.body.code.toUpperCase(),
			plans: null,
			gcash: {
				qr: {
					filename: req.file.originalname,
					contentType: req.file.mimetype,
				},
				number: req.body.number,
			},
		};

		const subdRes = await Subd.findOneAndUpdate({ _id: req.body._id }, form, {
			new: true,
		}).lean();

		// await Plan.deleteMany({ subdRef: subdRes._id });
		// const plans = JSON.parse(req.body.plans).map((plan) => ({
		// 	...plan,
		// 	...{ _id: new mongoose.Types.ObjectId(), subdRef: subdRes._id },
		// }));
		// const plansRes = await Plan.insertMany(plans);
		const plansRes = await Plan.find({ subdRef: subdRes._id }).catch((error) =>
			res.status(400).json(RESPONSE.fail(400, { error }))
		);
		return res.json(RESPONSE.success(200, { ...subdRes, ...{ plans: plansRes } }));
	} catch (e) {
		console.log(RESPONSE.fail(400, { e }));
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.delete("/delete", isLoggedIn, async (req, res) => {
	try {
		const subdRes = await Subd.findOneAndUpdate(
			{ _id: req.body._id },
			{ active: false },
			{
				new: true,
			}
		).lean();
		return res.json(RESPONSE.success(200, subdRes));
	} catch (e) {
		console.log(RESPONSE.fail(400, { e }));
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

export default router;
