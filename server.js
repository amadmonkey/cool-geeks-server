import "dotenv/config.js";
import express from "express";
import morgan from "morgan";
import cors from "cors";

import UserRouter from "./controllers/User.js";
import SubdRouter from "./controllers/Subd.js";
import PlanRouter from "./controllers/Plan.js";
import PaymentRouter from "./controllers/Payment.js";
import TokenRouter from "./controllers/Token.js";

import { LOG } from "./utility.js";

const { PORT } = process.env;

const app = express();

const corsOptions = {
	origin: "http://localhost.com:3000/",
	credentials: true,
};

app.use(cors(corsOptions));
app.use(morgan("tiny"));
app.use(express.json());

app.get("/", (_, res) => {
	res.send("this is the test route to make sure server is working");
});

app.use("/user", UserRouter);
app.use("/subd", SubdRouter);
app.use("/plan", PlanRouter);
app.use("/payment", PaymentRouter);
app.use("/token", TokenRouter);

app.listen(PORT, () => LOG.success(`SERVER STATUS: Listening on port ${PORT}`));
