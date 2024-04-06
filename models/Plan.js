import mongoose from "../db/connection.js";

const PlanSchema = new mongoose.Schema(
	{
		_id: { type: String, required: true },
		subdId: { type: String, required: true },
		name: { type: String, required: true },
		description: { type: String, required: false },
		price: { type: String, required: true },
	},
	{ timestamps: true }
);

const Plan = mongoose.model("Plan", PlanSchema);

export default Plan;
