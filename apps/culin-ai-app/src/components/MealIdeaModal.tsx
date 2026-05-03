import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fontFamily, radius, shadows, spacing } from '@/src/design/tokens';

const FILTER_CHIPS = [
  { id: 'high-protein', label: 'High protein', icon: 'fitness-center' },
  { id: 'cheap', label: 'Cheap', icon: 'attach-money' },
  { id: 'fast', label: 'Fast', icon: 'bolt' },
  { id: 'vegetarian', label: 'Vegetarian', icon: 'eco' },
  { id: 'low-carb', label: 'Low carb', icon: 'trending-down' },
] as const;

export interface MealIdeaSubmit {
  prompt: string;
  filters: string[];
  complexity: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (params: MealIdeaSubmit) => void;
  /** Pre-fill the prompt (e.g. "high protein, around 600 cal"). */
  initialPrompt?: string;
  initialFilters?: string[];
}

export function MealIdeaModal({
  visible,
  onClose,
  onSubmit,
  initialPrompt = '',
  initialFilters = ['high-protein'],
}: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [filters, setFilters] = useState<string[]>(initialFilters);
  const [complexity, setComplexity] = useState(3);

  useEffect(() => {
    if (!visible) return;
    setPrompt(initialPrompt);
    setFilters(initialFilters);
    setComplexity(3);
  }, [visible, initialPrompt, initialFilters]);

  const toggleFilter = (id: string) => {
    setFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const canSubmit =
    Boolean(prompt.trim()) || filters.length > 0;

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    let effectivePrompt = trimmed;
    if (!effectivePrompt && filters.length > 0) {
      const parts = filters
        .map((id) => FILTER_CHIPS.find((c) => c.id === id)?.label?.toLowerCase())
        .filter(Boolean);
      if (parts.length > 0) {
        effectivePrompt = `A satisfying meal idea that is ${parts.join(', ')}`;
      }
    }
    if (!effectivePrompt) {
      Alert.alert(
        'Add what you\'re craving',
        'Tell us what you’re in the mood for, or leave the tags on to use your selected styles.',
      );
      return;
    }
    onSubmit({ prompt: effectivePrompt, filters, complexity });
  };

  const complexityLabel = (n: number) => {
    switch (n) {
      case 1:
        return 'Beginner';
      case 2:
        return 'Easy';
      case 3:
        return 'Medium';
      case 4:
        return 'Advanced';
      case 5:
        return 'Chef';
      default:
        return '';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>Get a meal idea</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={colors.neutral.gray600} />
              </Pressable>
            </View>

            <View style={styles.inputWrapper}>
              <MaterialIcons name="search" size={18} color={colors.neutral.gray600} />
              <TextInput
                style={styles.input}
                placeholder="What are you in the mood for?"
                placeholderTextColor={colors.neutral.gray300}
                value={prompt}
                onChangeText={setPrompt}
                returnKeyType="done"
              />
              {prompt.length > 0 && (
                <Pressable onPress={() => setPrompt('')} hitSlop={6}>
                  <MaterialIcons name="close" size={16} color={colors.neutral.gray600} />
                </Pressable>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTER_CHIPS.map((f) => {
                const active = filters.includes(f.id);
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => toggleFilter(f.id)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <MaterialIcons
                      name={f.icon as any}
                      size={14}
                      color={active ? colors.primary[700] : colors.neutral.gray600}
                    />
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.complexityHeader}>
              <Text style={styles.complexityLabel}>Recipe complexity</Text>
              <Text style={styles.complexityValue}>{complexityLabel(complexity)}</Text>
            </View>
            <View style={styles.complexityRow}>
              {[1, 2, 3, 4, 5].map((n) => {
                const active = n === complexity;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setComplexity(n)}
                    style={[styles.complexityCell, active && styles.complexityCellActive]}
                  >
                    <Text
                      style={[
                        styles.complexityCellText,
                        active && styles.complexityCellTextActive,
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[
                styles.actionBtn,
                styles.actionPrimary,
                !canSubmit && styles.actionPrimaryDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <MaterialIcons name="restaurant" size={18} color={colors.neutral.white} />
              <Text style={[styles.actionText, styles.actionTextPrimary]}>Find a recipe</Text>
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
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    ...shadows.floating,
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
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 20,
    color: colors.neutral.blackSoft,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.neutral.offWhite,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.primary,
    fontSize: 15,
    color: colors.neutral.blackSoft,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    paddingRight: spacing.xl,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral.offWhite,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: colors.primary.soft,
    borderColor: colors.primary[600],
  },
  filterText: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
  },
  filterTextActive: {
    color: colors.primary[700],
    fontFamily: fontFamily.primaryMedium,
  },
  complexityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.md,
    marginBottom: 6,
  },
  complexityLabel: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    color: colors.neutral.gray600,
  },
  complexityValue: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    color: colors.primary[700],
  },
  complexityRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.sm,
  },
  complexityCell: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: colors.neutral.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  complexityCellActive: {
    backgroundColor: colors.primary.soft,
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  complexityCellText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.neutral.gray600,
  },
  complexityCellTextActive: {
    color: colors.primary[700],
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.button,
    marginTop: spacing.sm,
  },
  actionPrimary: {
    backgroundColor: colors.primary[600],
  },
  actionPrimaryDisabled: {
    opacity: 0.45,
  },
  actionText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
  },
  actionTextPrimary: {
    color: colors.neutral.white,
  },
});
