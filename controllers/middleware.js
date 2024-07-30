import "dotenv/config.js";
import jwt from "jsonwebtoken";
import { RESPONSE, LOG } from "../utility.js";

const isLoggedIn = async (req, res, next) => {
	try {
		if (req.headers.authorization) {
			const token = req.headers.authorization.split(" ")[1];
			if (token) {
				const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
				if (payload) {
					req.user = payload;
					next();
				} else {
					LOG.error("token verification failed");
					res.status(401).json(RESPONSE.fail(401, { error: "token verification failed" }));
				}
			} else {
				LOG.error("malformed auth header");
				res.status(401).json(RESPONSE.fail(401, { error: "malformed auth header" }));
			}
		} else {
			LOG.error("No authorization header");
			res.status(401).json(RESPONSE.fail(401, { error: "No authorization header" }));
		}
	} catch (error) {
		LOG.error("middleware", error);
		res.status(401).json(RESPONSE.fail(401, { error }));
	}
};

export default isLoggedIn;
