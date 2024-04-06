import "dotenv/config.js";
import Router from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Token from "../models/Token.js";
import { LOG, RESPONSE, TOKEN } from "../utility.js";

const router = Router();

const generateAccessToken = (tokenObj) =>
	jwt.sign(tokenObj, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1m" });

const getOptions = (maxAge) => {
	return {
		...{
			httpOnly: true, // Cookie will not be exposed to client side code
			sameSite: "lax", // If client and server origins are different
			secure: false, // use with HTTPS only
			overwrite: true,
		},
		...{ maxAge: maxAge },
	};
};

router.post("/refresh", async (req, res) => {
	return await TOKEN.refresh(req, res, Token);
	// try {
	// 	const refreshToken = req.body.token;
	// 	const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
	// 	if (!refreshToken) {
	// 		deleteTokens(payload);
	// 		return res
	// 			.status(401)
	// 			.json(RESPONSE.fail(403, { error: "no refresh token found. redirect to logout" }));
	// 	}

	// 	const existingToken = await Token.findOne({ accountNumber: payload.accountNumber });
	// 	if (!existingToken) {
	// 		deleteTokens(payload);
	// 		return res
	// 			.status(403)
	// 			.json(RESPONSE.fail(403, { error: "no refresh token found. redirect to logout" }));
	// 	}

	// 	jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
	// 		if (err)
	// 			return res.status(403).json(RESPONSE.fail(403, { error: "refresh token did not match" }));

	// 		const userObj = {
	// 			accountNumber: user.accountNumber,
	// 			generatedVia: "token refresh",
	// 		};
	// 		const accessToken = generateAccessToken(userObj);
	// 		const refreshToken = jwt.sign(userObj, process.env.REFRESH_TOKEN_SECRET);

	// 		Token.create({
	// 			...{ _id: new mongoose.Types.ObjectId() },
	// 			...{
	// 				accountNumber: user.accountNumber,
	// 				token: refreshToken,
	// 			},
	// 		});

	// 		res.cookie("accessToken", accessToken, getOptions(1 * minute));
	// 		res.cookie("refreshToken", refreshToken, getOptions(60 * minute));

	// 		res.status(200).json(RESPONSE.success(200, { message: "token refresh successful" }));
	// 	});
	// } catch (e) {
	// 	console.error(e);
	// 	res.status(400).json(RESPONSE.fail(403, { e }));
	// }
});

// router.deleteToken = async (req, res) => {
// 	Token.deleteMany({ accountNumber: payload.accountNumber }).then((res) => {
// 		LOG.info("DELETE TOKENS", res);
// 	});
// };

// router.refreshToken = async (req, res) => {
// 	try {
// 		const refreshToken = req.body.token;
// 		const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
// 		if (!refreshToken) {
// 			deleteTokens(payload);
// 			return res
// 				.status(401)
// 				.json(RESPONSE.fail(403, { error: "no refresh token found. redirect to logout" }));
// 		}

// 		const existingToken = await Token.findOne({ accountNumber: payload.accountNumber });
// 		if (!existingToken) {
// 			deleteTokens(payload);
// 			return res
// 				.status(403)
// 				.json(RESPONSE.fail(403, { error: "no refresh token found. redirect to logout" }));
// 		}

// 		jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
// 			if (err)
// 				return res.status(403).json(RESPONSE.fail(403, { error: "refresh token did not match" }));

// 			const userObj = {
// 				accountNumber: user.accountNumber,
// 				generatedVia: "token refresh",
// 			};
// 			const accessToken = generateAccessToken(userObj);
// 			const refreshToken = jwt.sign(userObj, process.env.REFRESH_TOKEN_SECRET);

// 			Token.create({
// 				...{ _id: new mongoose.Types.ObjectId() },
// 				...{
// 					accountNumber: user.accountNumber,
// 					token: refreshToken,
// 				},
// 			});

// 			res.cookie("accessToken", accessToken, getOptions(1 * minute));
// 			res.cookie("refreshToken", refreshToken, getOptions(60 * minute));

// 			res.status(200).json(RESPONSE.success(200, { message: "token refresh successful" }));
// 		});
// 	} catch (e) {
// 		console.error(e);
// 		res.status(400).json(RESPONSE.fail(403, { e }));
// 	}
// };

export default router;
