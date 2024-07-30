import mongoose from "../db/connection.js";
import { SchemaTypes } from "mongoose";

const TokenSchema = new mongoose.Schema(
	{
		_id: { type: SchemaTypes.ObjectId, required: true },
		accountNumber: { type: String, required: true },
		token: { type: String, required: true },
	},
	{ timestamps: true }
);

// User model
const Token = mongoose.model("Token", TokenSchema);

export default Token;
