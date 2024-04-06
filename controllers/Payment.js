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

router.post("/", isLoggedIn, async (req, res) => {
	try {
		const date = new Date();
		const month = date.getUTCMonth() + 1;
		const { _id } = await User.findOne({ accountNumber: req.user.accountNumber }, "_id");
		const payments = await Payment.find({ userId: _id });
		const currentPayment = await Payment.find({
			createdAt: { $gte: new Date("2024-04-01"), $lt: new Date("2024-04-01") },
		});
		const data = {
			list: payments.length ? payments : [],
			currentPayment: null,
		};
		res.status(200).json(RESPONSE.success(200, data));
	} catch (e) {
		LOG.error(e);
		res.status(400).json(RESPONSE.fail(400, { e }));
	}
});

router.post("/create", isLoggedIn, upload.single("receipt"), async (req, res) => {
	console.log(1);
	try {
		console.log(2);
		const user = await User.findOne({ accountNumber: req.user.accountNumber }, "_id planId");
		console.log(3);
		if (user) {
			console.log(4);
			const formData = {
				_id: new mongoose.Types.ObjectId(),
				userId: user._id,
				planId: user.planId,
				referenceType: req.body.referenceType,
				referenceNumber: req.body.referenceNumber,
				receiptName: req.body.receiptName,
			};
			const SavePayment = new Payment(formData);
			const uploadProcess = await SavePayment.save();
			return res.json(RESPONSE.success(200, uploadProcess));
		}
	} catch (e) {
		console.log(4);
		console.log(e);
		return res.status(400).json(RESPONSE.fail(400, { e }));
	}
});

export default router;
