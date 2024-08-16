import Email from "email-templates";

import { getFullUrl, LOG } from "./utility.js";
const { EMAIL_ADDRESS, EMAIL_PASSWORD } = process.env;

export const from = {
	name: "COOL GEEKS",
	address: EMAIL_ADDRESS,
};

export const email = ({ send, preview, url }) => {
	try {
		return new Email({
			preview: preview,
			send: send,
			views: { root: `${url}/emails` },
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
