import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const { REFRESH_TOKEN_SECRET, ACCESS_TOKEN_SECRET } = process.env;

export const CONSTANTS = {
	TMP: `${process.env.ENV === "DEVELOPMENT" ? "" : "/"}tmp`,
	ENV: {
		PROD: "PRODUCTION",
		DEV: "DEVELOPMENT",
	},
	FOLDER_ID: {
		QR: "qr",
		RECEIPT: "receipts",
	},
	RECEIPT_STATUS: {
		pending: "PENDING",
		accepted: "ACCEPTED",
		denied: "DENIED",
		failed: "FAILED",
	},
	ACCOUNT_STATUS: {
		STANDARD: "STANDARD", // can login
		PENDING: "PENDING", // cannot login, ask for password
		VERIFY: "VERIFY", // update password. waiting for verificaton from user.
		DEACTIVATED: "DEACTIVATED", // cannot login
	},
	CUTOFF: {
		mid: "MID",
		end: "END",
	},
	SEARCH_TYPE: {
		RECEIPT: {
			REFNO: "REFNO",
			USER: "USER",
			PLAN: "PLAN",
		},
	},
	MESSAGE: {
		AUTH: "Email or Password is incorrect",
		DNE: "User does not exist",
		DEACTIVATED:
			"Account has been deactivated. Please contact [number here] or [number here] for info or reactivation",
		INVALID_REFRESH_TOKEN: "Session expired. Create a new one by logging in.",
	},
};

export const TOKEN_AGE = {
	// ACCESS: 60000 * 60,
	ACCESS: 10000,
	REFRESH: 60000 * 60 * 6,
	VERIFY_EMAIL: 60000 * 60,
	PASSWORD_RESET: 60000 * 10,
};

export const toMongoRegex = (search) => {
	return { $regex: search, $options: "i" };
};

export const getFullUrl = (req) => req.protocol + "://" + req.get("host");

export const RESPONSE = {
	success: (code, data) => {
		// LOG.success(code, data);
		return { status: "SUCCESS", code: code, data: data };
	},
	fail: (code, data) => {
		LOG.error(code, data);
		return { status: "FAIL", code: code, data: data };
	},
};

export const LOG = {
	success: (label, message) => {
		console.log("\x1b[32m%s\x1b[0m", label ? label : "", message ? message : "");
	},
	error: (label, message) => {
		console.log("\x1b[31m%s\x1b[0m", label ? label : "", message ? message : "");
	},
	info: (label, message) => {
		console.log("\x1b[34m%s\x1b[0m", label ? label : "", message ? message : "");
	},
	general: (label, message) => {
		console.log("\x1b[0m%s\x1b[0m", label ? label : "", message ? message : "");
	},
};

const tokenOptions = (maxAge) => {
	return {
		...{
			httpOnly: true,
			sameSite: "lax",
			secure: false,
			overwrite: true,
		},
		...{ maxAge: maxAge },
	};
};

// TODO: think of a way to verify refresh token's user
// TODO: multiple refresh token requests. fix
export const TOKEN = {
	refresh: async (req, res, Token) => {
		try {
			const refreshToken = req.body.token;

			jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, async (err, user) => {
				const { accountNumber, admin } = user;

				// refresh token is invalid.
				if (err) res.status(403).json(RESPONSE.fail(403, { error: "refresh token did not match" }));

				// user does not match
				// const userMatches = await Token.findOne({ accountNumber: accountNumber });
				// if (!userMatches) {
				// 	await Token.deleteMany({ accountNumber: accountNumber });

				// 	return res
				// 		.status(403)
				// 		.json(RESPONSE.fail(403, { error: "No refresh token found. Redirect to logout" }));
				// }

				const userObj = {
					admin: admin,
					accountNumber: accountNumber,
					generatedVia: "TOKEN_REFRESH",
				};
				const accessToken = TOKEN.sign(userObj);
				const refreshToken = jwt.sign(userObj, REFRESH_TOKEN_SECRET);

				// delete token existing tokens
				// await Token.deleteMany({ accountNumber: accountNumber });

				// save new token to db
				// await Token.create({
				// 	...{ _id: new mongoose.Types.ObjectId() },
				// 	...{
				// 		accountNumber: accountNumber,
				// 		token: refreshToken,
				// 	},
				// });

				console.log("TOKEN REFRESH");

				res.cookie("accessToken", accessToken, tokenOptions(TOKEN_AGE.ACCESS));
				res.cookie("refreshToken", refreshToken, tokenOptions(TOKEN_AGE.REFRESH));
				return res.status(200).json(RESPONSE.success(200, { message: "token refresh successful" }));
			});
		} catch (e) {
			return res
				.status(400)
				.json(RESPONSE.fail(400, { message: "No refresh token found. Redirect to logout" }));
		}
	},
	sign: (tokenObj) => {
		return jwt.sign(tokenObj, ACCESS_TOKEN_SECRET, {
			expiresIn: TOKEN_AGE.ACCESS,
		});
	},
	remove: (accountNumber, Token) => tokenRemove(accountNumber, Token),
	options: (maxAge) => tokenOptions(maxAge),
};
