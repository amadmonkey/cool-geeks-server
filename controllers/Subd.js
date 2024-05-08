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
		const updatedSubds = [];
		const subdData = await Subd.find().sort(JSON.parse(query.sort)).lean();

		for (let x = 0; x < subdData.length; x++) {
			const plans = await Plan.find({ subdRef: subdData[x]._id }).sort({ price: "asc" }).lean();
			updatedSubds.push({ ...subdData[x], ...{ plans: plans } });
		}

		res.status(200).json(RESPONSE.success(200, updatedSubds));
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
		const plansRes = await Plan.insertMany(plans);
		res.json(RESPONSE.success(200, subdRes));
	} catch (e) {
		console.log(RESPONSE.fail({ e }));
		res.status(400).json(RESPONSE.fail({ e }));
	}
});

router.put("/update", isLoggedIn, upload.single("qr"), async (req, res) => {
	try {
		console.log("req.file", req.file);
		console.log("req.body", req.body);
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

		await Plan.deleteMany({ subdRef: subdRes._id });
		const plans = JSON.parse(req.body.plans).map((plan) => ({
			...plan,
			...{ _id: new mongoose.Types.ObjectId(), subdRef: subdRes._id },
		}));
		const plansRes = await Plan.insertMany(plans);
		return res.json(RESPONSE.success(200, { ...subdRes, ...{ plans: plansRes } }));
	} catch (e) {
		console.log(RESPONSE.fail(400, { e }));
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

export default router;
