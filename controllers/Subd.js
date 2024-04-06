import "dotenv/config.js";
import multer from "multer";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import Subd from "../models/Subd.js";

const router = Router();

const storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, "uploads/qr");
	},
	filename: function (req, file, callback) {
		const extArray = file.mimetype.split("/");
		const ext = extArray[extArray.length - 1];
		callback(null, `${req.user.accountNumber}.${Date.now()}.${ext}`);
	},
});

const upload = multer({ storage: storage });

router.get("/", isLoggedIn, async (req, res) => {
	res.json(await Subd.find().catch((error) => res.status(400).json(RESPONSE.fail(400, { error }))));
});

router.post("/create", isLoggedIn, upload.single("gcashQR"), async (req, res) => {
	try {
		const formData = {
			_id: new mongoose.Types.ObjectId(),
			name: req.body.name,
			code: req.body.code,
			gcash: {
				qr: {
					filename: req.file.filename,
					contentType: req.file.mimetype,
				},
				number: req.body.gcashNo,
			},
		};
		// const SaveSubd = new Subd(formData);
		// const uploadProcess = await SaveSubd.save();
		// res.json(uploadProcess);
	} catch (e) {
		res.status(400).json(RESPONSE.error({ e }));
	}
});

export default router;
