import React, { useState } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import DocumentPicker from 'react-native-document-picker';

import {pick, types} from '@react-native-documents/picker'

import RNFS from 'react-native-fs';
//import axios from 'axios';

const TextractComponent = () => {
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickFile = async () => {
    try {
      setLoading(true);
      const result = await pick({
        type: [types.allFiles], // Specify the allowed file types
      });
      sendRequest(result[0]);
    } catch (error) {
      console.error('Error picking a file:', error);
      setLoading(false);
    }
  };

  const sendRequest = async (selectedFile) => {
    const selectedFileUri = selectedFile.uri;
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }
    try {
      const apiUrl ='';

      const myHeaders = new Headers();
      myHeaders.append('x-api-key', '');
      myHeaders.append('Content-Type', selectedFile.type);

      if (!selectedFileUri) {
        console.error('No file selected.');
        setLoading(false);
        return;
      }

      const fileData = await RNFS.readFile(selectedFileUri, 'base64');

      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: fileData,
        redirect: 'follow',
      };

      console.log('req', requestOptions.body);
      const apiResponse = await fetch(apiUrl, requestOptions);
      const result = await apiResponse.text();
      console.log(result);
      const parsedResult = JSON.parse(result);
      setParsedData(parsedResult);
      setLoading(false);
    } catch (error) {
      console.error('Error sending the request:', error);
      setLoading(false);
    }
  };

  return (
    // eslint-disable-next-line react-native/no-inline-styles
    <View style={{flex: 1,justifyContent: 'center',
      alignItems: 'center',
    }}>
      {loading ? (
        <ActivityIndicator size="large" color="blue" />
      ) : (
        <Button title="Pick File" onPress={pickFile} />
      )}
      {parsedData && (
        <View>
          <Text>Data:</Text>
          <Text>{parsedData.data}</Text>
        </View>
      )}
    </View>
  );
};

export default TextractComponent;