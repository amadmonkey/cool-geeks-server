import "dotenv/config.js";
import Router from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";

import { email, from } from "../mailing.js";
import { CONSTANTS, getFullUrl, LOG, RESPONSE, TOKEN, TOKEN_AGE } from "../utility.js";

const router = Router();

const { REFRESH_TOKEN_SECRET, EMAIL_VERIFY_SECRET, ORIGIN } = process.env;

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

const login = async (req, res, activation) => {
	try {
		const user = await User.findOne(
			{
				$or: [{ accountNumber: req.body.emailAccountNo }, { email: req.body.emailAccountNo }],
				status: CONSTANTS.ACCOUNT_STATUS.STANDARD,
			},
			"-_id"
		).populate("planRef subdRef");

		if (user) {
			if (user.status === CONSTANTS.ACCOUNT_STATUS.DEACTIVATED) {
				return res.status(403).json(RESPONSE.fail(403, { general: CONSTANTS.MESSAGE.DEACTIVATED }));
			}

			const passwordValid = req.body.password
				? await bcrypt.compare(req.body.password, user.password)
				: null;
			if (passwordValid || activation) {
				const userObj = {
					accountNumber: user.accountNumber,
					admin: user.admin,
					generatedVia: "LOGIN",
				};
				const accessToken = TOKEN.sign(userObj);
				const refreshToken = jwt.sign(userObj, REFRESH_TOKEN_SECRET);

				// await Token.create({
				// 	...{ _id: new mongoose.Types.ObjectId() },
				// 	...{
				// 		accountNumber: user.accountNumber,
				// 		token: refreshToken,
				// 	},
				// });

				user.password = undefined;
				res.cookie("accessToken", accessToken, TOKEN.options(TOKEN_AGE.ACCESS));
				res.cookie("refreshToken", refreshToken, TOKEN.options(TOKEN_AGE.REFRESH));
				res.status(200).json(RESPONSE.success(200, { user }));
			} else {
				return res.status(400).json(RESPONSE.fail(400, { general: CONSTANTS.MESSAGE.AUTH }));
			}
		} else {
			return res.status(400).json(RESPONSE.fail(400, { general: CONSTANTS.MESSAGE.DNE }));
		}
	} catch (e) {
		console.error("LOGIN CATCH", e);
		return res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
};

router.post("/login", async (req, res) => {
	return await login(req, res);
});

router.delete("/logout", async (req, res) => {
	try {
		res.clearCookie("accessToken", { path: "/" });
		res.clearCookie("refreshToken", { path: "/" });
		LOG.success("LOGOUT", "Logout successful");
		res.status(200).json(RESPONSE.success(200, { general: "Logout successful" }));
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.put("/verify-email", async (req, res) => {
	try {
		const { body } = req;
		let { emailAccountNo, password, confirmPassword } = body;

		const user = await User.findOne({
			$or: [{ accountNumber: emailAccountNo }, { email: emailAccountNo }],
		});

		if (user.status === CONSTANTS.ACCOUNT_STATUS.PENDING) {
			if (!password || !confirmPassword || password !== confirmPassword)
				return res.status(400).json(RESPONSE.fail(400, { message: "Passwords do not match" }));

			password = await bcrypt.hash(password, 10);
			const userRes = await User.findOneAndUpdate(
				{
					$or: [{ accountNumber: emailAccountNo }, { email: emailAccountNo }],
					status: CONSTANTS.ACCOUNT_STATUS.PENDING,
				},
				{ password: password, status: CONSTANTS.ACCOUNT_STATUS.VERIFY, active: false }
			);

			// TODO: check if already has token. if has, return error need to wait for 5 minutes
			const token = jwt.sign({ emailAccountNo: emailAccountNo }, EMAIL_VERIFY_SECRET, {
				expiresIn: TOKEN_AGE.VERIFY_EMAIL,
			});

			// if dev preview = true, if prod preview = false
			email({
				send: process.env.ENV === CONSTANTS.ENV.PROD,
				preview: process.env.ENV === CONSTANTS.ENV.DEV,
			})
				.send({
					template: "verify-account",
					message: {
						to: user.email,
						from: from,
					},
					locals: {
						name: `${user.firstName} ${user.lastName}`,
						dirname: getFullUrl(req),
						accountNumber: user.accountNumber,
						link: `${ORIGIN}/verify?a=activate&u=${user.accountNumber}&t=${token}`,
					},
				})
				.then(console.log)
				.catch(console.error);

			res.status(200).json(
				RESPONSE.success(200, {
					general: "Email verification sent. Please check your email inbox for the link.",
				})
			);
		}
	} catch (err) {
		console.error(err);
		res.status(400).json(RESPONSE.fail(400, { message: err.message }));
	}
});

router.put("/activate", async (req, res) => {
	try {
		const { accountNumber, token } = req.body;

		// TODO: add checking for user's status for re-sent emails
		// e.g: if verify = continue, else = return already activated,

		jwt.verify(token, EMAIL_VERIFY_SECRET, async (err, user) => {
			if (err) {
				console.log("activate jwt error", err);
				return res.status(403).json(RESPONSE.fail(403, { message: "TOKEN_INVALID" }));
			}

			const updatedUser = await User.findOneAndUpdate(
				{
					accountNumber: accountNumber,
					status: CONSTANTS.ACCOUNT_STATUS.VERIFY,
					activated: false,
				},
				{ status: CONSTANTS.ACCOUNT_STATUS.STANDARD, activated: true },
				{
					new: true,
				}
			);
			if (updatedUser) {
				req.body.emailAccountNo = accountNumber;
				return await login(req, res, true);
			} else {
				res.status(400).json(RESPONSE.fail(400, { message: "USER" }));
			}
		});
	} catch (e) {
		console.error(e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.put("/reset-password", async (req, res) => {
	try {
		// reset password
		const { accountNumber, token } = req.body;
		// const existingToken = await Token.findOne({
		// 	accountNumber: accountNumber,
		// 	token: token,
		// });

		jwt.verify(token, EMAIL_VERIFY_SECRET, async (err, user) => {
			if (err) {
				console.log("activate jwt error", err);
				return res.status(403).json(RESPONSE.fail(403, { message: "TOKEN_INVALID" }));
			}

			const updatedUser = await User.findOneAndUpdate(
				{
					accountNumber: accountNumber,
				},
				{ status: CONSTANTS.ACCOUNT_STATUS.PENDING, activated: false, password: "" },
				{
					new: true,
				}
			);
			if (updatedUser) {
				res.status(200).json(RESPONSE.success(200, updatedUser));
			} else {
				res.status(400).json(RESPONSE.fail(400, { message: "USER_" }));
			}
		});
	} catch (e) {
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.put("/reset-password-request", async (req, res) => {
	try {
		const { body } = req;
		let { emailAccountNo } = body;

		const user = await User.findOne({
			$or: [{ accountNumber: emailAccountNo }, { email: emailAccountNo }],
		});

		if (user) {
			// generate token
			const token = jwt.sign({ emailAccountNo: emailAccountNo }, EMAIL_VERIFY_SECRET, {
				expiresIn: TOKEN_AGE.PASSWORD_RESET,
			});

			await email({ send: true, preview: false })
				.send({
					template: "forgot-password",
					message: {
						to: user.email,
						from: from,
					},
					locals: {
						name: `${user.firstName} ${user.lastName}`,
						dirname: getFullUrl(req),
						accountNumber: user.accountNumber,
						link: `${ORIGIN}/verify?a=reset&u=${user.accountNumber}&t=${token}`,
					},
				})
				.then(console.log)
				.catch(console.error);

			res
				.status(200)
				.json(RESPONSE.success(200, { message: "Password reset confirmation link sent to email" }));
		} else {
			// user does not exist
			res.status(400).json(RESPONSE.fail(400, { message: "Account does not exist" }));
		}
	} catch (e) {
		LOG.error("/reset-password-request", e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

router.get("/email-test", async (req, res) => {
	try {
		const { query } = req;
		const accountNumber = query.u || "PES-2024-0007";
		await email({ send: false, preview: true })
			.send({
				template: "account-created",
				message: {
					to: "aquinoarcie@gmail.com",
					from: from,
				},
				locals: {
					name: `Steve from Minecraft`,
					dirname: getFullUrl(req),
					accountNumber: accountNumber,
					link: `${ORIGIN}/verify?a=reset&u=${accountNumber}&t=${"token_here"}`,
				},
			})
			.then(() => res.status(200).json(RESPONSE.success(200, { message: "Email sent" })))
			.catch((err) => {
				console.log(err);
				res.status(400).json(RESPONSE.fail(400, { message: err.message }));
			});
	} catch (e) {
		LOG.error("/email-test", e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

export default router;
