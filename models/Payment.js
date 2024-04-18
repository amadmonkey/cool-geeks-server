import mongoose from "../db/connection.js";
import { SchemaTypes } from "mongoose";

const PaymentSchema = new mongoose.Schema(
	{
		_id: { type: SchemaTypes.ObjectId, required: true },
		userRef: { type: SchemaTypes.ObjectId, ref: "User", required: true },
		planRef: { type: SchemaTypes.ObjectId, ref: "Plan", required: true },
		referenceType: { type: Object, required: true },
		referenceNumber: { type: String },
		receiptName: { type: String },
		paymentDate: { type: Date, required: true, default: new Date() },
		cutoff: { type: String, required: true },
		status: { type: String, required: true, default: "PENDING" },
	},
	{ timestamps: true }
);

const Payment = mongoose.model("Payment", PaymentSchema);

export default Payment;
