import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image,
  TouchableWithoutFeedback,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DatabaseService from '../src/services/DatabaseService';

const SignIn = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orientation, setOrientation] = useState('portrait');
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    // Initialize database
    const initDb = async () => {
      try {
        // await DatabaseService.initDatabase();
        await DatabaseService.createUserTable();
        console.log('Database initialized for authentication');
      } catch (error) {
        console.error('Error initializing database:', error);
        setError('Could not connect to the database');
      }
    };

    initDb();

    // Add event listener for orientation changes
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      setOrientation(window.width > window.height ? 'landscape' : 'portrait');
    });

    // Initial orientation check
    setOrientation(dimensions.width > dimensions.height ? 'landscape' : 'portrait');

    // Cleanup
    return () => subscription.remove();
  }, []);

  const handleLogin = async () => {
    // Basic validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Use DatabaseService for login
      const result = await DatabaseService.loginUser(email, password);
      
      if (result.success) {
        // Login successful - navigate to the main app
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainApp' }],
        });
      } else {
        setError(result.message || 'Invalid email or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={[
          styles.container,
          orientation === 'landscape' && styles.containerLandscape
        ]}>
          <View style={[
            styles.logoContainer,
            orientation === 'landscape' && styles.logoContainerLandscape
          ]}>
            <Image 
              source={require('../assets/nexid_logo.png')} 
              style={[
                styles.logo,
                orientation === 'landscape' && styles.logoLandscape
              ]} 
              resizeMode="contain"
            />
          </View>
          
          <View style={[
            styles.formContainer,
            orientation === 'landscape' && styles.formContainerLandscape
          ]}>
            <View style={styles.inputWrapper}>
              <View style={styles.iconContainer}>
                <Icon name="mail-outline" size={22} color="#777" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
            
            <View style={styles.inputWrapper}>
              <View style={styles.iconContainer}>
                <Icon name="lock-closed-outline" size={22} color="#777" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableWithoutFeedback onPress={() => setShowPassword(!showPassword)}>
                <View style={styles.eyeIconContainer}>
                  <Icon 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={22} 
                    color="#777" 
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
            
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            
            <TouchableOpacity 
              style={[styles.loginButton, isLoading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Log In</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.forgotPassword}
              disabled={isLoading}
            >
              <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
            </TouchableOpacity>
            
            <View style={styles.createAccountContainer}>
              <Text style={styles.noAccountText}>Don't have an account? </Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('SignUp')}
                disabled={isLoading}
              >
                <Text style={styles.createAccountText}>Create Account</Text>
              </TouchableOpacity>
            </View>

            {orientation === 'landscape' && (
              <View style={styles.footerContainerLandscape}>
                <Text style={styles.footerTextContent}>Innovation by Dream Forge Workshop</Text>
              </View>
            )}
          </View>
          
          {orientation === 'portrait' && (
            <View style={styles.footerContainer}>
              <Text style={styles.footerTextContent}>Innovation by Dream Forge Workshop</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  containerLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logoContainerLandscape: {
    marginBottom: 0,
    marginRight: 30,
    width: '30%',
  },
  logo: {
    width: 150,
    height: 80,
  },
  logoLandscape: {
    width: 200,
    height: 100,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  formContainerLandscape: {
    width: '60%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 56,
    backgroundColor: '#f7f7fa',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e5e8',
  },
  iconContainer: {
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#333',
    fontSize: 16,
  },
  eyeIconContainer: {
    paddingHorizontal: 15,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#5c8599',
    borderRadius: 10,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: '#5c8599',
    fontSize: 16,
  },
  createAccountContainer: {
    flexDirection: 'row',
    marginBottom: 40,
  },
  noAccountText: {
    color: '#333',
    fontSize: 16,
  },
  createAccountText: {
    color: '#5c8599',
    fontSize: 16,
    fontWeight: '600',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  footerContainerLandscape: {
    width: '100%',
    alignItems: 'center',
  },
  footerTextContent: {
    color: '#5c8599',
    fontSize: 14,
    textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: '#91adb9',
  },
});

export default SignIn; 