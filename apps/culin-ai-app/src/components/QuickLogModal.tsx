import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fontFamily, radius, shadows, spacing } from '@/src/design/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (description: string) => Promise<void>;
}

/**
 * Bottom-sheet style modal with one input. The single field replaces the
 * old 3-input quick-log card on the home screen — the nutrition engine
 * already accepts free text, so we don't need to pre-parse fields.
 */
export function QuickLogModal({ visible, onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setText('');
      setLoading(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!text.trim()) {
      Alert.alert('Required', 'Tell us what you ate first.');
      return;
    }
    try {
      setLoading(true);
      await onSubmit(text.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {Platform.OS === 'ios' && (
              <BlurView tint="light" intensity={70} style={StyleSheet.absoluteFill} />
            )}
            <View style={[StyleSheet.absoluteFill, styles.sheetFrost]} />
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>Log a meal</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={colors.neutral.gray600} />
              </Pressable>
            </View>

            <Text style={styles.subtitle}>
              What did you eat? We&apos;ll estimate calories and macros for you.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="e.g. Two scrambled eggs and toast"
              placeholderTextColor={colors.neutral.gray300}
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={3}
              autoFocus
              returnKeyType="done"
            />

            <Pressable
              style={[styles.submitBtn, (!text.trim() || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!text.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <>
                  <MaterialIcons name="add-circle-outline" size={18} color={colors.neutral.white} />
                  <Text style={styles.submitText}>Estimate &amp; log</Text>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 36, 33, 0.45)',
    justifyContent: 'flex-end',
  },
  kav: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.95)' : 'transparent',
    ...shadows.floating,
  },
  sheetFrost: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral.gray100,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 20,
    color: colors.neutral.blackSoft,
  },
  subtitle: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.gray600,
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.neutral.offWhite,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: fontFamily.primary,
    fontSize: 15,
    color: colors.neutral.blackSoft,
    marginBottom: spacing.lg,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary[600],
    paddingVertical: 14,
    borderRadius: radius.button,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.white,
  },
});
