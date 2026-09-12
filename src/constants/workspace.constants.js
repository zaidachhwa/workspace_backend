export const WORKSPACE_STATUS = {
  CREATING: "creating",
  STOPPED: "stopped",
  RUNNING: "running",
  ERROR: "error",
  DELETING: "deleting",
};

export const WORKSPACE_STATUSES = Object.values(WORKSPACE_STATUS);

// Logical resource profiles for MVP. The platform enforces these limits,
// clients only select a profile name — never send raw cpu/memory/storage values.
export const WORKSPACE_PROFILES = {
  small: { cpuLimit: 1, memoryLimitMb: 2048, storageLimitMb: 10240 },
  medium: { cpuLimit: 2, memoryLimitMb: 4096, storageLimitMb: 25600 },
  large: { cpuLimit: 4, memoryLimitMb: 8192, storageLimitMb: 51200 },
};

export const WORKSPACE_EVENT_TYPE = {
  CREATED: "workspace.created",
  UPDATED: "workspace.updated",
  STARTED: "workspace.started",
  STOPPED: "workspace.stopped",
  RESTARTED: "workspace.restarted",
  DELETED: "workspace.deleted",
  ENVIRONMENT_SET: "workspace.environment.set",
  ENVIRONMENT_REMOVED: "workspace.environment.removed",
  GIT_IMPORT: "workspace.git_import",
  SNAPSHOT_CREATED: "workspace.snapshot.created",
  SNAPSHOT_RESTORED: "workspace.snapshot.restored",
  SNAPSHOT_DELETED: "workspace.snapshot.deleted",
};
