import mongoose from "../db/connection.js";
import { ObjectId } from "mongoose";

const PaymentSchema = new mongoose.Schema(
	{
		_id: { type: ObjectId, required: true },
		userId: { type: ObjectId, required: true },
		planId: { type: ObjectId, required: true },
		referenceType: { type: Object, required: true },
		referenceNumber: { type: String, required: true },
		receiptName: { type: String, required: true },
		status: { type: String, required: true, default: "PENDING" },
	},
	{ timestamps: true }
);

const Payment = mongoose.model("Payment", PaymentSchema);

export default Payment;
