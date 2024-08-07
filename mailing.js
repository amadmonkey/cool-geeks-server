import Email from "email-templates";

export const email = ({ send, preview }) => {
	try {
		// leaving this here might go back to nodemailer
		// const Transporter = nodemailer.createTransport({
		// 	host: "smtp.gmail.com",
		// 	port: 465,
		// 	secure: true,
		// 	auth: {
		// 		user: process.env.EMAIL_ADDRESS,
		// 		pass: process.env.EMAIL_PASSWORD,
		// 	},
		// });
		// return await Transporter.sendMail(options);

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
					user: process.env.EMAIL_ADDRESS,
					pass: process.env.EMAIL_PASSWORD,
				},
			},
		});
	} catch (error) {
		res.status(400).json(RESPONSE.fail(400, { message: error.message }));
	}
};

export const from = {
	name: "COOL GEEKS",
	address: process.env.EMAIL_ADDRESS,
};
