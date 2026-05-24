import bcrypt from 'bcryptjs'
import { User, IUser } from '../../models/User'
import { RefreshToken } from '../../models/RefreshToken'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt'
import { AppError } from '../../middleware/errorHandler'

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface RegisterResult {
  user: {
    id: string
    name: string
    email: string
    role: string
  }
  accessToken: string
  refreshToken: string
}

export interface LoginResult {
  user: {
    id: string
    name: string
    email: string
    role: string
  }
  accessToken: string
  refreshToken: string
}

/**
 * Registers a new user account.
 *
 * Steps:
 * 1. Check email uniqueness (409 if already registered)
 * 2. Hash password with bcrypt cost factor 10 (Requirement 1.3)
 * 3. Create user record in MongoDB
 * 4. Generate JWT access token (15 min) and refresh token (7 days) (Requirements 1.4–1.6)
 * 5. Store hashed refresh token in RefreshToken collection
 * 6. Return user info + tokens
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const { name, email, password } = input

  // Check email uniqueness — return 409 if already registered (Requirement 1.2)
  const existingUser = await User.findOne({ email: email.toLowerCase() })
  if (existingUser) {
    throw new AppError('Email already registered', 409)
  }

  // Hash password with bcrypt cost factor 10 (Requirement 1.3)
  const hashedPassword = await bcrypt.hash(password, 10)

  // Create user record
  const user: IUser = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
  })

  // Generate tokens (Requirements 1.4, 1.5, 1.6)
  const tokenPayload = { id: user._id.toString(), role: user.role }
  const accessToken = generateAccessToken(tokenPayload)
  const refreshToken = generateRefreshToken(tokenPayload)

  // Hash the refresh token before storing
  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10)
  const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await RefreshToken.create({
    user: user._id,
    token: hashedRefreshToken,
    expiresAt: refreshTokenExpiry,
  })

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  }
}

export interface RefreshResult {
  accessToken: string
}

/**
 * Refreshes an access token using a valid refresh token.
 *
 * Steps:
 * 1. Verify the JWT refresh token signature — return 401 if invalid (Requirement 1.7)
 * 2. Find all RefreshToken documents for the user from the JWT payload
 * 3. Compare the provided token against each stored hashed token using bcrypt.compare
 * 4. Return 401 "Invalid refresh token" if no match found
 * 5. Return 401 "Refresh token expired" if the matching token's expiresAt is in the past
 * 6. Find the user by ID — return 401 if not found or inactive
 * 7. Generate a new JWT access token (15 min)
 * 8. Return { accessToken }
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  // Step 1: Verify JWT signature
  let payload: { id: string; role: string }
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw new AppError('Invalid refresh token', 401)
  }

  // Step 2: Find all stored refresh tokens for this user
  const storedTokens = await RefreshToken.find({ user: payload.id })

  // Step 3: Compare provided token against each stored hashed token
  let matchedToken: (typeof storedTokens)[number] | null = null
  for (const stored of storedTokens) {
    const isMatch = await bcrypt.compare(refreshToken, stored.token)
    if (isMatch) {
      matchedToken = stored
      break
    }
  }

  // Step 4: No match found
  if (!matchedToken) {
    throw new AppError('Invalid refresh token', 401)
  }

  // Step 5: Check expiry
  if (matchedToken.expiresAt < new Date()) {
    throw new AppError('Refresh token expired', 401)
  }

  // Step 6: Find the user
  const user = await User.findById(payload.id)
  if (!user || !user.isActive) {
    throw new AppError('Invalid refresh token', 401)
  }

  // Step 7: Generate new access token
  const accessToken = generateAccessToken({ id: user._id.toString(), role: user.role })

  return { accessToken }
}

export interface LogoutResult {
  message: string
}

/**
 * Logs out a user by invalidating their refresh token.
 *
 * Steps:
 * 1. Verify the JWT refresh token signature — if invalid, return successfully (idempotent)
 * 2. Find all RefreshToken documents for the user from the JWT payload
 * 3. Compare the provided token against each stored hashed token using bcrypt.compare
 * 4. Delete the matching token from the database (invalidates it)
 * 5. Return successfully even if token not found (idempotent logout)
 *
 * Requirement 1.8: WHEN a User logs out, THE Platform SHALL invalidate the Refresh_Token
 */
export async function logoutUser(refreshToken: string): Promise<LogoutResult> {
  // Step 1: Verify JWT signature — if invalid, treat as already logged out
  let payload: { id: string; role: string }
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    // Invalid token signature — nothing to invalidate, return success (idempotent)
    return { message: 'Logged out successfully' }
  }

  // Step 2: Find all stored refresh tokens for this user
  const storedTokens = await RefreshToken.find({ user: payload.id })

  // Step 3: Compare provided token against each stored hashed token
  for (const stored of storedTokens) {
    const isMatch = await bcrypt.compare(refreshToken, stored.token)
    if (isMatch) {
      // Step 4: Delete the matching token
      await RefreshToken.deleteOne({ _id: stored._id })
      break
    }
  }

  // Step 5: Return success regardless of whether a match was found (idempotent)
  return { message: 'Logged out successfully' }
}

/**
 * Authenticates a user with email and password.
 *
 * Steps:
 * 1. Find user by email (case-insensitive) — return 401 if not found (Requirement 1.2)
 * 2. Compare password against bcrypt hash — return 401 if mismatch (Requirement 1.4)
 * 3. Check isActive — return 401 if deactivated (Requirement 18.3)
 * 4. Generate JWT access token (15 min) and refresh token (7 days) (Requirements 1.4–1.6)
 * 5. Remove old refresh tokens for this user, store new hashed refresh token
 * 6. Return user info + tokens
 */
export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const { email, password } = input

  // Find user by email (case-insensitive) — don't reveal which field is wrong
  const user: IUser | null = await User.findOne({ email: email.toLowerCase() })
  if (!user) {
    throw new AppError('Invalid credentials', 401)
  }

  // Compare password against stored bcrypt hash
  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) {
    throw new AppError('Invalid credentials', 401)
  }

  // Check account is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401)
  }

  // Generate tokens (Requirements 1.4, 1.5, 1.6)
  const tokenPayload = { id: user._id.toString(), role: user.role }
  const accessToken = generateAccessToken(tokenPayload)
  const refreshToken = generateRefreshToken(tokenPayload)

  // Remove all existing refresh tokens for this user, then store the new hashed one
  await RefreshToken.deleteMany({ user: user._id })

  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10)
  const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await RefreshToken.create({
    user: user._id,
    token: hashedRefreshToken,
    expiresAt: refreshTokenExpiry,
  })

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  }
}
