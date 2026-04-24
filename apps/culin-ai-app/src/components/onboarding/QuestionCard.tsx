import React from 'react';
import { StyleSheet, View, Text, TextInput, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, typography, radius, shadows, fontWeight } from '@/src/design/tokens';

interface QuestionCardProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
  delay?: number;
}

export function QuestionCard({ title, subtitle, icon, children, delay = 0 }: QuestionCardProps) {
  return (
    <Animated.View 
      entering={FadeInDown.duration(200).delay(delay)}
      style={styles.container}
    >
      <View style={styles.content}>
        {icon && (
          <View style={styles.iconContainer}>
            <MaterialIcons name={icon} size={32} color={colors.primary[600]} />
          </View>
        )}
        
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        
        <View style={styles.inputContainer}>
          {children}
        </View>
      </View>
    </Animated.View>
  );
}

interface TextInputCardProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  icon?: keyof typeof MaterialIcons.glyphMap;
  maxLength?: number;
}

export function TextInputCard({
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  icon,
  maxLength,
}: TextInputCardProps) {
  return (
    <View style={styles.textInputWrapper}>
      <View style={styles.glassCard}>
        <View style={styles.textInputContent}>
          {icon && (
            <MaterialIcons name={icon} size={20} color={colors.neutral.gray600} style={styles.inputIcon} />
          )}
          <TextInput
            style={styles.textInput}
            placeholder={placeholder}
            placeholderTextColor={colors.neutral.gray300}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            maxLength={maxLength}
          />
        </View>
      </View>
    </View>
  );
}

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
}

export function OptionButton({ label, selected, onPress, icon }: OptionButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.optionButtonWrapper}>
      <View style={[styles.glassCard, styles.optionButton, selected && styles.optionButtonSelected]}>
        <View style={styles.optionContent}>
          {icon && (
            <MaterialIcons 
              name={icon} 
              size={20} 
              color={selected ? colors.primary[600] : colors.neutral.gray600} 
              style={styles.optionIcon} 
            />
          )}
          <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
            {label}
          </Text>
          {selected && (
            <MaterialIcons name="check-circle" size={20} color={colors.primary[600]} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.primary.soft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.titleXL,
    color: colors.neutral.blackSoft,
    textAlign: 'left',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral.gray600,
    textAlign: 'left',
    marginBottom: spacing.xxxl,
  },
  inputContainer: {
    width: '100%',
    gap: spacing.lg,
  },
  textInputWrapper: {
    width: '100%',
  },
  glassCard: {
    borderRadius: radius.card,
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray100,
    ...shadows.card,
  },
  textInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  textInput: {
    flex: 1,
    ...typography.body,
    color: colors.neutral.blackSoft,
    height: 24,
  },
  optionButtonWrapper: {
    width: '100%',
  },
  optionButton: {
    marginBottom: spacing.md,
  },
  optionButtonSelected: {
    borderColor: colors.primary[600],
    borderWidth: 2,
    backgroundColor: colors.primary.soft,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  optionIcon: {
    marginRight: spacing.md,
  },
  optionText: {
    flex: 1,
    ...typography.body,
    color: colors.neutral.gray600,
  },
  optionTextSelected: {
    color: colors.neutral.blackSoft,
    fontWeight: fontWeight.medium,
  },
});
