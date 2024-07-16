import "dotenv/config.js";
import Router from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
// import isLoggedIn from "./middleware.js";
import User from "../models/User.js";
import Subd from "../models/Subd.js";
import Plan from "../models/Plan.js";
import Token from "../models/Token.js";
import { CONSTANTS, LOG, RESPONSE, TOKEN } from "../utility.js";
import { sendMail } from "../mailing.js";

const router = Router();

const getUser = async (emailAccountNo) =>
	await User.findOne(
		{ $or: [{ accountNumber: emailAccountNo }, { email: emailAccountNo }] },
		"-_id accountNumber email status"
	);

router.get("/", async (req, res) => {
	try {
		const { query } = req;
		const input = JSON.parse(query.filter).input;
		const user = await getUser(input);
		res.status(200).json(RESPONSE.success(200, user || { status: null }));
	} catch (e) {
		LOG.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

const test = async (req, res, activation) => {
	try {
		const user = await User.findOne(
			{
				$or: [{ accountNumber: req.body.emailAccountNo }, { email: req.body.emailAccountNo }],
				status: CONSTANTS.ACCOUNT_STATUS.STANDARD,
			},
			"-_id"
		).populate("planRef subdRef");
		console.log("test", user);
		if (user) {
			if (user.status === CONSTANTS.ACCOUNT_STATUS.DEACTIVATED)
				return res.status(403).json(
					RESPONSE.fail(403, {
						general:
							"Account has been deactivated. Please contact [number here] or [number here] for info or reactivation",
					})
				);

			console.log("req.body.password", req.body.password);
			console.log("user.password", user.password);
			const passwordValid = req.body.password
				? await bcrypt.compare(req.body.password, user.password)
				: null;
			if (passwordValid || activation) {
				const userObj = {
					accountNumber: user.accountNumber,
					admin: user.admin,
					generatedVia: "LOGIN",
				};
				const accessToken = TOKEN.create(userObj);
				const refreshToken = jwt.sign(userObj, process.env.REFRESH_TOKEN_SECRET);

				Token.create({
					...{ _id: new mongoose.Types.ObjectId() },
					...{
						accountNumber: user.accountNumber,
						token: refreshToken,
					},
				});

				const subd = await Subd.findOne({ _id: user.subdRef });
				const plan = await Plan.findOne({ _id: user.planRef });
				user.password = undefined;

				res.cookie("accessToken", accessToken, TOKEN.options(CONSTANTS.accessTokenAge));
				res.cookie("refreshToken", refreshToken, TOKEN.options(CONSTANTS.refreshTokenAge));
				res.status(200).json(RESPONSE.success(200, { user, plan, subd }));
			} else {
				res.status(400).json(RESPONSE.fail(400, { general: "Email or Password is incorrect" }));
			}
		} else {
			res.status(400).json(RESPONSE.fail(400, { general: "User doesn't exist" }));
		}
	} catch (e) {
		console.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
};

router.post("/login", async (req, res) => {
	return await test(req, res);
	// try {
	// 	const user = await User.findOne(
	// 		{
	// 			$or: [{ accountNumber: req.body.emailAccountNo }, { email: req.body.emailAccountNo }],
	// 			status: CONSTANTS.ACCOUNT_STATUS.STANDARD,
	// 		},
	// 		"-_id"
	// 	).populate("planRef subdRef");

	// 	if (user) {
	// 		if (user.status === CONSTANTS.ACCOUNT_STATUS.DEACTIVATED)
	// 			return res.status(403).json(
	// 				RESPONSE.fail(403, {
	// 					general:
	// 						"Account has been deactivated. Please contact [number here] or [number here] for info or reactivation",
	// 				})
	// 			);
	// 		const result = await bcrypt.compare(req.body.password, user.password);
	// 		if (result) {
	// 			const userObj = {
	// 				accountNumber: user.accountNumber,
	// 				admin: user.admin,
	// 				generatedVia: "LOGIN",
	// 			};
	// 			const accessToken = TOKEN.create(userObj);
	// 			const refreshToken = jwt.sign(userObj, process.env.REFRESH_TOKEN_SECRET);

	// 			Token.create({
	// 				...{ _id: new mongoose.Types.ObjectId() },
	// 				...{
	// 					accountNumber: user.accountNumber,
	// 					token: refreshToken,
	// 				},
	// 			});

	// 			const subd = await Subd.findOne({ _id: user.subdRef });
	// 			const plan = await Plan.findOne({ _id: user.planRef });
	// 			user.password = undefined;

	// 			res.cookie("accessToken", accessToken, TOKEN.options(CONSTANTS.accessTokenAge));
	// 			res.cookie("refreshToken", refreshToken, TOKEN.options(CONSTANTS.refreshTokenAge));
	// 			res.status(200).json(RESPONSE.success(200, { user, plan, subd }));
	// 		} else {
	// 			res.status(400).json(RESPONSE.fail(400, { general: "Email or Password is incorrect" }));
	// 		}
	// 	} else {
	// 		res.status(400).json(RESPONSE.fail(400, { general: "User doesn't exist" }));
	// 	}
	// } catch (e) {
	// 	console.error(e);
	// 	res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	// }
});

router.delete("/logout", async (req, res) => {
	try {
		res.clearCookie("accessToken", { path: "/" });
		res.clearCookie("refreshToken", { path: "/" });
		LOG.success("LOGOUT", "Logout successful");
		res.status(200).json(RESPONSE.success(200, { general: "Logout successful" }));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, e));
	}
});

router.put("/verify-email", async (req, res) => {
	try {
		const { body } = req;
		let { emailAccountNo, password, confirmPassword } = body;

		// validate
		if (password !== confirmPassword)
			res.status(400).json(RESPONSE.fail(400, { message: "Passwords do not match" }));

		// create hashed password
		console.log(1, emailAccountNo);
		console.log(1, confirmPassword);
		console.log(1, password);
		password = await bcrypt.hash(password, 10);
		console.log(2, password);

		const user = await User.findOneAndUpdate(
			{
				$or: [{ accountNumber: emailAccountNo }, { email: emailAccountNo }],
			},
			{ password: password, status: CONSTANTS.ACCOUNT_STATUS.VERIFY }
		);

		if (!user) res.status(400).json(RESPONSE.fail(400, { message: "User does not exist" }));

		const token = jwt.sign({ emailAccountNo: emailAccountNo }, process.env.EMAIL_VERIFY_SECRET, {
			expiresIn: CONSTANTS.verifyEmailTokenAge,
		});

		await Token.create({
			...{ _id: new mongoose.Types.ObjectId() },
			...{
				accountNumber: user.accountNumber,
				token: token,
			},
		});

		LOG.info("EMAIL TOKEN CREATED");

		sendMail({
			from: "COOL GEEKS",
			to: `aquinoarcie@gmail.com`,
			subject: "Account Verification Link",
			text: `Hello, asdasasda Please verify your email by
				  clicking this link: ${process.env.ORIGIN}/verify?u=${user.accountNumber}&t=${token} `,
		});

		res.status(200).json(RESPONSE.success(200, { general: "aboot" }));
	} catch (e) {
		console.error(e);
		res.status(400).json(RESPONSE.fail(400, { e: e.message }));
	}
});

router.put("/activate", async (req, res) => {
	try {
		const { accountNumber, token } = req.body;

		const existingToken = await Token.findOne({
			accountNumber: accountNumber,
			token: token,
		});

		if (!existingToken)
			res
				.status(400)
				.json(
					RESPONSE.fail(400, { message: "Account verification expired. Please request a new one" })
				);

		console.log("accountNumber", accountNumber);
		const user = await User.findOneAndUpdate(
			{
				accountNumber: accountNumber,
				activated: false,
			},
			{ status: CONSTANTS.ACCOUNT_STATUS.STANDARD, activated: true },
			{
				new: true,
			}
		);
		if (user) {
			console.log("user", user);
			// if (!user)
			// return res.status(400).json(RESPONSE.fail(400, { message: "Account already activated" }));
			req.body.emailAccountNo = accountNumber;
			return await test(req, res, true);
		}
	} catch (e) {
		console.error(e);
		res.status(400).json(RESPONSE.fail(400, { e: e.message }));
	}
});

// router.post("/create", async (req, res) => {
// 	try {
// 		await User.create({
// 			...{ _id: new mongoose.Types.ObjectId() },
// 			...{ ...req.body, ...{ subdRef: req.body.subd._id, planRef: req.body.plan._id } },
// 		});
// 		res.status(200).json(RESPONSE.success(200, { general: "User created" }));
// 	} catch (e) {
// 		console.log(e);
// 		res.status(400).json(RESPONSE.fail(403, { message: e.message }));
// 	}
// });

// router.get("/", isLoggedIn, async (req, res) => {
// 	try {
// 		const { query } = req;
// 		const isAdmin = req.user.admin;
// 		console.log(query.filter);
// 		if (isAdmin) {
// 			const users = await User.find(query.filter ? JSON.parse(query.filter) : {}, null, {
// 				skip: (query.page - 1) * query.limit, // Starting Row
// 				limit: query.limit, // Ending Row
// 				sort: JSON.parse(query.sort),
// 			}).populate("subdRef planRef");
// 			const data = {
// 				list: users.length ? users : [],
// 			};
// 			res.status(200).json(RESPONSE.success(200, data));
// 		} else {
// 			res.status(400).json(RESPONSE.fail(400, { message: "User not authorized" }));
// 		}
// 	} catch (e) {
// 		LOG.error(e);
// 		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
// 	}
// });

// router.put("/update", isLoggedIn, async (req, res) => {
// 	try {
// 		const updateRes = await User.findOneAndUpdate({ _id: req.body._id }, req.body, {
// 			new: true,
// 		}).populate("subdRef planRef");
// 		res.status(200).json(RESPONSE.success(200, updateRes));
// 	} catch (e) {
// 		console.log(RESPONSE.fail(400, { e }));
// 		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
// 	}
// });

export default router;
