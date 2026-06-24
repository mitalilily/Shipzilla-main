import express from "express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  createIcarryPickupAddressHandler,
  createPickupAddressHandler,
  deleteIcarryPickupAddressHandler,
  exportPickupAddressesHandler,
  getPickupAddressesHandler,
  importPickupAddressesHandler,
  updateIcarryPickupAddressHandler,
  updatePickupAddressHandler,
} from "../controllers/pickupAddresses.controller";

const router = express.Router();

router.use(requireAuth);
router.post("/icarry", createIcarryPickupAddressHandler);
router.patch("/icarry/:id", updateIcarryPickupAddressHandler);
router.delete("/icarry/:id", deleteIcarryPickupAddressHandler);
router.post("/", createPickupAddressHandler);
router.get("/", getPickupAddressesHandler);
router.patch("/:id", updatePickupAddressHandler);
router.get("/export", exportPickupAddressesHandler);
router.post("/import", importPickupAddressesHandler);
export default router;
