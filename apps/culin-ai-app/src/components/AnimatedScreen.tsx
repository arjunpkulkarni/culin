import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

interface AnimatedScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
  direction?: 'up' | 'down';
}

export function AnimatedScreen({ 
  children, 
  style, 
  delay = 0,
  direction = 'up' 
}: AnimatedScreenProps) {
  const enteringAnimation = direction === 'up' 
    ? FadeInUp.delay(delay).duration(400).springify()
    : FadeInDown.delay(delay).duration(400).springify();

  return (
    <Animated.View 
      entering={enteringAnimation}
      style={[styles.container, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

