import mongoose from "../db/connection.js";

const SubdSchema = new mongoose.Schema(
	{
		_id: { type: String, required: true },
		name: { type: String, required: true },
		code: { type: String, required: true },
		gcash: {
			qr: {
				filename: { type: String, required: true },
				contentType: { type: String, required: true },
			},
			number: { type: String, required: true },
		},
	},
	{ timestamps: true }
);

const Subd = mongoose.model("Subd", SubdSchema);

export default Subd;
