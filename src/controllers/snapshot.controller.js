import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as snapshotService from "../services/snapshot.service.js";

export const listSnapshots = asyncHandler(async (req, res) => {
  const snapshots = await snapshotService.listSnapshots(req.user.id, req.params.id);
  sendSuccess(res, { data: snapshots });
});

export const createSnapshot = asyncHandler(async (req, res) => {
  const snapshot = await snapshotService.createSnapshot(req.user.id, req.params.id);
  sendSuccess(res, { status: 201, message: "Snapshot created", data: snapshot });
});

export const restoreSnapshot = asyncHandler(async (req, res) => {
  await snapshotService.restoreSnapshot(req.user.id, req.params.id, req.params.snapshotId);
  sendSuccess(res, { message: "Snapshot restored" });
});

export const deleteSnapshot = asyncHandler(async (req, res) => {
  await snapshotService.deleteSnapshot(req.user.id, req.params.id, req.params.snapshotId);
  sendSuccess(res, { message: "Snapshot deleted" });
});
