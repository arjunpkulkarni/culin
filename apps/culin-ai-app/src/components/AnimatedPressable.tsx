import React from 'react';
import { Pressable, PressableProps, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode;
  scale?: number;
  haptic?: boolean;
}

export function AnimatedPressableComponent({ 
  children, 
  scale = 0.95,
  haptic = true,
  onPressIn,
  onPressOut,
  ...props 
}: AnimatedPressableProps) {
  const pressed = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: withSpring(pressed.value ? scale : 1, {
          damping: 15,
          stiffness: 300,
        })},
      ],
      opacity: withTiming(pressed.value ? 0.8 : 1, {
        duration: 150,
      }),
    };
  });

  const handlePressIn = (e: any) => {
    pressed.value = true;
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    pressed.value = false;
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      style={animatedStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}

