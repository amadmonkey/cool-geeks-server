import mongoose from "../db/connection.js";
import { SchemaTypes } from "mongoose";

const SettingsSchema = new mongoose.Schema(
	{
		_id: { type: SchemaTypes.ObjectId, required: true },
		name: { type: String },
		value: { type: String },
	},
	{ timestamps: true }
);

const Settings = mongoose.model("Settings", SettingsSchema);

export default Settings;
