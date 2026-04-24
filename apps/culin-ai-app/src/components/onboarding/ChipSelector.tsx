import React from 'react';
import { StyleSheet, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, typography, radius, shadows } from '@/src/design/tokens';

interface ChipSelectorProps {
  options: readonly {
    label: string;
    value: string;
    icon?: keyof typeof MaterialIcons.glyphMap;
  }[];
  selected: string[];
  onSelect: (value: string) => void;
  multiple?: boolean;
  columns?: number;
}

export function ChipSelector({ 
  options, 
  selected, 
  onSelect, 
  multiple = true,
  columns = 2,
}: ChipSelectorProps) {
  return (
    <View style={[styles.container, { gap: spacing.md }]}>
      {options.map((option, index) => {
        const isSelected = selected.includes(option.value);
        
        return (
          <Animated.View
            key={option.value}
            entering={FadeInDown.duration(200).delay(index * 40)}
            style={[styles.chipWrapper, { width: columns === 2 ? '48%' : '100%' }]}
          >
            <Pressable onPress={() => onSelect(option.value)}>
              <View style={[styles.chip, isSelected && styles.chipSelected]}>
                <View style={styles.chipContent}>
                  {option.icon && (
                    <MaterialIcons
                      name={option.icon}
                      size={20}
                      color={isSelected ? colors.primary[600] : colors.neutral.gray600}
                      style={styles.chipIcon}
                    />
                  )}
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {option.label}
                  </Text>
                  {isSelected && (
                    <MaterialIcons name="check-circle" size={16} color={colors.primary[600]} />
                  )}
                </View>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  chipWrapper: {
    marginBottom: spacing.sm,
  },
  chip: {
    borderRadius: radius.chip,
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray100,
    ...shadows.card,
  },
  chipSelected: {
    borderColor: colors.primary[600],
    borderWidth: 2,
    backgroundColor: colors.primary.soft,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  chipIcon: {},
  chipText: {
    ...typography.body,
    color: colors.neutral.gray600,
    textAlign: 'center',
    flex: 1,
  },
  chipTextSelected: {
    color: colors.neutral.blackSoft,
    fontWeight: '500',
  },
});
