import { RequestHandler } from "express";
import { ZodTypeAny } from "zod";

export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}
