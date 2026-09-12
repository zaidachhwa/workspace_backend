import Docker from "dockerode";
import { env } from "../config/env.js";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const CONTAINER_PORT = "8080/tcp";
const CONTAINER_PROJECT_DIR = "/home/coder/project";
const PIDS_LIMIT = 512;
const PROXY_NETWORK = "cloudworkspace-proxy";
const BACKUPS_VOLUME = "cloudworkspace-backups";

const containerName = (slug) => `cw-workspace-${slug}`;
const volumeName = (slug) => `cw-volume-${slug}`;

export const createWorkspaceVolume = async (slug) => {
  await docker.createVolume({ Name: volumeName(slug) });
};

export const removeWorkspaceVolume = async (slug) => {
  try {
    await docker.getVolume(volumeName(slug)).remove();
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }
};

// Container is disposable compute; only the named volume is persistent.
// Never privileged, never mounts the host Docker socket, no host capabilities.
// No host port is published — the Traefik labels below are the only route in,
// matching the spec's "only expose the IDE gateway" requirement.
export const createWorkspaceContainer = async ({ slug, image, cpuLimit, memoryLimitMb, env: containerEnv }) => {
  const host = `${slug}.${env.baseWorkspaceDomain}`;

  const container = await docker.createContainer({
    name: containerName(slug),
    Image: image,
    Env: Object.entries(containerEnv).map(([key, value]) => `${key}=${value}`),
    ExposedPorts: { [CONTAINER_PORT]: {} },
    Labels: {
      "traefik.enable": "true",
      [`traefik.http.routers.${slug}.rule`]: `Host(\`${host}\`)`,
      [`traefik.http.routers.${slug}.entrypoints`]: "web",
      [`traefik.http.services.${slug}.loadbalancer.server.port`]: "8080",
    },
    HostConfig: {
      Binds: [`${volumeName(slug)}:${CONTAINER_PROJECT_DIR}`],
      Memory: memoryLimitMb * 1024 * 1024,
      NanoCpus: cpuLimit * 1_000_000_000,
      PidsLimit: PIDS_LIMIT,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges"],
      Privileged: false,
      NetworkMode: PROXY_NETWORK,
    },
  });

  await container.start();
  return container.id;
};

export const startContainer = async (containerId) => {
  const container = docker.getContainer(containerId);
  await container.start().catch((error) => {
    if (error.statusCode !== 304) throw error; // 304 = already started
  });
};

export const stopContainer = async (containerId) => {
  const container = docker.getContainer(containerId);
  await container.stop().catch((error) => {
    if (error.statusCode !== 304) throw error; // 304 = already stopped
  });
};

export const restartContainer = async (containerId) => {
  await docker.getContainer(containerId).restart();
};

export const removeContainer = async (containerId) => {
  try {
    const container = docker.getContainer(containerId);
    await container.remove({ force: true });
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }
};

const CLONE_TIMEOUT_MS = 60_000;

// Runs `git clone` inside the already-running container via `docker exec`,
// straight into the project volume. HTTPS only — no SSH keys to manage, so
// this is scoped to public repositories for now (private-repo import is a
// later feature per the spec's guidance on not storing broad credentials).
export const cloneRepository = async (containerId, repoUrl) => {
  const container = docker.getContainer(containerId);
  const exec = await container.exec({
    Cmd: ["git", "clone", "--", repoUrl, "."],
    WorkingDir: CONTAINER_PROJECT_DIR,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({});
  const output = await Promise.race([
    new Promise((resolve) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("git clone timed out")), CLONE_TIMEOUT_MS)),
  ]);

  const { ExitCode } = await exec.inspect();
  if (ExitCode !== 0) {
    // Docker multiplexes stdout/stderr with an 8-byte header per frame; strip
    // non-printable header bytes so the error message is actually readable.
    const message = output.replace(/[^\x20-\x7E\n]/g, "").trim();
    throw new Error(message || `git clone exited with code ${ExitCode}`);
  }
};

// Shared across all workspaces — snapshots are namespaced by slug inside it,
// separate from the workspace's own volume so deleting a workspace's volume
// never touches its backups (and vice versa).
const ensureBackupsVolume = () => docker.createVolume({ Name: BACKUPS_VOLUME });

// Runs a short-lived Alpine container to do one filesystem operation, then
// removes it. Used for snapshot create/restore/delete — operations that need
// their own container (unlike cloneRepository, there's no running target
// container to exec into when the workspace is stopped).
const runOneOffContainer = async ({ cmd, binds }) => {
  const container = await docker.createContainer({
    Image: "alpine:latest",
    Cmd: cmd,
    Tty: false,
    AttachStdout: true,
    AttachStderr: true,
    HostConfig: { Binds: binds, AutoRemove: false },
  });

  // Removal must happen no matter what fails below — a leftover container
  // holds its volume mounts "in use", which then blocks deleting the
  // workspace's volume later (hit exactly this while building the feature).
  try {
    // container.logs() has proven flaky here (occasionally resolves to
    // something other than a Buffer) — attaching before start and reading the
    // live stream, same pattern as cloneRepository's exec output, is reliable.
    const stream = await container.attach({ stream: true, stdout: true, stderr: true });
    await container.start();

    const output = await new Promise((resolve) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });

    const { StatusCode } = await container.wait();

    // Docker multiplexes stdout/stderr with an 8-byte header per frame when
    // Tty is false; strip the non-printable header bytes so output is readable.
    const cleaned = output.replace(/[^\x20-\x7E\n]/g, "").trim();
    if (StatusCode !== 0) throw new Error(cleaned || `command exited with code ${StatusCode}`);
    return cleaned;
  } finally {
    await container.remove().catch(() => {});
  }
};

// slug and filename are always server-generated (see toSlug/generateFilename)
// and never taken directly from client input — safe to interpolate into shell
// commands here without quoting/injection concerns.
export const createSnapshot = async (slug, filename) => {
  await ensureBackupsVolume();
  const output = await runOneOffContainer({
    cmd: [
      "sh",
      "-c",
      `mkdir -p /backups/${slug} && tar czf /backups/${slug}/${filename} -C /data . && stat -c%s /backups/${slug}/${filename}`,
    ],
    binds: [`${volumeName(slug)}:/data:ro`, `${BACKUPS_VOLUME}:/backups`],
  });
  return Number(output.trim().split("\n").pop());
};

// Wipes the workspace volume's current contents before extracting — this is
// a full restore, not a merge. Caller must ensure the workspace is stopped.
export const restoreSnapshot = (slug, filename) =>
  runOneOffContainer({
    cmd: ["sh", "-c", `find /data -mindepth 1 -delete && tar xzf /backups/${slug}/${filename} -C /data`],
    binds: [`${volumeName(slug)}:/data`, `${BACKUPS_VOLUME}:/backups:ro`],
  });

export const deleteSnapshotFile = (slug, filename) =>
  runOneOffContainer({
    cmd: ["sh", "-c", `rm -f /backups/${slug}/${filename}`],
    binds: [`${BACKUPS_VOLUME}:/backups`],
  });

// Returns null if the container no longer exists (e.g. removed outside the platform).
export const inspectContainer = async (containerId) => {
  try {
    const info = await docker.getContainer(containerId).inspect();
    return { running: info.State.Running, status: info.State.Status };
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
};
