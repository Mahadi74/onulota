import passport from 'passport'
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20'
import { User } from '../models/User'
import { logger } from '../utils/logger'

/**
 * Configure Passport with Google OAuth 2.0 strategy.
 *
 * Satisfies Requirement 2 (Social Authentication):
 *  - 2.1 Redirects to Google OAuth consent screen
 *  - 2.2 Creates or retrieves the User account associated with the Google email
 *  - 2.4 Stores the Google user ID for future authentication attempts
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
    },
    async (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
      try {
        const googleId = profile.id
        const email = profile.emails?.[0]?.value
        const name = profile.displayName || profile.name?.givenName || 'Google User'

        if (!email) {
          return done(new Error('No email returned from Google'), undefined)
        }

        // Try to find an existing user by googleId first (Req 2.4)
        let user = await User.findOne({ googleId })

        if (!user) {
          // Try to find by email — link Google account to existing user (Req 2.2)
          user = await User.findOne({ email: email.toLowerCase() })

          if (user) {
            // Link the Google ID to the existing account
            user.googleId = googleId
            await user.save()
            logger.info(`Linked Google account to existing user: ${email}`)
          } else {
            // Create a new user account (Req 2.2)
            user = await User.create({
              name,
              email: email.toLowerCase(),
              // Password is not required for OAuth users; set a placeholder
              // that cannot be used for password login
              password: `google_oauth_${googleId}`,
              googleId,
              isActive: true,
            })
            logger.info(`Created new user via Google OAuth: ${email}`)
          }
        }

        if (!user.isActive) {
          return done(new Error('Account is deactivated'), undefined)
        }

        return done(null, user)
      } catch (error) {
        logger.error('Google OAuth strategy error', { error })
        return done(error as Error, undefined)
      }
    }
  )
)

// Passport does not use sessions in this API (JWT-based auth), so
// serializeUser / deserializeUser are intentionally minimal.
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: string }).id)
})

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id)
    done(null, user)
  } catch (error) {
    done(error, null)
  }
})

export default passport
