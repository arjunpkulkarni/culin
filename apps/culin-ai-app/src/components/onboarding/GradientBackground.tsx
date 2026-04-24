import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';

type GradientType = 'lightGreen' | 'mint' | 'clinical';

interface GradientBackgroundProps {
  type?: GradientType;
  children?: React.ReactNode;
}

const GRADIENTS = {
  lightGreen: ['#F2FFF2', '#E8FBE3', '#CFF7D6'],
  mint: ['#E8FBE3', '#CFF7D6'],
  clinical: ['#F7F9F8', '#E5EAE7'],
};

export function GradientBackground({ type = 'lightGreen', children }: GradientBackgroundProps) {
  const gradientColors = GRADIENTS[type] || GRADIENTS.lightGreen;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View 
        entering={FadeIn.duration(200)} 
        style={styles.content}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
