import mongoose from "../db/connection.js";
import { SchemaTypes } from "mongoose";

const PlanSchema = new mongoose.Schema(
	{
		_id: { type: SchemaTypes.ObjectId, required: true },
		subdRef: { type: SchemaTypes.ObjectId, ref: "Subd", required: true },
		name: { type: String, required: true },
		description: { type: String, required: false },
		price: { type: Number, required: true },
		isActive: { type: Boolean, default: true, required: true },
	},
	{ timestamps: true }
);

const Plan = mongoose.model("Plan", PlanSchema);

export default Plan;
