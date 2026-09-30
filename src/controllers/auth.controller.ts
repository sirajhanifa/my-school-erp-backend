import type { CookieOptions, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/user.model.js";

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

// Settings for the cookie that holds the JWT
const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript in the browser cannot read it (protects against XSS)
  secure: process.env.NODE_ENV === "production", // only sent over HTTPS in production
  sameSite: "strict", // not sent from other websites (protects against CSRF)
};

// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body ?? {};

    // 1. Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // 2. Find the user (password is hidden by default, so ask for it)
    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    }).select("+password");

    // 3. Check the password
    // Same message for "wrong email" and "wrong password", so nobody can guess which emails exist.
    const isPasswordCorrect = user
      ? await bcrypt.compare(String(password), user.password)
      : false;
    if (!user || !isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({
          message:
            "Your account is inactive. Please contact the administrator.",
        });
    }

    // 4. Generate the JWT ("Remember me" = 7 days, otherwise 1 day)
    const expiresInMs = rememberMe ? 7 * ONE_DAY_IN_MS : ONE_DAY_IN_MS;
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      {
        expiresIn: expiresInMs / 1000, // in seconds
      },
    );

    // 5. Store the JWT in an HTTP-only cookie
    res.cookie("token", token, { ...cookieOptions, maxAge: expiresInMs });

    // 6. Return the user (never the password or the token)
    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// POST /api/auth/logout
export const logout = (_req: Request, res: Response) => {
  res.clearCookie("token", cookieOptions);
  return res.status(200).json({ message: "Logged out successfully" });
};

// GET /api/auth/me  (protected: the auth middleware runs first and puts userId in res.locals)
export const getMe = async (_req: Request, res: Response) => {
  try {
    const user = await User.findById(res.locals.userId);

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};
