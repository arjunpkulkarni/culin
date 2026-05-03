import { Image, StyleSheet, View } from 'react-native';

interface LogoProps {
  size?: number;
  style?: any;
}

export default function Logo({ size = 44, style }: LogoProps) {
  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('@/assets/images/culinAI.png')}
        style={[styles.logo, { width: size, height: size }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    borderRadius: 8,
  },
});

