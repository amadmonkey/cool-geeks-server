import mongoose from "../db/connection.js";
const { Schema, SchemaTypes } = mongoose;

const UserSchema = new Schema(
	{
		_id: { type: SchemaTypes.ObjectId, required: true },
		subdRef: { type: SchemaTypes.ObjectId, ref: "Subd", required: true },
		planRef: { type: SchemaTypes.ObjectId, ref: "Plan", required: true },
		accountNumber: { type: String, unique: true, required: true },
		password: { type: String, required: false },
		firstName: { type: String, required: true },
		middleName: { type: String, required: false },
		lastName: { type: String, required: true },
		address: { type: String, required: true },
		contactNo: { type: String, required: true },
		email: { type: String, unique: true, required: true },
		cutoff: { type: String, required: true },
		admin: { type: Boolean, default: false, required: true },
		status: { type: String, default: "PENDING", required: true },
		activated: { type: Boolean, default: false, required: true },
		createdBy: { type: String, default: "EXTERNAL", required: true },
	},
	{ timestamps: true }
);

const User = mongoose.model("User", UserSchema);

export default User;
