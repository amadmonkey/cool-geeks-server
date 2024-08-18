import "dotenv/config.js";
import multer from "multer";
import Router from "express";
import mongoose from "mongoose";
import isLoggedIn from "./middleware.js";
import Subd from "../models/Subd.js";
import Plan from "../models/Plan.js";
import { CONSTANTS, LOG, RESPONSE } from "../utility.js";

// import { GoogleDriveService } from "../googleDriveService.js";
import { CloudinaryService } from "../cloudinary.js";

const router = Router();

const storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, CONSTANTS.TMP);
	},
	filename: function (req, file, callback) {
		callback(null, file.originalname);
	},
});

const upload = multer({ storage: storage });

// GET info
router.get("/", isLoggedIn, async (req, res) => {
	try {
		const { query } = req;

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

// GET image
router.get("/image", isLoggedIn, async (req, res) => {
	try {
		const { query } = req;
		// GDRIVE GET
		// const googleDriveService = new GoogleDriveService();
		// const gdriveRes = await googleDriveService.downloadFile(query.id);
		// res.header("Content-Type", "image/jpeg");
		// res.header("Content-Length", gdriveRes.data.size);
		// gdriveRes.data.stream().pipe(res);

		// CLOUDINARY GET
		console.log(query.id);
		const cloudinaryService = new CloudinaryService();
		const cloudinaryRes = await cloudinaryService.url(query.id);
		console.log("cloudinaryRes", cloudinaryRes);
		res.status(200).json(RESPONSE.success(200, cloudinaryRes));
	} catch (e) {
		LOG.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

// CREATE info + image
router.post("/create", upload.single("qr"), async (req, res) => {
	try {
		const filename = `${req.body.code.toUpperCase()}.${Date.now()}.${req.file.mimetype
			.split("/")
			.pop()}`;
		const form = {
			_id: new mongoose.Types.ObjectId(),
			name: req.body.name,
			code: req.body.code.toUpperCase(),
			qr: {
				filename: filename,
				contentType: req.file.mimetype,
			},
			number: req.body.number,
		};

		// GDRIVE UPLOAD
		// const googleDriveService = new GoogleDriveService();
		// const folderId = "1wjdmqX84ZIfoEIS4e_UUdKqi-vIpFhmz";
		// const imageId = await googleDriveService
		// 	.saveFile(req.file.filename, req.file.path, req.file.mimetype, folderId)
		// 	.catch((error) => {
		// 		throw error;
		// 	});

		// CLOUDINARY UPLOAD
		const cloudinaryService = new CloudinaryService();
		const cloudinaryRes = await cloudinaryService.upload(
			filename,
			req.file.path,
			CONSTANTS.FOLDER_ID.QR
		);
		console.log("cloudinaryRes", cloudinaryRes);

		const SaveSubd = new Subd({ ...form, ...{ imageId: cloudinaryRes.public_id } });
		const subdRes = await SaveSubd.save();
		const plans = JSON.parse(req.body.plans).map((plan) => ({
			...plan,
			...{ _id: new mongoose.Types.ObjectId(), subdRef: subdRes._id },
		}));
		await Plan.insertMany(plans);
		res.status(200).json(RESPONSE.success(200, subdRes));
	} catch (e) {
		LOG.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

// UPDATE info
router.put("/update", isLoggedIn, async (req, res) => {
	try {
		const form = {
			name: req.body.name,
			code: req.body.code.toUpperCase(),
			number: req.body.number,
		};

		const subdRes = await Subd.findOneAndUpdate({ _id: req.body._id }, form, {
			new: true,
		}).lean();

		const plansRes = await Plan.find({ subdRef: subdRes._id }).catch((error) =>
			res.status(400).json(RESPONSE.fail(400, { error }))
		);
		return res.json(RESPONSE.success(200, { ...subdRes, ...{ plans: plansRes } }));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

// UPDATE image
router.patch("/update", isLoggedIn, upload.single("qr"), async (req, res) => {
	try {
		const { file, body } = req;
		const form = {
			qr: {
				filename: file.originalname,
				contentType: file.mimetype,
			},
		};

		// const googleDriveService = new GoogleDriveService();
		const cloudinaryService = new CloudinaryService();

		// delete old file
		if (body.imageId) {
			// GDRIVE DELETE
			// const gdriveDeleteRes = await googleDriveService.deleteFile(body.imageId);
			// LOG.info("gdriveDeleteRes", gdriveDeleteRes);

			// CLOUDINARY DELETE
			const deleteRes = await cloudinaryService.destroy(body.imageId);
			LOG.info("deleteRes", deleteRes);
		}

		// GDRIVE UPLOAD
		// const newImageId = await googleDriveService
		// 	.saveFile(file.filename, file.path, file.mimetype, CONSTANTS.GDRIVE_ID.QR)
		// 	.catch((error) => {
		// 		throw error;
		// 	});
		// CLOUDINARY UPLOAD
		const cloudinaryRes = await cloudinaryService.upload(
			req.file.filename,
			req.file.path,
			CONSTANTS.FOLDER_ID.QR
		);
		console.log("cloudinaryRes", cloudinaryRes);

		await Subd.findOneAndUpdate(
			{ _id: body._id },
			{ ...form, imageId: cloudinaryRes.public_id },
			{ new: true }
		);

		const newImageUrl = cloudinaryService.url(cloudinaryRes.public_id);
		return res.json(RESPONSE.success(200, newImageUrl));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

// DELETE info + image
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
