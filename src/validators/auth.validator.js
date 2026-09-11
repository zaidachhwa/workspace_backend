import * as yup from "yup";

export const registerSchema = yup.object({
  name: yup.string().trim().min(2).max(100).required(),
  email: yup.string().trim().email().required(),
  password: yup.string().min(8).max(128).required(),
});

export const loginSchema = yup.object({
  email: yup.string().trim().email().required(),
  password: yup.string().required(),
});
