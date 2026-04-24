import { Image, StyleSheet, View } from 'react-native';

interface LogoProps {
  size?: number;
  style?: any;
}

export default function Logo({ size = 32, style }: LogoProps) {
  // Using the app icon as logo - you can replace this with your actual logo
  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('@/assets/images/icon.png')}
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

