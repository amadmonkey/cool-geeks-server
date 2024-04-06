import mongoose from "../db/connection.js";

const UserSchema = new mongoose.Schema(
	{
		_id: { type: String, required: true },
		subdId: { type: String },
		planId: { type: String },
		accountNumber: { type: String, unique: true, required: true },
		password: { type: String, required: false },
		firstName: { type: String, required: true },
		middleName: { type: String, required: false },
		lastName: { type: String, required: true },
		address: { type: String, required: true },
		contactNo: { type: String, required: true },
		email: { type: String, required: true },
		admin: { type: Boolean, default: false, required: true },
	},
	{ timestamps: true }
);

const User = mongoose.model("User", UserSchema);

export default User;
