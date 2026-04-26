import Logo from '@/src/components/Logo';
import { useAuth } from '@/src/contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    Image,
} from 'react-native';
import { spacing, colors, fontFamily, fontSize, fontWeight, radius, shadows } from '@/src/design/tokens';
import { GradientBackground } from '@/src/components/onboarding/GradientBackground';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const { signIn, signUp, verifyEmail, resendVerificationCode, resetPassword, isFirebaseReady } = useAuth();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');

  const getErrorMessage = (error: any): string => {
    const errorCode = error?.code;
    const msg = error?.message ?? '';

    if (msg.includes('Firebase not initialized') || msg.includes('not configured')) {
      return 'Auth is not configured. Add Cognito credentials to .env (see .env.example).';
    }
    if (errorCode === 'UserNotConfirmedException' || msg.includes('User is not confirmed')) {
      return 'Email not verified. Please check your email for verification code.';
    }
    if (errorCode === 'UsernameExistsException' || msg.includes('already exists')) {
      return 'This email is already registered. Please sign in instead.';
    }
    if (errorCode === 'auth/email-already-in-use') {
      return 'This email is already registered. Please sign in instead.';
    }
    if (errorCode === 'auth/invalid-email' || errorCode === 'InvalidParameterException') {
      return 'Please enter a valid email address.';
    }
    if (errorCode === 'auth/weak-password' || errorCode === 'InvalidPasswordException') {
      return 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.';
    }
    if (errorCode === 'auth/user-not-found' || errorCode === 'UserNotFoundException') {
      return 'No account found with this email. Please sign up.';
    }
    if (errorCode === 'auth/wrong-password' || errorCode === 'NotAuthorizedException') {
      return 'Incorrect email or password. Please try again.';
    }
    if (errorCode === 'auth/invalid-credential') {
      return 'Invalid email or password. Please try again.';
    }
    if (errorCode === 'CodeMismatchException') {
      return 'Invalid verification code. Please try again.';
    }
    if (errorCode === 'ExpiredCodeException') {
      return 'Verification code expired. Please request a new one.';
    }
    if (errorCode === 'auth/network-request-failed' || errorCode === 'NetworkError') {
      return 'Network error. Check your connection and try again.';
    }

    return error?.message || 'An error occurred. Please try again.';
  };

  async function handleSubmit() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;
    if (!cleanEmail || !cleanPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (__DEV__) {
      console.log('[AuthScreen] submit email length:', cleanEmail.length, 'password length:', cleanPassword.length);
    }

    setEmailError(''); // Clear previous errors
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(cleanEmail, cleanPassword);
      } else {
        // For sign up, we'll use a temporary name - it will be updated in onboarding
        await signUp(cleanEmail, cleanPassword, 'User');
        // Show verification screen after successful signup
        setVerificationEmail(cleanEmail);
        setShowVerification(true);
        setLoading(false);
        Alert.alert(
          'Success',
          'Account created! Please check your email for a verification code.',
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      
      // Check if this is an unverified user error
      if (error?.code === 'UserNotConfirmedException' || error?.message?.includes('not confirmed')) {
        setVerificationEmail(cleanEmail);
        setShowVerification(true);
        setEmailError('');
        setLoading(false);
        Alert.alert(
          'Email Not Verified',
          'Please verify your email first. Check your email for the verification code.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      setEmailError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const emailToUse = forgotPasswordEmail.trim() || email.trim();
    if (!emailToUse) {
      Alert.alert('Error', 'Enter your email address.');
      return;
    }
    setLoading(true);
    setEmailError('');
    try {
      await resetPassword(emailToUse);
      setForgotPasswordSent(true);
    } catch (error: any) {
      setEmailError(getErrorMessage(error));
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail() {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit verification code');
      return;
    }
    setLoading(true);
    setEmailError('');
    try {
      await verifyEmail(verificationEmail, verificationCode);
      Alert.alert('Success', 'Email verified! You can now sign in.', [
        {
          text: 'OK',
          onPress: () => {
            setShowVerification(false);
            setVerificationCode('');
            setIsLogin(true);
          },
        },
      ]);
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      setEmailError(errorMessage);
      Alert.alert('Verification Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setLoading(true);
    setEmailError('');
    try {
      await resendVerificationCode(verificationEmail);
      Alert.alert('Success', 'Verification code resent to your email!');
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      setEmailError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Forgot password flow
  if (showForgotPassword) {
    return (
      <GradientBackground type="clinical">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/culinAI.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                {forgotPasswordSent
                  ? 'Check your email for a link to reset your password.'
                  : "Enter your email and we'll send you a reset link."}
              </Text>
            </View>
            {!forgotPasswordSent ? (
              <>
                <View style={[styles.inputContainer, emailError ? styles.inputContainerError : null]}>
                  <MaterialIcons name="email" size={20} color={emailError ? colors.semantic.error : colors.neutral.gray300} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.neutral.gray300}
                    value={forgotPasswordEmail || email}
                    onChangeText={(t) => { setForgotPasswordEmail(t); setEmailError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                <Pressable
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleForgotPassword}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
                </Pressable>
              </>
            ) : null}
            <Pressable style={styles.switchButton} onPress={() => { setShowForgotPassword(false); setForgotPasswordSent(false); setEmailError(''); }}>
              <Text style={styles.switchText}>Back to Sign In</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </GradientBackground>
    );
  }

  // Email verification flow
  if (showVerification) {
    return (
      <GradientBackground type="mint">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.logoContainer}>
              <Text style={styles.verificationIcon}>📧</Text>
              <Text style={styles.title}>Verify Your Email</Text>
              <Text style={styles.subtitle}>
                We sent a verification code to{'\n'}
                <Text style={styles.emailHighlight}>{verificationEmail}</Text>
              </Text>
            </View>
            
            <View style={[styles.inputContainer, emailError ? styles.inputContainerError : null]}>
              <MaterialIcons 
                name="verified-user" 
                size={20} 
                color={emailError ? colors.semantic.error : colors.neutral.gray300} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="Enter 6-digit code"
                placeholderTextColor={colors.neutral.gray300}
                value={verificationCode}
                onChangeText={(text) => { setVerificationCode(text); setEmailError(''); }}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyEmail}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify Email</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.resendButton}
              onPress={handleResendCode}
              disabled={loading}
            >
              <Text style={styles.switchText}>Resend Code</Text>
            </Pressable>

            <Pressable 
              style={styles.switchButton} 
              onPress={() => { 
                setShowVerification(false); 
                setVerificationCode(''); 
                setEmailError(''); 
              }}
            >
              <Text style={styles.switchText}>Back to Sign In</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground type="lightGreen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/culinAI.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>
              {isLogin ? 'Welcome Back!' : 'Create Account'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Sign in to continue your health journey' : 'Start your personalized nutrition journey'}
            </Text>
          </View>

          {!isFirebaseReady ? (
            <View style={styles.configWarning}>
              <Text style={styles.configWarningText}>
                Cognito Auth is not configured. Add EXPO_PUBLIC_COGNITO_* credentials to .env — see .env.example.
              </Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View>
              <View style={[styles.inputContainer, emailError && styles.inputContainerError]}>
                <MaterialIcons 
                  name="email" 
                  size={20} 
                  color={emailError ? colors.semantic.error : colors.neutral.gray300} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.neutral.gray300}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setEmailError(''); // Clear error when user types
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
              {emailError ? (
                <Text style={styles.errorText}>{emailError}</Text>
              ) : null}
            </View>

            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color={colors.neutral.gray300} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.neutral.gray300}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            {isLogin ? (
              <Pressable
                style={styles.forgotPasswordButton}
                onPress={() => setShowForgotPassword(true)}
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.button, (loading || !isFirebaseReady) && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || !isFirebaseReady}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isLogin ? 'Sign In' : 'Sign Up'}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.switchText}>
                {isLogin
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Sign In'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.primaryLight,
    fontSize: fontSize.titleXL,
    fontWeight: fontWeight.light,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: colors.neutral.blackSoft,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    lineHeight: 24,
    color: colors.neutral.gray600,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: radius.button,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.gray100,
    ...shadows.card,
  },
  inputContainerError: {
    borderColor: colors.semantic.error,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    color: colors.semantic.error,
    marginLeft: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    fontFamily: fontFamily.primary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    color: colors.neutral.blackSoft,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  forgotPasswordText: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.primary[600],
  },
  configWarning: {
    backgroundColor: colors.semantic.warning + '20',
    padding: spacing.md,
    borderRadius: radius.button,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.semantic.warning,
  },
  configWarningText: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.caption,
    color: colors.semantic.warning,
  },
  button: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.button,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: fontSize.button,
    fontWeight: fontWeight.medium,
    color: colors.neutral.white,
  },
  switchButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  switchText: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.primary[600],
  },
  verificationIcon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emailHighlight: {
    fontWeight: '700',
    color: colors.neutral.blackSoft,
  },
  codeInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});

