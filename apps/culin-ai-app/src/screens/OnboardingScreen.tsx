import { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  Text,
  Modal,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useAuth } from '@/src/contexts/AuthContext';
import { GradientBackground } from '@/src/components/onboarding/GradientBackground';
import { ProgressHeader } from '@/src/components/onboarding/ProgressHeader';
import { QuestionCard, TextInputCard, OptionButton } from '@/src/components/onboarding/QuestionCard';
import { ChipSelector } from '@/src/components/onboarding/ChipSelector';
import { SliderInput } from '@/src/components/onboarding/SliderInput';
import { PrimaryButton } from '@/src/components/onboarding/PrimaryButton';
import { spacing } from '@/src/design/tokens';
import { feetInchesToCm, poundsToKg } from '@/src/utils/unitConverters';

// Onboarding configuration
const TOTAL_STEPS = 6;

const GOALS = [
  { label: 'Lose Fat', value: 'lose_fat', icon: 'trending-down' },
  { label: 'Build Muscle', value: 'build_muscle', icon: 'fitness-center' },
  { label: 'Mental Health', value: 'mental_health', icon: 'psychology' },
  { label: 'Better Sleep', value: 'sleep', icon: 'bedtime' },
] as const;

const MEDICAL_CONDITIONS = [
  { label: 'Type 2 Diabetes', value: 'diabetes', icon: 'medical-services' },
  { label: 'High BP', value: 'high_bp', icon: 'favorite' },
  { label: 'Heart Disease', value: 'heart_disease', icon: 'favorite-border' },
  { label: 'PCOS', value: 'pcos', icon: 'healing' },
  { label: 'IBS', value: 'ibs', icon: 'sick' },
  { label: 'Food Allergies', value: 'allergies', icon: 'warning' },
] as const;

const ACTIVITY_LEVELS = [
  { label: 'Sedentary', value: 'sedentary', icon: 'event-seat' },
  { label: 'Light Activity', value: 'light', icon: 'directions-walk' },
  { label: 'Moderate', value: 'moderate', icon: 'directions-run' },
  { label: 'Very Active', value: 'active', icon: 'fitness-center' },
] as const;

export default function OnboardingScreen() {
  const { currentUser, updateUserData } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  /** iOS spinner value while modal is open (avoid ScrollView stealing wheel pans). */
  const [iosPickerDate, setIosPickerDate] = useState(() => new Date(2000, 0, 15));
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [weightLb, setWeightLb] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | 'Other' | ''>('');
  const [activityLevel, setActivityLevel] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [alcoholUse, setAlcoholUse] = useState(0);
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const getGradientForStep = (step: number) => {
    const gradients = ['lightGreen', 'mint', 'clinical'] as const;
    return gradients[(step - 1) % gradients.length];
  };

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'Select your date of birth';
    const isoDay = dateString.trim().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) {
      const [y, m, d] = isoDay.split('-').map((n) => Number(n));
      const parsed = new Date(y, m - 1, d);
      if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString();
    }
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return 'Select your date of birth';
    return parsed.toLocaleDateString();
  };

  const openDatePicker = () => {
    const raw = dateOfBirth.trim().split('T')[0];
    let next: Date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map((n) => Number(n));
      next = new Date(y, m - 1, d);
    } else {
      next = new Date(2000, 0, 15);
    }
    if (Number.isNaN(next.getTime())) next = new Date(2000, 0, 15);
    const max = new Date();
    if (next > max) next = max;
    setIosPickerDate(next);
    setShowDatePicker(true);
  };

  const commitIosDateOfBirth = () => {
    const selectedDate = iosPickerDate;
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    setDateOfBirth(`${yyyy}-${mm}-${dd}`);
    setShowDatePicker(false);
  };

  const handleAndroidDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    setDateOfBirth(`${yyyy}-${mm}-${dd}`);
  };

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 1:
        if (!name.trim()) {
          Alert.alert('Required', 'Please enter your name');
          return false;
        }
        return true;
      case 2:
        if (!dateOfBirth.trim()) {
          Alert.alert('Required', 'Please enter your date of birth');
          return false;
        }
        return true;
      case 3: {
        const feet = Number(heightFeet);
        const inches = heightInches.trim() === '' ? 0 : Number(heightInches);
        const lb = Number(weightLb);
        if (!heightFeet.trim() || isNaN(feet) || feet < 3 || feet > 8) {
          Alert.alert('Invalid', 'Please enter a valid height in feet (3-8)');
          return false;
        }
        if (isNaN(inches) || inches < 0 || inches > 11) {
          Alert.alert('Invalid', 'Inches must be between 0 and 11');
          return false;
        }
        if (!weightLb.trim() || isNaN(lb) || lb < 50 || lb > 700) {
          Alert.alert('Invalid', 'Please enter a valid weight (50-700 lb)');
          return false;
        }
        return true;
      }
      case 4:
        if (!sex) {
          Alert.alert('Required', 'Please select an option');
          return false;
        }
        return true;
      case 5:
        if (goals.length === 0) {
          Alert.alert('Required', 'Please select at least one goal');
          return false;
        }
        return true;
      case 6:
        return true; // Optional step
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    console.log('📝 ========== ONBOARDING COMPLETION STARTED ==========');
    
    try {
      // Calculate age from date of birth
      const dob = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();

      const feet = Number(heightFeet);
      const inches = heightInches.trim() === '' ? 0 : Number(heightInches);
      const lb = Number(weightLb);

      const userDataToSave: any = {
        displayName: name,
        dateOfBirth: dob.toISOString(),
        // Backend stores metric; convert from the user's input units.
        height: feetInchesToCm(feet, inches),
        weight: poundsToKg(lb),
        sex,
        goals,
        onboardingCompleted: true,
      };

      if (medicalConditions.length > 0) {
        userDataToSave.healthConditions = medicalConditions;
      }

      console.log('📊 Onboarding data collected:', {
        displayName: userDataToSave.displayName,
        dateOfBirth: userDataToSave.dateOfBirth,
        height: userDataToSave.height,
        weight: userDataToSave.weight,
        sex: userDataToSave.sex,
        goals: userDataToSave.goals,
        healthConditions: userDataToSave.healthConditions || [],
        onboardingCompleted: true
      });
      
      console.log('💾 Calling updateUserData to save and sync...');
      await updateUserData(userDataToSave);
      console.log('✅ Onboarding data saved successfully!');
      console.log('========== ONBOARDING COMPLETION FINISHED ==========');

      // With Cognito, user attributes are stored in userData (AsyncStorage)
      // No need to update Cognito user attributes separately
    } catch (error: any) {
      console.error('❌ ========== ONBOARDING ERROR ==========');
      console.error('Error:', error);
      console.error('========================================');
      Alert.alert('Error', error.message || 'Failed to save profile information');
      setLoading(false);
    }
  };

  const toggleGoal = (goal: string) => {
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const toggleCondition = (condition: string) => {
    setMedicalConditions((prev) =>
      prev.includes(condition) ? prev.filter((c) => c !== condition) : [...prev, condition]
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <QuestionCard
            title="What's your name?"
            subtitle="We'll use this to personalize your experience"
            icon="waving-hand"
          >
            <TextInputCard
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              icon="person"
              autoCapitalize="words"
            />
          </QuestionCard>
        );

      case 2:
        return (
          <QuestionCard
            title="When were you born?"
            subtitle="Helps us calculate your nutritional needs"
            icon="cake"
          >
            <Pressable style={styles.datePickerButton} onPress={openDatePicker}>
              <MaterialIcons name="calendar-today" size={20} color="#666" style={styles.datePickerIcon} />
              <Text style={[styles.datePickerText, !dateOfBirth && styles.datePickerPlaceholder]}>
                {formatDateForDisplay(dateOfBirth)}
              </Text>
            </Pressable>
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={iosPickerDate}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={handleAndroidDateChange}
              />
            )}
          </QuestionCard>
        );

      case 3:
        return (
          <QuestionCard
            title="Height and weight?"
            subtitle="Starting point for your journey"
            icon="straighten"
          >
            <View style={styles.heightRow}>
              <View style={styles.heightHalf}>
                <TextInputCard
                  placeholder="Feet"
                  value={heightFeet}
                  onChangeText={(t) => setHeightFeet(t.replace(/\D/g, '').slice(0, 1))}
                  keyboardType="number-pad"
                  icon="height"
                  maxLength={1}
                />
              </View>
              <View style={styles.heightHalf}>
                <TextInputCard
                  placeholder="Inches"
                  value={heightInches}
                  onChangeText={(t) => setHeightInches(t.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
            <TextInputCard
              placeholder="Weight in lb"
              value={weightLb}
              onChangeText={(t) => setWeightLb(t.replace(/\D/g, '').slice(0, 3))}
              keyboardType="number-pad"
              icon="monitor-weight"
              maxLength={3}
            />
          </QuestionCard>
        );

      case 4:
        return (
          <QuestionCard
            title="About you"
            subtitle="Help us understand your profile"
            icon="accessibility-new"
          >
            <View style={styles.optionsContainer}>
              <OptionButton
                label="Male"
                selected={sex === 'M'}
                onPress={() => setSex('M')}
                icon="male"
              />
              <OptionButton
                label="Female"
                selected={sex === 'F'}
                onPress={() => setSex('F')}
                icon="female"
              />
              <OptionButton
                label="Other"
                selected={sex === 'Other'}
                onPress={() => setSex('Other')}
                icon="transgender"
              />
            </View>
          </QuestionCard>
        );

      case 5:
        return (
          <QuestionCard
            title="What are your goals?"
            subtitle="Choose what matters most"
            icon="emoji-events"
          >
            <ChipSelector
              options={[...GOALS]}
              selected={goals}
              onSelect={toggleGoal}
              multiple={true}
              columns={2}
            />
          </QuestionCard>
        );

      case 6:
        return (
          <QuestionCard
            title="Any health conditions?"
            subtitle="Optional - helps us give safer advice"
            icon="favorite"
          >
            <ChipSelector
              options={[...MEDICAL_CONDITIONS]}
              selected={medicalConditions}
              onSelect={toggleCondition}
              multiple={true}
              columns={2}
            />
            <Text style={styles.medicalDisclaimer}>
              CulinAI is not a medical service. We use this only to tailor general food
              ideas — always talk to your doctor before changing your diet.
            </Text>
          </QuestionCard>
        );

      default:
        return null;
    }
  };

  return (
    <GradientBackground type={getGradientForStep(currentStep)}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ProgressHeader currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        <Animated.View
          key={currentStep}
          entering={SlideInRight.duration(200)}
          exiting={SlideOutLeft.duration(200)}
          style={styles.content}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderStep()}
          </ScrollView>
        </Animated.View>

        {Platform.OS === 'ios' && (
          <Modal
            visible={showDatePicker}
            animationType="slide"
            transparent
            onRequestClose={() => setShowDatePicker(false)}
          >
            <Pressable style={styles.dateModalOverlay} onPress={() => setShowDatePicker(false)}>
              <Pressable style={styles.dateModalCard} onPress={(e) => e.stopPropagation()}>
                <View style={styles.dateModalToolbar}>
                  <Pressable onPress={() => setShowDatePicker(false)} hitSlop={12}>
                    <Text style={styles.dateModalToolbarBtn}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={commitIosDateOfBirth} hitSlop={12}>
                    <Text style={[styles.dateModalToolbarBtn, styles.dateModalToolbarDone]}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={iosPickerDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                  onChange={(_, selectedDate) => {
                    if (selectedDate) setIosPickerDate(selectedDate);
                  }}
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {currentStep > 1 && (
            <View style={styles.backButtonContainer}>
              <PrimaryButton
                label="Back"
                onPress={handleBack}
                variant="outline"
                disabled={loading}
              />
            </View>
          )}
          <View style={styles.nextButtonContainer}>
            <PrimaryButton
              label={currentStep === TOTAL_STEPS ? 'Complete' : 'Continue'}
              onPress={handleNext}
              loading={loading}
              icon={currentStep === TOTAL_STEPS ? 'check' : 'arrow-forward'}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
  },
  optionsContainer: {
    width: '100%',
    gap: spacing.sm,
  },
  heightRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  heightHalf: {
    flex: 1,
  },
  datePickerButton: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePickerIcon: {
    marginRight: spacing.md,
  },
  datePickerText: {
    fontSize: 16,
    color: '#111827',
  },
  datePickerPlaceholder: {
    color: '#9ca3af',
  },
  dateModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dateModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.lg,
  },
  dateModalToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  dateModalToolbarBtn: {
    fontSize: 17,
    color: '#6b7280',
  },
  dateModalToolbarDone: {
    color: '#2563eb',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButtonContainer: {
    flex: 1,
  },
  nextButtonContainer: {
    flex: 2,
  },
  medicalDisclaimer: {
    marginTop: spacing.lg,
    fontSize: 12,
    lineHeight: 17,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
});
