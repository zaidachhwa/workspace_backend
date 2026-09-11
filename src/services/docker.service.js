import Docker from "dockerode";
import { env } from "../config/env.js";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const CONTAINER_PORT = "8080/tcp";
const CONTAINER_PROJECT_DIR = "/home/coder/project";
const PIDS_LIMIT = 512;
const PROXY_NETWORK = "cloudworkspace-proxy";

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
