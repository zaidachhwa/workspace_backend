export const sendSuccess = (res, { status = 200, message, data = null } = {}) =>
  res.status(status).json({ success: true, message, data });
