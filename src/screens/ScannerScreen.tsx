import React, { useState } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { Button, Title, Text, ProgressBar, IconButton } from 'react-native-paper';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { ScannerService } from '../services/scannerService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { RootStackParamList } from '../navigation';
import { DualScanResult } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export const ScannerScreen: React.FC<Props> = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [cameraActive, setCameraActive] = useState(false); // New state for camera activity
  const [scanning, setScanning] = useState(false);
  const [firstImage, setFirstImage] = useState<string | null>(null);
  const [secondImage, setSecondImage] = useState<string | null>(null);
  const cameraRef = React.useRef<Camera>(null);
  const scannerService = React.useRef(new ScannerService()).current;
  const devices = useCameraDevices();

  const device = React.useMemo(() => {
    return devices.find(d => d.position === 'back');
  }, [devices]);

  React.useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const cameraPermission = await Camera.requestCameraPermission();
    setHasPermission(cameraPermission === 'granted');
  };

  const toggleCamera = () => {
    setCameraActive(prev => !prev);
  };

  const processImages = async () => {
    if (!firstImage || !secondImage) {
      Alert.alert('Error', 'Please capture both images first');
      return;
    }

    try {
      setScanning(true);
      // const firstResult = await scannerService.processFile(firstImage);
      // const secondResult = await scannerService.processFile(secondImage);
      const scanResult: DualScanResult = await scannerService.processFiles({ first: firstImage, second: secondImage });

      navigation.navigate('Panel', {
        panelData: {
          firstPanel: scanResult.first.results,
          secondPanel: scanResult.second.results,
        },
      });
    } catch (error) {
      console.error('Image processing error:', error);
      Alert.alert(
        'Error',
        'Failed to process images. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setScanning(false);
    }
  };

  const handleCameraCapture = async (isFirstImage: boolean) => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera not ready');
      return;
    }

    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'auto',
      });

      if (isFirstImage) {
        setFirstImage(photo.path);
      } else {
        setSecondImage(photo.path);
      }
    } catch (error) {
      console.error('Camera capture error:', error);
      Alert.alert(
        'Error',
        'Failed to capture image. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSelectImage = async (isFirstImage: boolean) => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
        includeBase64: false,
      });

      if (result.didCancel) return;

      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Image selection failed');
      }

      if (result.assets && result.assets[0]?.uri) {
        if (isFirstImage) {
          setFirstImage(result.assets[0].uri);
        } else {
          setSecondImage(result.assets[0].uri);
        }
      } else {
        throw new Error('No image selected');
      }
    } catch (error) {
      console.error('Gallery selection error:', error);
      Alert.alert(
        'Error',
        'Failed to select image from gallery. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text>Camera permission not granted</Text>
        <Button
          mode="contained"
          onPress={checkPermissions}
          style={styles.button}
        >
          Request Permission
        </Button>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {cameraActive && (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={cameraActive} // Only active when toggled
          photo={true}
          enableZoomGesture
        />
      )}

      <View style={styles.overlay}>
        <Title style={styles.title}>Scan Panels</Title>
        <Text style={styles.instruction}>
          Capture or select both panel images
        </Text>
        <Button mode="contained" onPress={toggleCamera} style={styles.cameraButton}>
          {cameraActive ? 'Close Camera' : 'Open Camera'}
        </Button>
      </View>

      <View style={styles.previewContainer}>
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Screen Image</Text>
          {firstImage ? (
            <Image source={{ uri: firstImage }} style={styles.preview} />
          ) : (
            <Text style={styles.placeholderText}>No image</Text>
          )}
          <View style={styles.previewButtons}>
            <IconButton
              icon="camera"
              mode="contained-tonal"
              size={24}
              onPress={() => handleCameraCapture(true)}
              disabled={scanning || !cameraActive}
              style={styles.iconButton}
            />
            <IconButton
              icon="image"
              mode="contained-tonal"
              size={24}
              onPress={() => handleSelectImage(true)}
              disabled={scanning}
              style={styles.iconButton}
            />
          </View>
        </View>

        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Panel Image</Text>
          {secondImage ? (
            <Image source={{ uri: secondImage }} style={styles.preview} />
          ) : (
            <Text style={styles.placeholderText}>No image</Text>
          )}
          <View style={styles.previewButtons}>
            <IconButton
              icon="camera"
              mode="contained-tonal"
              size={24}
              onPress={() => handleCameraCapture(false)}
              disabled={scanning || !cameraActive}
              style={styles.iconButton}
            />
            <IconButton
              icon="image"
              mode="contained-tonal"
              size={24}
              onPress={() => handleSelectImage(false)}
              disabled={scanning}
              style={styles.iconButton}
            />
          </View>
        </View>
      </View>

      {scanning && <ProgressBar indeterminate style={styles.progress} />}

      <Button
        mode="contained"
        onPress={processImages}
        loading={scanning}
        disabled={!firstImage || !secondImage || scanning}
        style={styles.processButton}
      >
        Process Images
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#56D38AFF',
  },
  cameraButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  instruction: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  previewContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  previewBox: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  previewLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  preview: {
    width: 150,
    height: 100,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 12,
    marginVertical: 40,
  },
  previewButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  iconButton: {
    margin: 0,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  processButton: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    borderRadius: 25,
    zIndex: 1,
  },
  progress: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
  },
  button: {
    marginTop: 16,
  },
  loadingText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default ScannerScreen;