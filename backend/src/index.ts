import "dotenv/config";
import http from "http";
import app from "./app.js";
import { setupSocket } from "./socket.js";
import { setNotificationEmitter } from "./notificationEmitter.js";
import { notificationToJSON } from "./views/notificationView.js";

const PORT = process.env.PORT ?? 3000;
const httpServer = http.createServer(app);
const io = setupSocket(httpServer);
app.set("io", io);
setNotificationEmitter((n) => {
  io.to("user:" + n.userId).emit("notification", notificationToJSON(n));
});

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
