export const USER_ROLE = {
  USER: "user",
  ADMIN: "admin",
};

export const USER_ROLES = Object.values(USER_ROLE);

// Applied to every new account; an admin can raise/lower it per user afterward.
export const DEFAULT_WORKSPACE_QUOTA = 5;
