// import React, { useRef, useCallback } from 'react';
// import { StyleSheet, View } from 'react-native';
// import { Camera } from 'react-native-vision-camera';
// import { ScannerService } from '../../services/ScannerService';

// interface ScannerViewProps {
//   onScanComplete: (result: ScanResult) => void;
//   onError: (error: Error) => void;
// }

// export const ScannerView: React.FC<ScannerViewProps> = ({ 
//   onScanComplete, 
//   onError 
// }) => {
//   const cameraRef = useRef<Camera>(null);
//   const scannerService = useRef(new ScannerService()).current;

//   const handleCapture = useCallback(async () => {
//     try {
//       if (cameraRef.current) {
//         scannerService.setCamera(cameraRef.current);
//         const result = await scannerService.scanPanel();
//         onScanComplete(result);
//       }
//     } catch (error) {
//       onError(error instanceof Error ? error : new Error('Scanning failed'));
//     }
//   }, [onScanComplete, onError]);

//   return (
//     <View style={styles.container}>
//       <Camera
//         ref={cameraRef}
//         style={StyleSheet.absoluteFill}
//         device={scannerService.getCameraDevice() || {}}
//         isActive={true}
//         photo={true}
//         orientation="portrait"
//       />
//       {/* Add your camera UI components here */}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
// });