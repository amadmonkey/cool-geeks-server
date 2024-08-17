import { v2 } from "cloudinary";
import { LOG } from "./utility.js";

export class CloudinaryService {
	cloudinary = v2;

	constructor() {
		this.cloudinary.config({
			cloud_name: process.env.CLOUDINARY_NAME,
			api_key: process.env.CLOUDINARY_KEY,
			api_secret: process.env.CLOUDINARY_SECRET,
		});
	}

	async url(fileId) {
		try {
			const url = this.cloudinary.url(fileId, {
				quality: "auto",
				fetch_format: "auto",
			});
			LOG.info("CLOUDINARY url", url);
			return url;
		} catch (error) {
			LOG.error("CLOUDINARY url", error);
			return error;
		}
	}

	async destroy(fileId) {
		return await this.cloudinary.uploader
			.destroy(fileId)
			.then((res) => {
				LOG.info("CLOUDINARY destroy", res);
				return res;
			})
			.catch((error) => {
				LOG.error("CLOUDINARY destroy", error);
				return error;
			});
	}

	async upload(filename, path, folder) {
		return await this.cloudinary.uploader
			.upload(path, {
				public_id: filename.split(".").pop()[0],
				folder: folder,
			})
			.then((res) => {
				LOG.info("CLOUDINARY upload", res);
				return res;
			})
			.catch((error) => {
				LOG.error("CLOUDINARY upload", error);
				return error;
			});
	}
}
