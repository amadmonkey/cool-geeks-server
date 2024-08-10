import "dotenv/config.js";
import express from "express";
import cors from "cors";
import path from "path";
import url from "url";

import AuthRouter from "./controllers/Auth.js";
import UserRouter from "./controllers/User.js";
import SubdRouter from "./controllers/Subd.js";
import PlanRouter from "./controllers/Plan.js";
import TokenRouter from "./controllers/Token.js";
import ReceiptRouter from "./controllers/Receipt.js";

import { LOG, RESPONSE } from "./utility.js";

const { PORT } = process.env;

const app = express();

const corsOptions = {
	origin: process.env.origin || 4000,
	credentials: true,
};

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dir = path.join(__dirname, "/public");
app.use(express.static(dir));

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (_, res) => {
	try {
		res.status(200).json(RESPONSE.success(200, { message: "Server is up and running" }));
	} catch (e) {
		LOG.info("ROOT CATCH", e);
		res.status(400).json(RESPONSE.fail(400, { message: e.message }));
	}
});

app.use("/auth", AuthRouter);
app.use("/user", UserRouter);
app.use("/subd", SubdRouter);
app.use("/plan", PlanRouter);
app.use("/token", TokenRouter);
app.use("/receipt", ReceiptRouter);

app.listen(PORT, "0.0.0.0", (err) => {
	if (err) throw err;
	LOG.success(`SERVER STATUS: Listening on port ${PORT}`);
});
