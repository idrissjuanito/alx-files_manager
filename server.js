import express from "express";
import router from "./router/index";

const port = process.env.PORT || 5000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", router);
app.listen(port);
