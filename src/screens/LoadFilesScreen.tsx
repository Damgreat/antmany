import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import { FONTS, COLORS } from '../constants/fonts';

type LoadFilesScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LoadFilesScreen'>;
  route: RouteProp<RootStackParamList, 'LoadFilesScreen'>;
};

const LoadFilesScreen: React.FC<LoadFilesScreenProps> = ({ navigation }) => {
  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleSelectRawFolder = () => {
    navigation.navigate('RawFoldersScreen');
  };

  const handleSelectFromDevice = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
        includeBase64: false,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Image selection failed');
      }

      if (result.assets && result.assets[0]?.uri) {
        //navigation.navigate('ImageCapture', { imageUri: result.assets[0].uri });
      } else {
        throw new Error('No image selected');
      }
    } catch (error) {
      console.error('Gallery selection error:', error);
      alert('Failed to select image from gallery. Please try again.');
    }
  };
  
  const handleVerify = () => {
    // Just a placeholder for the verify button functionality
    alert('Verifying files...');
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentWrapper}>
        <Text style={styles.screenTitle}>Load Files From</Text>
        <Text style={styles.deviceInfoText}>iPhone 14 & 15 Pro Max - 100</Text>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Icon name="arrow-left" size={24} color={COLORS.PRIMARY} />
            <Text style={styles.backText}>Go back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />
        
        <View style={styles.optionsContainer}>
          {/* RAW Folder Option */}
          <TouchableOpacity 
            style={styles.optionCard}
            onPress={handleSelectRawFolder}
          >
            <View style={styles.rawIconContainer}>
              <Icon name="file-outline" size={40} color="#000" />
              <Text style={styles.rawText}>RAW</Text>
            </View>
          </TouchableOpacity>

          {/* Device Option */}
          <TouchableOpacity 
            style={styles.optionCard}
            onPress={handleSelectFromDevice}
          >
            <View style={styles.deviceIconContainer}>
              <Icon name="laptop" size={30} color="#000" />
              <Icon name="tablet-ipad" size={24} color="#000" style={styles.smallDeviceIcon} />
              <Icon name="cellphone" size={20} color="#000" style={styles.smallDeviceIcon} />
            </View>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.verifyButton} onPress={handleVerify}>
          <Text style={styles.verifyButtonText}>Verify</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  contentWrapper: {
    flex: 1,
    padding: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
    fontFamily: FONTS.POPPINS_BOLD,
  },
  deviceInfoText: {
    fontSize: 12,
    color: COLORS.LIGHT_TEXT,
    textAlign: 'center',
    marginTop: 5,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    marginLeft: 5,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginTop: 15,
    marginBottom: 30,
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  optionCard: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rawIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rawText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
    fontFamily: FONTS.POPPINS_BOLD,
  },
  deviceIconContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    position: 'relative',
    height: 50,
  },
  smallDeviceIcon: {
    marginLeft: -10,
    marginBottom: 5,
  },
  verifyButton: {
    backgroundColor: COLORS.SECONDARY,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 40,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
});

export default LoadFilesScreen; 