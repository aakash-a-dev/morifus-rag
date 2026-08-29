import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { UnsupportedUploadError } from "../documents/documentsService";
import { UnsupportedFileTypeError, CorruptedFileError } from "../ingestion/parsers";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "ValidationError", details: err.issues });
  }
  if (err instanceof UnsupportedUploadError || err instanceof UnsupportedFileTypeError) {
    return res.status(415).json({ error: "UnsupportedFileType", message: err.message });
  }
  if (err instanceof CorruptedFileError) {
    return res.status(422).json({ error: "CorruptedFile", message: err.message });
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({ error: "InternalServerError", message: "Something went wrong" });
};
