import Email from "email-templates";

const { EMAIL_ADDRESS, EMAIL_PASSWORD } = process.env;

export const from = {
	name: "COOL GEEKS",
	address: EMAIL_ADDRESS,
};

export const email = ({ send, preview }) => {
	try {
		return new Email({
			preview: preview,
			views: { root: path.join(process.cwd(), "emails") },
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
		console.error(error);
	}
};
