import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { AppNavigator as MainAppNavigator } from './navigation';
import SignIn from '../screens/SignIn';
import SignUp from '../screens/SignUp';
import { DataProvider } from './context/DataContext';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Platform } from 'react-native';
import Orientation from 'react-native-orientation-locker';

// Create the main stack navigator
const RootStack = createStackNavigator();

const App = () => {
  useEffect(() => {
    
    // Unlock all orientations by default - individual screens can lock as needed
    Orientation.unlockAllOrientations();
    
    const requestPermissions = async () => {
      try {
        // Request Camera Permission
        const cameraStatus = await request(
          Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA
        );

        if (cameraStatus === RESULTS.GRANTED) {
          console.log('Camera permission granted');
        }

        // Request File Management Permission
        const readStatus = await request(
          Platform.OS === 'ios'
            ? PERMISSIONS.IOS.PHOTO_LIBRARY
            : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE
        );

        if (readStatus === RESULTS.GRANTED) {
          console.log('File read permission granted');
        }

        const writeStatus = await request(
          Platform.OS === 'ios'
            ? PERMISSIONS.IOS.PHOTO_LIBRARY
            : PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE
        );

        if (writeStatus === RESULTS.GRANTED) {
          console.log('File write permission granted');
        }
      } catch (error) {
        console.error('Permission error:', error);
      }
    };

    requestPermissions();
  }, []);
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <DataProvider>
            <NavigationContainer>
              <RootStack.Navigator screenOptions={{ headerShown: false }}>
                {/* Auth screens */}
                <RootStack.Screen name="SignIn" component={SignIn} />
                <RootStack.Screen name="SignUp" component={SignUp} />
                
                {/* Main app screens as a nested navigator */}
                <RootStack.Screen 
                  name="MainApp" 
                  component={MainAppNavigator} 
                  options={{ headerShown: false }}
                />
              </RootStack.Navigator>
            </NavigationContainer>
          </DataProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
