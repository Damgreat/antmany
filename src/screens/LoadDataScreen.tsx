import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Button, Text, Portal, Dialog, ActivityIndicator } from 'react-native-paper';
import RNFS from 'react-native-fs';
//import DocumentPicker, { DocumentPickerResponse } from 'react-native-document-picker';
import {pick} from '@react-native-documents/picker'

import { RootStackParamList } from '../navigation';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PanelData } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'LoadData'>;

export const LoadDataScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{
    screen?: DocumentPickerResponse;
    panel?: DocumentPickerResponse;
  }>({});
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const selectFile = async (type: 'screen' | 'panel') => {
    try {
      const result = await pick({
        type: ['application/json'],
      });

      const file = Array.isArray(result) ? result[0] : result;
      // Validate if it's a JSON file
      if (!file.uri!.endsWith('.json')) {
        setError('Please select a JSON file');
        setShowErrorDialog(true);
        return;
      }
      try {
        // const path = file.uri.startsWith('file://') ? file.uri.replace('file://', '') : file.uri;
        // const content = await RNFS.readFile(path, 'utf8');
        // const data = JSON.parse(content);
        // if (!data.antigenGroup) {
        //   setError('Invalid panel data format');
        //   setShowErrorDialog(true);
        //   return;
        // }

        setSelectedFiles(prev => ({
          ...prev,
          [type]: file,
        }));

      } catch (e) {
        setError('Error reading file. Please make sure it contains valid panel data.');
        setShowErrorDialog(true);
      }

    } catch (err) {
      //if (!DocumentPicker.isCancel(err)) {
        setError('Error selecting file. Please try again.');
        setShowErrorDialog(true);
        throw err;
      //}
    }
  };

  const loadPanelData = async () => {
    if (!selectedFiles.screen || !selectedFiles.panel) {
      setError('Please select both a screen and panel file.');
      setShowErrorDialog(true);
      return;
    }

    try {
      setLoading(true);

      const screenContent = await RNFS.readFile(selectedFiles.screen.uri, 'utf8');
      const panelContent = await RNFS.readFile(selectedFiles.panel.uri, 'utf8');
      const firstPanel = JSON.parse(screenContent) as PanelData;
      const secondPanel = JSON.parse(panelContent) as PanelData;

      navigation.navigate('Panel', {
        panelData: {
          firstPanel,
          secondPanel,
        },
      });
    } catch (e) {
      console.error('Error loading panel data:', e);
      setError('Error loading panel data. Please try again.');
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>Load Panel Data</Text>

          <View style={styles.selectionContainer}>
            <View style={styles.fileSelection}>
              <Text variant="bodyLarge">Screen File:</Text>
              <Button
                mode="outlined"
                onPress={() => selectFile('screen')}
                style={styles.selectButton}
              >
                {selectedFiles.screen ? selectedFiles.screen.uri.split('/').slice(-1)[0] : 'Select Screen'}
              </Button>
            </View>

            <View style={styles.fileSelection}>
              <Text variant="bodyLarge">Panel File:</Text>
              <Button
                mode="outlined"
                onPress={() => selectFile('panel')}
                style={styles.selectButton}
              >
                {selectedFiles.panel ? selectedFiles.panel.uri.split('/').slice(-1)[0] : 'Select Panel'}
              </Button>
            </View>
          </View>

          <Button
            mode="contained"
            onPress={loadPanelData}
            disabled={!selectedFiles.screen || !selectedFiles.panel || loading}
            style={styles.loadButton}
          >
            Load Selected Panels
          </Button>
        </Card.Content>
      </Card>

      <Portal>
        <Dialog visible={showErrorDialog} onDismiss={() => setShowErrorDialog(false)}>
          <Dialog.Title>Error</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{error}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowErrorDialog(false)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  card: {
    elevation: 4,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  selectionContainer: {
    gap: 16,
    marginBottom: 24,
  },
  fileSelection: {
    gap: 8,
  },
  selectButton: {
    width: '100%',
  },
  loadButton: {
    marginTop: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LoadDataScreen;