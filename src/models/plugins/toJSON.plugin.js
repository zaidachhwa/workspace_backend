// Normalizes every model's JSON output to { id, ...fields } and drops
// internal/sensitive fields (passwordHash, refreshTokens, encrypted env values)
// so a plain `res.json(doc)` can never leak them by accident.
export const toJSONPlugin = (schema, hiddenPaths = []) => {
  schema.set("toJSON", {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v;
      for (const path of hiddenPaths) delete ret[path];
      return ret;
    },
  });
};
