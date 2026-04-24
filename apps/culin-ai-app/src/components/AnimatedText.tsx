import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Typography, TextRendering } from '@/src/constants/typography';

const AnimatedTextComponent = Animated.createAnimatedComponent(Text);

interface AnimatedTextProps extends TextProps {
  variant?: keyof typeof Typography;
  animated?: boolean;
  delay?: number;
  children: React.ReactNode;
}

export function AnimatedText({ 
  variant = 'body',
  animated = true,
  delay = 0,
  style,
  children,
  ...props 
}: AnimatedTextProps) {
  const typographyStyle = Typography[variant];
  
  const textStyle = [
    typographyStyle,
    {
      ...TextRendering,
    },
    style,
  ];

  if (!animated) {
    return (
      <Text style={textStyle} {...props}>
        {children}
      </Text>
    );
  }

  return (
    <AnimatedTextComponent
      entering={FadeInDown.delay(delay).duration(300).springify()}
      style={textStyle}
      {...props}
    >
      {children}
    </AnimatedTextComponent>
  );
}

