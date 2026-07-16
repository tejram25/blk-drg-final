import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/features/auth/AuthContext';
import LoginScreen from './src/features/auth/LoginScreen';
import RegisterScreen from './src/features/auth/RegisterScreen';
import DiagramListScreen from './src/features/diagrams/DiagramListScreen';
import EditorScreen from './src/features/editor/EditorScreen';
import { RootStackParamList } from './src/navigation';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Root() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Diagrams" component={DiagramListScreen} />
            <Stack.Screen name="Editor" component={EditorScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PreviewComp = process.env.EXPO_PUBLIC_PREVIEW
  ? require('./src/Preview').default
  : null;

export default function App() {
  if (PreviewComp) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PreviewComp />
      </GestureHandlerRootView>
    );
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="auto" />
            <Root />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
