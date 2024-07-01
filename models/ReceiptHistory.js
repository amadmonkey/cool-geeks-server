import mongoose from "../db/connection.js";
import { SchemaTypes } from "mongoose";

const ReceiptHistorySchema = new mongoose.Schema(
	{
		_id: { type: SchemaTypes.ObjectId, required: true },
		receiptRef: { type: SchemaTypes.ObjectId, ref: "Receipt", required: true },
		action: { type: String, required: true },
		description: { type: String },
	},
	{ timestamps: true }
);

const ReceiptHistory = mongoose.model("ReceiptHistory", ReceiptHistorySchema);

export default ReceiptHistory;
