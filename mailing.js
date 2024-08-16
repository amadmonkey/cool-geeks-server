import Email from "email-templates";
import url from "url";
import path from "path";

import { LOG } from "./utility.js";
const { EMAIL_ADDRESS, EMAIL_PASSWORD } = process.env;

export const from = {
	name: "COOL GEEKS",
	address: EMAIL_ADDRESS,
};

export const email = ({ send, preview }) => {
	try {
		return new Email({
			preview: preview,
			send: send,
			transport: {
				// uncomment below for testing
				// jsonTransport: true,
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
