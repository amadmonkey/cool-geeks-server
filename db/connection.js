import "dotenv/config.js";
import { mongoose } from "mongoose";
import { LOG } from "../utility.js";

//DESTRUCTURE ENV VARIABLES
const { DATABASE_URL } = process.env;

// CONNECT TO MONGO
mongoose.connect(DATABASE_URL, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

// CONNECTION EVENTS
mongoose.connection
	.on("open", () => LOG.success("DATABASE_STATE: Connection Open"))
	.on("close", () => LOG.success("DATABASE_STATE: Connection Closed"))
	.on("error", (error) => LOG.error(`DATABASE_STATE: ${error}`));

// EXPORT CONNECTION
export default mongoose;
