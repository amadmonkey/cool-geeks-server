import fs from "fs";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

const SCOPES = [
	"https://www.googleapis.com/auth/spreadsheets",
	"https://www.googleapis.com/auth/drive",
];

const mimeTypes = `(mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/jpg')`;

export class GoogleDriveService {
	service;

	constructor() {
		const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
		this.service = google.drive({
			version: "v3",
			auth: new GoogleAuth({
				scopes: SCOPES,
				credentials: credentials,
			}),
		});
	}

	/**
	 * Search file in drive location
	 * @return{obj} data file
	 * */
	async searchFile(fileName, folderName) {
		const files = [];
		try {
			const res = await this.service.files.list({
				q: `${mimeTypes} ${fileName ? `and name='${fileName}'` : ``}`,
				fields: "nextPageToken, files(id, name)",
				spaces: "drive",
			});
			Array.prototype.push.apply(files, res.files);
			res.data.files.forEach(function (file) {
				console.log("Found file:", file.name, file.id);
			});
			return res.data.files;
		} catch (err) {
			// TODO(developer) - Handle error <- ok bro
			throw err;
		}
	}

	/**
	 * Downloads a file
	 * @param{string} realFileId file ID
	 * @return{obj} file status
	 * */
	async downloadFile(fileId) {
		try {
			const file = await this.service.files.get({
				fileId: fileId,
				alt: "media",
			});
			return file;
		} catch (err) {
			// TODO(developer) - Handle error <- ok bro
			throw err;
		}
	}

	/**
	 * Create a folder and prints the folder ID
	 * @return{obj} folder Id
	 * */
	async createFolder(name) {
		const fileMetadata = {
			name: name,
			mimeType: "application/vnd.google-apps.folder",
		};
		try {
			const file = await this.service.files.create({
				requestBody: fileMetadata,
				fields: "id",
			});
			console.log("Folder Id:", file.data);
			return file.data.id;
		} catch (err) {
			// TODO(developer) - Handle error <- ok bro
			throw err;
		}
	}

	async deleteFile(fileId) {
		try {
			const response = await this.service.files.delete({
				fileId: fileId,
			});
			return response;
		} catch (err) {
			// TODO(developer) - Handle error <- ok bro
			throw err;
		}
	}

	async saveFile(filename, path, mimetype, folder) {
		const requestBody = {
			name: filename,
			fields: "id",
			parents: [folder],
		};
		const media = {
			mimeType: mimetype,
			body: fs.createReadStream(path),
		};
		try {
			const file = await this.service.files.create({
				requestBody,
				media: media,
			});
			console.log("File Id:", file.data.id);
			return file.data.id;
		} catch (err) {
			// TODO(developer) - Handle error <- ok bro
			throw err;
		}
	}
}
