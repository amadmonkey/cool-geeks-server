import Email from "email-templates";
import path from "path";

import url from "url";

import { getFullUrl, LOG } from "./utility.js";
const { EMAIL_ADDRESS, EMAIL_PASSWORD } = process.env;

export const from = {
	name: "COOL GEEKS",
	address: EMAIL_ADDRESS,
};

export const email = ({ send, preview, url }) => {
	try {
		const __filename = url.fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);

		console.log("__filename", __filename);
		console.log("__dirname", __dirname);

		return new Email({
			preview: preview,
			send: send,
			views: { root: __dirname },
			transport: {
				host: "smtp.gmail.com",
				port: 465,
				secure: true,
				auth: {
					user: EMAIL_ADDRESS,
					pass: EMAIL_PASSWORD,
				},
			},
		});
	} catch (error) {
		LOG.error(error);
	}
};
