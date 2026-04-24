'use client';

/**
 * Custom Sign In Page
 * 
 * Custom login/signup UI that authenticates directly with Cognito
 * without using the Hosted UI
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CognitoUserPool, 
  CognitoUser, 
  AuthenticationDetails,
  CognitoUserAttribute
} from 'amazon-cognito-identity-js';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { useUserProfile } from '@/hooks/useUserProfile';

const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_a8FLRTD6D',
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '36623hj9j2uq5st5ki9esi51eu',
};

const userPool = new CognitoUserPool(poolData);

export default function CustomSignInPage() {
  const router = useRouter();
  const { isAuthenticated, refreshSession } = useCustomAuth();
  const { createProfile } = useUserProfile();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/chat');
    }
  }, [isAuthenticated, router]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/chat');
    }
  }, [isAuthenticated, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    const attributeList = [
      new CognitoUserAttribute({
        Name: 'email',
        Value: email,
      }),
    ];

    // Use email as username
    userPool.signUp(email, password, attributeList, [], (err, result) => {
      setLoading(false);
      
      if (err) {
        setError(err.message || 'Sign up failed');
        return;
      }

      setSuccess('Account created! Please check your email for verification code.');
      setNeedsVerification(true);
    });
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const userData = {
      Username: email,
      Pool: userPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.confirmRegistration(verificationCode, true, (err, result) => {
      setLoading(false);

      if (err) {
        setError(err.message || 'Verification failed');
        return;
      }

      setSuccess('Email verified! You can now sign in.');
      setNeedsVerification(false);
      setIsSignUp(false);
    });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const userData = {
      Username: email,
      Pool: userPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        setLoading(false);
        setSuccess('Sign in successful! Redirecting...');
        
        // Refresh the auth context to update the session
        refreshSession().then(() => {
          // Create profile if it doesn't exist
          createProfile().catch((err) => {
            console.error('Failed to create profile:', err);
            // Continue anyway, profile can be created later
          });
          
          setTimeout(() => {
            router.push('/chat');
          }, 500);
        });
      },
      onFailure: (err) => {
        setLoading(false);
        setError(err.message || 'Sign in failed');
      },
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        setLoading(false);
        setError('New password required. Please contact support.');
      },
    });
  };

  const handleResendCode = () => {
    const userData = {
      Username: email,
      Pool: userPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.resendConfirmationCode((err, result) => {
      if (err) {
        setError(err.message || 'Failed to resend code');
        return;
      }
      setSuccess('Verification code resent to your email!');
    });
  };

  if (needsVerification) {
    return (
      <div className="min-h-screen bg-culinBg flex items-center justify-center p-8">
        {/* Back Button */}
        <Link 
          href="/"
          className="fixed top-8 left-8 text-culinMuted hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-6xl mb-6"
            >
              📧
            </motion.div>
            <h2 className="text-3xl text-white mb-3">Check your email</h2>
            <p className="text-culinMuted text-sm">
              We sent a verification code to<br />
              <span className="text-white">{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full px-6 py-4 bg-culinCard border border-borderSoft rounded-xl text-white placeholder-culinMuted focus:ring-2 focus:ring-culinGreen focus:border-transparent transition-all text-center text-lg"
                required
                autoFocus
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm text-center"
                >
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-green-900/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm text-center"
                >
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-culinGreen text-white py-4 rounded-xl hover:bg-culinGreen2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </motion.button>

            <button
              type="button"
              onClick={handleResendCode}
              className="w-full text-culinMuted hover:text-white text-sm transition"
            >
              Resend Code
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-culinBg flex items-center justify-center p-8">
      {/* Back Button */}
      <Link 
        href="/"
        className="fixed top-8 left-8 text-culinMuted hover:text-white transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-12"
        >
          <Image
            src="/icon2.png"
            alt="CulinAI"
            width={120}
            height={120}
            className="w-30 h-30"
          />
        </motion.div>

        {/* Sign In / Sign Up Toggle */}
        <div className="flex gap-3 mb-12">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setIsSignUp(false);
              setError('');
              setSuccess('');
            }}
            className={`flex-1 py-3 rounded-xl transition-all ${
              !isSignUp
                ? 'bg-culinGreen text-white'
                : 'text-culinMuted hover:text-white'
            }`}
          >
            Sign In
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setIsSignUp(true);
              setError('');
              setSuccess('');
            }}
            className={`flex-1 py-3 rounded-xl transition-all ${
              isSignUp
                ? 'bg-culinGreen text-white'
                : 'text-culinMuted hover:text-white'
            }`}
          >
            Sign Up
          </motion.button>
        </div>

        {/* Form */}
        <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-6">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-6 py-4 bg-culinCard border border-borderSoft rounded-xl text-white placeholder-culinMuted focus:ring-2 focus:ring-culinGreen focus:border-transparent transition-all"
              required
              autoFocus
            />
          </div>

          <div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-6 py-4 bg-culinCard border border-borderSoft rounded-xl text-white placeholder-culinMuted focus:ring-2 focus:ring-culinGreen focus:border-transparent transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-culinMuted hover:text-white transition text-xl"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {isSignUp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="w-full px-6 py-4 bg-culinCard border border-borderSoft rounded-xl text-white placeholder-culinMuted focus:ring-2 focus:ring-culinGreen focus:border-transparent transition-all"
                required
              />
            </motion.div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm text-center"
              >
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-green-900/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm text-center"
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-culinGreen text-white py-4 rounded-xl hover:bg-culinGreen2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (isSignUp ? 'Creating...' : 'Signing in...') : 'Continue'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
