import "dotenv/config.js";
import multer from "multer";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import Subd from "../models/Subd.js";
import Plan from "../models/Plan.js";
import { LOG, RESPONSE } from "../utility.js";
import { GoogleDriveService } from "../googleDriveService.js";

const router = Router();

const storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, "public/uploads/qr");
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
		// console.log("query", query);

		const subdData = await Subd.find(query.filter ? JSON.parse(query.filter) : {})
			.collation({ locale: "en", strength: 2 })
			.skip((query.page - 1) * query.limit)
			.limit(query.limit)
			.sort(JSON.parse(query.sort))
			.lean();

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
			code: req.body.code.toUpperCase(),
			gcash: {
				qr: {
					filename: req.file.filename,
					contentType: req.file.mimetype,
				},
				number: req.body.number,
			},
		};

		// gdrive upload file
		const googleDriveService = new GoogleDriveService();
		const folderId = "1wjdmqX84ZIfoEIS4e_UUdKqi-vIpFhmz";
		console.log(req.file.path);
		const gdriveId = await googleDriveService
			.saveFile(req.file.filename, req.file.path, req.file.mimetype, folderId)
			.catch((error) => {
				throw error;
			});

		const SaveSubd = new Subd({ ...form, ...{ gdriveId: gdriveId } });
		const subdRes = await SaveSubd.save();
		const plans = JSON.parse(req.body.plans).map((plan) => ({
			...plan,
			...{ _id: new mongoose.Types.ObjectId(), subdRef: subdRes._id },
		}));
		await Plan.insertMany(plans);
		res.status(200).json(RESPONSE.success(200, subdRes));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
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

router.put("/update", isLoggedIn, upload.single("qr"), async (req, res) => {
	try {
		const form = {
			gdriveId: req.body.gdriveId,
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

		console.log(req.body);

		const googleDriveService = new GoogleDriveService();
		const folderId = "1wjdmqX84ZIfoEIS4e_UUdKqi-vIpFhmz";

		// delete old file
		if (form.gdriveId) {
			const gdriveDeleteRes = await googleDriveService.deleteFile(form.gdriveId);
			console.log("gdriveDeleteRes", gdriveDeleteRes);
		}

		// create new file
		const gdriveId = await googleDriveService
			.saveFile(req.file.filename, req.file.destination, req.file.mimetype, folderId)
			.catch((error) => {
				throw error;
			});

		const subdRes = await Subd.findOneAndUpdate(
			{ _id: req.body._id },
			{ ...form, ...{ gdriveId: gdriveId } },
			{
				new: true,
			}
		).lean();
		const plansRes = await Plan.find({ subdRef: subdRes._id }).catch((error) =>
			res.status(400).json(RESPONSE.fail(400, { error }))
		);
		return res.json(RESPONSE.success(200, { ...subdRes, ...{ plans: plansRes } }));
	} catch (e) {
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
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

export default router;
