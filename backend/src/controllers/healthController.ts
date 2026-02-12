import type { Request, Response } from "express";
import { healthToJSON } from "../views/healthView.js";

export function getHealth(_req: Request, res: Response) {
  res.status(200).json(healthToJSON());
}
