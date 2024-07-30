import mongoose from "../db/connection.js";
import { SchemaTypes } from "mongoose";

const ReceiptReasonSchema = new mongoose.Schema(
	{
		_id: { type: SchemaTypes.ObjectId, required: true },
		receiptRef: { type: SchemaTypes.ObjectId, ref: "Receipt", required: true },
		content: { type: String, required: true },
	},
	{ timestamps: true }
);

const ReceiptReason = mongoose.model("ReceiptReason", ReceiptReasonSchema);

export default ReceiptReason;
