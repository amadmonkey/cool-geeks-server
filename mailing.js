import Email from "email-templates";

import { LOG } from "./utility.js";
const { EMAIL_ADDRESS, EMAIL_PASSWORD } = process.env;

export const from = {
	name: "COOL GEEKS",
	address: EMAIL_ADDRESS,
};

//
export const email = ({ send, preview, url }) => {
	try {
		return new Email({
			preview: preview,
			views: { root: url },
			send: send,
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
