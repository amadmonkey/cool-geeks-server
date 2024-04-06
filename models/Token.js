import mongoose from "../db/connection.js";

const TokenSchema = new mongoose.Schema(
	{
		_id: { type: String, required: true },
		accountNumber: { type: String, required: true },
		token: { type: String, required: true },
	},
	{ timestamps: true }
);

// User model
const Token = mongoose.model("Token", TokenSchema);

export default Token;
