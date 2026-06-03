import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, TextInput, Checkbox, Text } from 'react-native-paper';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { HTMLToImageComponent } from '../components/Report/HTMLToImageComponent';
import RNFS from 'react-native-fs';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Report'>;
  route: RouteProp<RootStackParamList, 'Report'>;
};

export const ReportScreen: React.FC<Props> = ({ route }) => {
  const { panels } = route.params;
  const [formData, setFormData] = useState({
    patientId: '',
    conclusion: '',
    tech: '',
    notes: '',
  });
  const [includeRuledOut, setIncludeRuledOut] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateHtml, setTemplateHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const htmlToImageRef = useRef<{ saveImage: () => void }>(null);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      // Make sure 'template.html' is in the correct assets folder
      const template = await RNFS.readFileAssets('template.html', 'utf8');
      if (!template) {
        throw new Error('Template is empty');
      }
      console.log('Template loaded:', template.substring(0, 100)); // Log first 100 chars
      setTemplateHtml(template);
    } catch (error) {
      console.error('Failed to load template:', error);
      setError('Failed to load report template');
    }
  };

  const handleImageGenerated = (path: string) => {
    console.log('Report saved to:', path);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    console.error('Report error:', errorMessage);
  };

  const handleSaveImage = () => {
    htmlToImageRef.current?.saveImage();
  };

  const renderForm = () => (
    <View style={styles.formContainer}>
      <TextInput
        mode="outlined"
        label="Patient ID"
        value={formData.patientId}
        onChangeText={(text) => setFormData(prev => ({ ...prev, patientId: text }))}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Tech"
        value={formData.tech}
        onChangeText={(text) => setFormData(prev => ({ ...prev, tech: text }))}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Conclusion"
        value={formData.conclusion}
        onChangeText={(text) => setFormData(prev => ({ ...prev, conclusion: text }))}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Notes"
        value={formData.notes}
        onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
        multiline
        numberOfLines={3}
        style={styles.input}
      />
      <View style={styles.checkboxContainer}>
        <Checkbox.Android
          status={includeRuledOut ? 'checked' : 'unchecked'}
          onPress={() => setIncludeRuledOut(!includeRuledOut)}
        />
        <Text>Include ruled out data in report</Text>
      </View>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      <Button
        mode="contained"
        onPress={() => setShowPreview(true)}
        style={styles.button}
      >
        Preview Report
      </Button>
    </View>
  );

  const renderPreview = () => (
    <View style={styles.previewContainer}>
      <View style={styles.webviewContainer}>
        {templateHtml && panels && (
          <HTMLToImageComponent
            ref={htmlToImageRef}
            templateHtml={templateHtml}
            screenPanel={panels.second}
            idPanel={panels.first}
            formData={formData}
            includeRuledOut={includeRuledOut}
            onImageGenerated={handleImageGenerated}
            onError={handleError}
          />
        )}
      </View>
      <View style={styles.previewButtons}>
        <Button
          mode="outlined"
          onPress={() => setShowPreview(false)}
          style={styles.previewButton}
        >
          Back to Form
        </Button>
        <Button
          mode="contained"
          onPress={handleSaveImage}
          style={styles.previewButton}
        >
          Save as Image
        </Button>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {showPreview ? renderPreview() : renderForm()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  formContainer: {
    padding: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: -6,
  },
  button: {
    marginTop: 16,
  },
  errorText: {
    marginVertical: 8,
    textAlign: 'center',
    color: 'red',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#fff',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  previewButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  previewButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});

export default ReportScreen;