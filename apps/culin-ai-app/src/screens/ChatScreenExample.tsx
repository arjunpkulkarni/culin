import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '@/src/contexts/AuthContext';
import { createCulinAIApi } from '@/src/services/culinaiApi';
import { colors, spacing, radius, typography } from '@/src/design/tokens';

interface Message {
  id: string;
  text: string;
  role: 'user' | 'assistant' | 'error';
  nutrition?: any;
  instacart?: any;
}

/**
 * Example Chat Screen using CulinAI API
 * This demonstrates how to integrate the authentication and API service
 */
export default function ChatScreen() {
  const { idToken, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!inputText.trim() || !idToken) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      role: 'user',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // Create API instance with current ID token
      const api = createCulinAIApi(idToken);

      // Send chat message with optional parameters
      const response = await api.sendChatMessage(inputText, {
        complexity: 3, // 1-5 complexity level
        diagnosticCodes: [], // Optional diagnostic codes
        healthEffectIds: undefined, // Optional health effect IDs
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.enhancedResponse || 'No response',
        role: 'assistant',
        nutrition: response.nutrition,
        instacart: response.instacart,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Error: ${error.message}`,
        role: 'error',
      };
      
      setMessages((prev) => [...prev, errorMessage]);
      
      // If unauthorized, token might be expired
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        Alert.alert('Session Expired', 'Please sign in again.', [
          { text: 'OK', onPress: () => logout() },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageBubble,
        item.role === 'user' ? styles.userMessage : styles.assistantMessage,
        item.role === 'error' && styles.errorMessage,
      ]}
    >
      <Text style={styles.messageText}>{item.text}</Text>
      
      {/* Optionally display nutrition data */}
      {item.nutrition && (
        <View style={styles.nutritionInfo}>
          <Text style={styles.nutritionText}>
            📊 Nutrition info available
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CulinAI Chat</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.signOutButton}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        inverted={false}
      />

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary[500]} />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask for a recipe..."
          placeholderTextColor={colors.neutral.gray300}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (loading || !inputText.trim()) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={loading || !inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.gray100,
  },
  headerTitle: {
    ...typography.titleL,
    color: colors.neutral.blackSoft,
  },
  signOutButton: {
    ...typography.body,
    color: colors.primary[500],
    fontWeight: '600',
  },
  messageList: {
    padding: spacing.lg,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: radius.card,
    marginBottom: spacing.md,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary[500],
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray100,
  },
  errorMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.semantic.error,
  },
  messageText: {
    ...typography.body,
    color: colors.neutral.blackSoft,
  },
  nutritionInfo: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.gray100,
  },
  nutritionText: {
    ...typography.caption,
    color: colors.neutral.gray600,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  loadingText: {
    marginLeft: spacing.sm,
    color: colors.neutral.gray600,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.gray100,
  },
  input: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
    padding: spacing.md,
    borderRadius: radius.button,
    ...typography.body,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral.gray300,
  },
  sendButtonText: {
    ...typography.button,
    color: colors.neutral.white,
  },
});
