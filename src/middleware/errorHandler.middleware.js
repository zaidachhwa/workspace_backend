import { ValidationError } from "yup";
import { ApiError } from "../utils/ApiError.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, req, res, next) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ success: false, message: error.errors[0] || error.message });
  }

  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  if (statusCode >= 500) {
    console.error(`[error] request=${req.id}`, error);
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? "Internal server error" : error.message,
  });
};
