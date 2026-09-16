import "dotenv/config";
import http from "http";
import app from "./app.js";
import { setupSocket } from "./socket.js";
import { setNotificationDelivery } from "./modules/notifications/index.js";
import { validateIdentityConfiguration } from "./modules/identity/index.js";

const PORT = process.env.PORT ?? 3000;
validateIdentityConfiguration();
const httpServer = http.createServer(app);
const io = setupSocket(httpServer);
app.set("io", io);
setNotificationDelivery((notification) => {
  io.to("user:" + notification.userId).emit("notification", notification);
});

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
