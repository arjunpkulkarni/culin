import React, { useEffect, useState } from 'react';
import {
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
import Slider from '@react-native-community/slider';
import { colors, fontFamily, radius, shadows, spacing } from '@/src/design/tokens';

const FILTER_CHIPS = [
  { id: 'high-protein', label: 'High protein', icon: 'fitness-center' },
  { id: 'cheap', label: 'Cheap', icon: 'attach-money' },
  { id: 'fast', label: 'Fast', icon: 'bolt' },
  { id: 'vegetarian', label: 'Vegetarian', icon: 'eco' },
  { id: 'low-carb', label: 'Low carb', icon: 'trending-down' },
] as const;

export interface MealIdeaSubmit {
  mode: 'cook' | 'order';
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
    if (visible) {
      setPrompt(initialPrompt);
      setFilters(initialFilters);
      setComplexity(3);
    }
  }, [visible, initialPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFilter = (id: string) => {
    setFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const handleSubmit = (mode: 'cook' | 'order') => {
    onSubmit({ mode, prompt: prompt.trim(), filters, complexity });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>What are you in the mood for?</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="search" size={18} color={colors.neutral.gray600} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. high protein, under 30 min..."
                  placeholderTextColor={colors.neutral.gray300}
                  value={prompt}
                  onChangeText={setPrompt}
                  returnKeyType="done"
                />
                {prompt.length > 0 && (
                  <Pressable onPress={() => setPrompt('')}>
                    <MaterialIcons name="close" size={16} color={colors.neutral.gray600} />
                  </Pressable>
                )}
              </View>

              <Text style={styles.label}>Filters</Text>
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

              <View style={styles.complexitySection}>
                <View style={styles.complexityHeader}>
                  <MaterialIcons name="tune" size={16} color={colors.primary[600]} />
                  <Text style={styles.complexityLabel}>Recipe complexity: {complexity}</Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={5}
                  step={1}
                  value={complexity}
                  onValueChange={setComplexity}
                  minimumTrackTintColor={colors.primary[600]}
                  maximumTrackTintColor={colors.neutral.gray100}
                  thumbTintColor={colors.primary[600]}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabelText}>Simple</Text>
                  <Text style={styles.sliderLabelText}>Complex</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, styles.actionSecondary]}
                onPress={() => handleSubmit('order')}
              >
                <MaterialIcons name="delivery-dining" size={18} color={colors.neutral.blackSoft} />
                <Text style={[styles.actionText, styles.actionTextSecondary]}>Order</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={() => handleSubmit('cook')}
              >
                <MaterialIcons name="restaurant" size={18} color={colors.neutral.white} />
                <Text style={[styles.actionText, styles.actionTextPrimary]}>Cook</Text>
              </Pressable>
            </View>
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
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
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
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 20,
    color: colors.neutral.blackSoft,
  },
  label: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    color: colors.neutral.gray600,
    marginBottom: 8,
    marginTop: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.neutral.offWhite,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.md,
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
  complexitySection: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  complexityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  complexityLabel: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    color: colors.neutral.blackSoft,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabelText: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.neutral.gray300,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.button,
  },
  actionPrimary: {
    backgroundColor: colors.primary[600],
  },
  actionSecondary: {
    backgroundColor: colors.neutral.offWhite,
    borderWidth: 1,
    borderColor: colors.neutral.gray100,
  },
  actionText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
  },
  actionTextPrimary: {
    color: colors.neutral.white,
  },
  actionTextSecondary: {
    color: colors.neutral.blackSoft,
  },
});
