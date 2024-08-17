import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const { REFRESH_TOKEN_SECRET, ACCESS_TOKEN_SECRET } = process.env;

export const CONSTANTS = {
	// accessTokenAge: 10000,
	FOLDER_ID: {
		QR: "qr",
		RECEIPT: "receipt",
	},
	accessTokenAge: 60000 * 60,
	refreshTokenAge: 60000 * 60 * 6,
	verifyEmailTokenAge: 60000 * 60,
	passwordResetTokenAge: 60000 * 10,
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
};

export const SEARCH_TYPE = {
	RECEIPT: {
		REFNO: "REFNO",
		USER: "USER",
		PLAN: "PLAN",
	},
};

export const toRegex = (search) => {
	return { $regex: search, $options: "i" };
};

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

const tokenRemove = async (accountNumber, Token) => {
	return Token.deleteMany({ accountNumber: accountNumber });
};

export const getFullUrl = (req) => req.protocol + "://" + req.get("host");

export const TOKEN = {
	refresh: async (req, res, Token) => {
		try {
			const refreshToken = req.body.token;
			const { accountNumber } = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
			if (!refreshToken) {
				tokenRemove(accountNumber, Token);
				return res
					.status(401)
					.json(RESPONSE.fail(401, { error: "No refresh token found. Redirect to logout" }));
			}

			// const existingToken = await Token.findOne({ accountNumber: accountNumber });
			// if (!existingToken) {
			// 	tokenRemove(accountNumber, Token);
			// 	return res
			// 		.status(403)
			// 		.json(RESPONSE.fail(403, { error: "No refresh token found. Redirect to logout" }));
			// }

			jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, async (err, user) => {
				if (err) res.status(403).json(RESPONSE.fail(403, { error: "refresh token did not match" }));

				const userObj = {
					accountNumber: user.accountNumber,
					admin: user.admin,
					generatedVia: "TOKEN_REFRESH",
				};
				const accessToken = TOKEN.create(userObj);
				const refreshToken = jwt.sign(userObj, REFRESH_TOKEN_SECRET);

				// delete token existing tokens
				const tokenRemoveResponse = await tokenRemove(accountNumber, Token);

				// save new token to db
				const tokenCreateResponse = Token.create({
					...{ _id: new mongoose.Types.ObjectId() },
					...{
						accountNumber: user.accountNumber,
						token: refreshToken,
					},
				});

				res.cookie("accessToken", accessToken, tokenOptions(CONSTANTS.accessTokenAge));
				res.cookie("refreshToken", refreshToken, tokenOptions(CONSTANTS.refreshTokenAge));
				return res.status(200).json(RESPONSE.success(200, { message: "token refresh successful" }));
			});
		} catch (e) {
			return res
				.status(400)
				.json(RESPONSE.fail(400, { message: "No refresh token found. Redirect to logout" }));
		}
	},
	create: (tokenObj) => {
		return jwt.sign(tokenObj, ACCESS_TOKEN_SECRET, {
			expiresIn: CONSTANTS.accessTokenAge,
		});
	},
	remove: (accountNumber, Token) => tokenRemove(accountNumber, Token),
	options: (maxAge) => tokenOptions(maxAge),
};
