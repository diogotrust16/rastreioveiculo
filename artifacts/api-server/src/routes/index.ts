import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import vehiclesRouter from "./vehicles";
import trackingRouter from "./tracking";
import geofencesRouter from "./geofences";
import alertsRouter from "./alerts";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/clients", clientsRouter);
router.use("/vehicles", vehiclesRouter);
router.use("/tracking", trackingRouter);
router.use("/geofences", geofencesRouter);
router.use("/alerts", alertsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/users", usersRouter);

export default router;
