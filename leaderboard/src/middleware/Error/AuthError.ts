import AppError from "./appError";

export default class AuthError extends AppError {
  constructor() {
    super("Unauthorized", 401);
  }
}
