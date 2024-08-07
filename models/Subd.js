import mongoose from "../db/connection.js";
import { SchemaTypes } from "mongoose";

const SubdSchema = new mongoose.Schema(
	{
		_id: { type: SchemaTypes.ObjectId, required: true },
		gdriveId: { type: String },
		name: { type: String, required: true },
		code: { type: String, required: true },
		plans: {},
		gcash: {
			qr: {
				filename: { type: String, required: true },
				contentType: { type: String, required: true },
			},
			number: { type: String, required: true },
		},

		active: { type: Boolean, default: true, required: true },
	},
	{ timestamps: true }
);

const Subd = mongoose.model("Subd", SubdSchema);

export default Subd;
