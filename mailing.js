import nodemailer from "nodemailer";

export const sendMail = async (options) => {
	try {
		const Transporter = nodemailer.createTransport({
			host: "smtp.gmail.com",
			port: 465,
			secure: true,
			auth: {
				user: process.env.EMAIL_ADDRESS,
				pass: process.env.EMAIL_PASSWORD,
			},
		});
		return await Transporter.sendMail(options);
	} catch (error) {
		console.log(error);
	}
};
