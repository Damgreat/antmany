import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image,
  TouchableWithoutFeedback,
  Alert,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DatabaseService from '../src/services/DatabaseService';

const SignUp = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        console.log('Database initialized for user registration');
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

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    return password.length >= 6;
  };

  const handleSignUp = async () => {
    // Reset error
    setError('');
    
    // Basic validation
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (!validatePassword(password)) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Use DatabaseService to create new user
      const result = await DatabaseService.createUser(email, password);
      
      if (result.success) {
        Alert.alert(
          'Success',
          'Account created successfully!',
          [{ text: 'OK', onPress: () => navigation.navigate('SignIn') }]
        );
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('An unexpected error occurred. Please try again.');
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
            <Text style={styles.headerText}>Create Your Account</Text>
            
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
            
            <View style={styles.inputWrapper}>
              <View style={styles.iconContainer}>
                <Icon name="lock-closed-outline" size={22} color="#777" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableWithoutFeedback onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <View style={styles.eyeIconContainer}>
                  <Icon 
                    name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} 
                    size={22} 
                    color="#777" 
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
            
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            
            <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
              <Text style={styles.signUpButtonText}>Create Account</Text>
            </TouchableOpacity>
            
            <View style={styles.loginContainer}>
              <Text style={styles.alreadyAccountText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
                <Text style={styles.loginText}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={[
            styles.footerText,
            orientation === 'landscape' && styles.footerTextLandscape
          ]}>Innovation by Dream Forge Workshop</Text>
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
    marginBottom: 30,
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
  headerText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
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
  signUpButton: {
    backgroundColor: '#5c8599',
    borderRadius: 10,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  signUpButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    marginBottom: 40,
  },
  alreadyAccountText: {
    color: '#333',
    fontSize: 16,
  },
  loginText: {
    color: '#5c8599',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    position: 'absolute',
    bottom: 20,
    color: '#5c8599',
    fontSize: 14,
    textAlign: 'center',
  },
  footerTextLandscape: {
    position: 'absolute',
    bottom: 20,
    left: '55%',
    color: '#5c8599',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default SignUp; 