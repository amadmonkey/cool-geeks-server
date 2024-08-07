import mongoose from "../db/connection.js";
import { SchemaTypes } from "mongoose";

const ReceiptSchema = new mongoose.Schema(
	{
		_id: { type: SchemaTypes.ObjectId, required: true },
		gdriveId: { type: String },
		userRef: { type: SchemaTypes.ObjectId, ref: "User", required: true },
		planRef: { type: SchemaTypes.ObjectId, ref: "Plan", required: true },
		referenceType: { type: Object, required: true },
		referenceNumber: { type: String },
		receiptName: { type: String },
		receiptDate: { type: Date, required: true, default: new Date() }, // date the receipt is trying to pay
		cutoff: { type: String, required: true },
		status: { type: String, required: true, default: "PENDING" },
	},
	{ timestamps: true }
);

const Receipt = mongoose.model("Receipt", ReceiptSchema);

export default Receipt;
