import "dotenv/config";
import http from "http";
import app from "./app.js";
import { setupSocket } from "./socket.js";

const PORT = process.env.PORT ?? 3000;
const httpServer = http.createServer(app);
const io = setupSocket(httpServer);
app.set("io", io);

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
