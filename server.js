import "dotenv/config.js";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import path from "path";
import url from "url";

import AuthRouter from "./controllers/Auth.js";
import UserRouter from "./controllers/User.js";
import SubdRouter from "./controllers/Subd.js";
import PlanRouter from "./controllers/Plan.js";
import ReceiptRouter from "./controllers/Receipt.js";
import TokenRouter from "./controllers/Token.js";

import { LOG } from "./utility.js";

const { PORT } = process.env;

const app = express();

const corsOptions = {
	origin: process.env.origin,
	credentials: true,
};

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dir = path.join(__dirname, "/public");
app.use(express.static(dir));

app.use(cors(corsOptions));
app.use(morgan("tiny"));
app.use(express.json());

app.get("/", (_, res) => {
	res.send("this is the test route to make sure server is working");
});

app.use("/auth", AuthRouter);
app.use("/user", UserRouter);
app.use("/subd", SubdRouter);
app.use("/plan", PlanRouter);
app.use("/token", TokenRouter);
app.use("/receipt", ReceiptRouter);

app.listen(PORT, () => LOG.success(`SERVER STATUS: Listening on port ${PORT}`));
