import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export const CONSTANTS = {
	accessTokenAge: 60000 * 60,
	refreshTokenAge: 60000 * 60 * 6,
	// accessTokenAge: 10000,
	// refreshTokenAge: 60000 * 60 * 6,
	PAYMENT_STATUS: {
		pending: "PENDING",
		accepted: "ACCEPTED",
		denied: "DENIED",
		failed: "FAILED",
	},
};

export const RESPONSE = {
	success: (code, data) => {
		return { status: "SUCCESS", code: code, data: data };
	},
	fail: (code, data) => {
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

export const TOKEN = {
	refresh: async (req, res, Token) => {
		try {
			console.log(req.body);
			const refreshToken = req.body.token;
			console.log("refreshToken", refreshToken);
			const { accountNumber } = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
			if (!refreshToken) {
				tokenRemove(accountNumber, Token);
				return res
					.status(401)
					.json(RESPONSE.fail(401, { error: "No refresh token found. Redirect to logout" }));
			}

			const existingToken = await Token.findOne({ accountNumber: accountNumber });
			if (!existingToken) {
				tokenRemove(accountNumber, Token);
				return res
					.status(403)
					.json(RESPONSE.fail(403, { error: "No refresh token found. Redirect to logout" }));
			}

			jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
				if (err)
					return res.status(403).json(RESPONSE.fail(403, { error: "refresh token did not match" }));

				const userObj = {
					accountNumber: user.accountNumber,
					admin: user.admin,
					generatedVia: "TOKEN_REFRESH",
				};
				const accessToken = TOKEN.create(userObj);
				const refreshToken = jwt.sign(userObj, process.env.REFRESH_TOKEN_SECRET);

				// delete token existing tokens
				const tokenRemoveResponse = await tokenRemove(accountNumber, Token);
				console.log("tokenRemoveResponse", tokenRemoveResponse);

				// save new token to db
				const tokenCreateResponse = Token.create({
					...{ _id: new mongoose.Types.ObjectId() },
					...{
						accountNumber: user.accountNumber,
						token: refreshToken,
					},
				});
				console.log("tokenCreateResponse", tokenCreateResponse);

				res.cookie("accessToken", accessToken, tokenOptions(CONSTANTS.accessTokenAge));
				res.cookie("refreshToken", refreshToken, tokenOptions(CONSTANTS.refreshTokenAge));
				console.log(RESPONSE.success(200, { message: "token refresh successful" }));
				res.status(200).json(RESPONSE.success(200, { message: "token refresh successful" }));
			});
		} catch (e) {
			console.error(e);
			res.status(400).json(RESPONSE.fail(403, { e }));
		}
	},
	create: (tokenObj) => {
		return jwt.sign(tokenObj, process.env.ACCESS_TOKEN_SECRET, {
			expiresIn: CONSTANTS.accessTokenAge,
		});
	},
	remove: (accountNumber, Token) => tokenRemove(accountNumber, Token),
	options: (maxAge) => tokenOptions(maxAge),
};
