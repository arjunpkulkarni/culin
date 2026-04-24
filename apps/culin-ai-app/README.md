# CulinAI App

A React Native mobile application built with Expo for personalized meal planning and nutrition tracking.

## 🚀 Features

- User authentication (Email/Password & Google Sign-In)
- Personalized onboarding flow
- Meal logging and recommendations
- User profile management
- Health condition tracking
- Goal-based meal planning

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for Mac) or Android Emulator
- Expo Go app on your mobile device (for testing)

## 🛠️ Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd CulinAIApp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and fill in your Firebase credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your Firebase configuration values.

**Important:** Never commit `.env` to git! It's already in `.gitignore`.

### 4. Start the development server

```bash
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

## 📱 Running on Physical Device

1. Install Expo Go from App Store (iOS) or Google Play (Android)
2. Start the dev server: `npm start`
3. Scan the QR code with:
   - **iOS**: Camera app
   - **Android**: Expo Go app

## 🔐 Firebase Setup

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed Firebase configuration instructions.

## 📁 Project Structure

```
CulinAIApp/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation screens
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/        # Reusable components
│   ├── config/            # Configuration files
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── screens/           # Screen components
│   └── utils/             # Utility functions
├── assets/                # Images, fonts, etc.
└── app.json               # Expo configuration
```

## 🤝 Contributing

1. Create a new branch for your feature: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Create a Pull Request

## 📝 Code Style

- Use TypeScript for type safety
- Follow React Native best practices
- Use functional components with hooks
- Keep components small and focused

## 🔒 Security

- Never commit sensitive data (API keys, passwords, etc.)
- Use environment variables for configuration
- Keep `.env` file local and never share it
- Review Firebase security rules regularly

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 👥 Team

- [Your Name] - Initial work

## 🙏 Acknowledgments

- Expo team for the amazing framework
- Firebase for backend services
- React Native community
