import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, TextInput, useWindowDimensions, Platform, TouchableOpacity, Alert } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import Orientation from 'react-native-orientation-locker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type PanelDetailsScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'PanelDetails'>;
  route: RouteProp<RootStackParamList, 'PanelDetails'>;
};

const PanelDetailsScreen: React.FC<PanelDetailsScreenProps> = ({ route, navigation }) => {
  const { lotNumber: initialLotNumber, expirationDate: initialExpirationDate } = route.params;
  
  const [isEditing, setIsEditing] = useState(false);
  const [lotNumber, setLotNumber] = useState(initialLotNumber);
  
  // Convert the initial expiration date string to a Date object
  const initialDate = parseDate(initialExpirationDate);
  const [expirationDate, setExpirationDate] = useState<Date>(initialDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Get screen dimensions for responsive layout
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  
  // Ensure orientation is unlocked when this screen mounts
  useEffect(() => {
    // Unlock all orientations to allow rotation
    Orientation.unlockAllOrientations();
    
    return () => {
      // No need to do anything in cleanup as the next screen will handle its own orientation
    };
  }, []);
  
  // Function to parse date string into Date object
  function parseDate(dateString: string): Date {
    try {
      // Try to parse the ISO format first
      const date = new Date(dateString);
      
      // Check if it's a valid date
      if (isNaN(date.getTime())) {
        // If not valid, try to parse common formats like MM/DD/YYYY
        const parts = dateString.split(/[-\/]/);
        if (parts.length === 3) {
          // Assuming MM/DD/YYYY format
          return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        }
        // If all parsing fails, return tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }
      return date;
    } catch (error) {
      // If any error occurs, return tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
  }
  
  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };
  
  const handleClose = () => {
    navigation.goBack();
  };
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleSave = () => {
    const formattedDate = `${expirationDate.getFullYear()}-${String(expirationDate.getMonth() + 1).padStart(2, '0')}-${String(expirationDate.getDate()).padStart(2, '0')}`;
    
    // Save the changes and pass them back to the previous screen
    setIsEditing(false);
    
  };
  
  const showDatepicker = () => {
    setShowDatePicker(true);
  };
  
  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || expirationDate;
    setShowDatePicker(Platform.OS === 'ios');
    setExpirationDate(currentDate);
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Panel Details</Text>
      
      <View style={styles.detailsContainer}>
        <View style={styles.fieldContainer}>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={lotNumber}
              onChangeText={setLotNumber}
              placeholder="Lot Number"
            />
          ) : (
            <Text style={styles.fieldText}>Lot # {lotNumber}</Text>
          )}
        </View>
        
        <View style={styles.fieldContainer}>
          {isEditing ? (
            <TouchableOpacity 
              onPress={showDatepicker}
              style={styles.datePickerButton}
            >
              <Text style={styles.datePickerText}>
                {formatDate(expirationDate)}
              </Text>
              <Icon name="calendar" size={24} color="#333" />
            </TouchableOpacity>
          ) : (
            <Text style={styles.fieldText}>
              Expiration Date: {formatDate(expirationDate)}
            </Text>
          )}
          
          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={expirationDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              // minimumDate={new Date(new Date().setDate(new Date().getDate() + 1))} // Set minimum date to tomorrow
            />
          )}
        </View>
      </View>
      
      <View style={[styles.buttonContainer, isLandscape && styles.buttonContainerLandscape]}>
        {isEditing ? (
          <Button
            mode="contained"
            style={styles.button}
            buttonColor="#6B96AC"
            textColor="#FFFFFF"
            onPress={handleSave}
          >
            Save
          </Button>
        ) : (
          <Button
            mode="contained"
            style={styles.button}
            buttonColor="#6B96AC"
            textColor="#FFFFFF"
            onPress={handleEdit}
          >
            Edit
          </Button>
        )}
        
        <Button
          mode="contained"
          style={styles.button}
          buttonColor="#6B96AC"
          textColor="#FFFFFF"
          onPress={handleClose}
        >
          Close
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1A1A1A',
  },
  deviceInfo: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 15,
  },
  detailsContainer: {
    flex: 1,
    marginTop: 10,
  },
  fieldContainer: {
    backgroundColor: '#B8B8B8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 15,
    justifyContent: 'center',
  },
  fieldText: {
    fontSize: 16,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  input: {
    fontSize: 16,
    color: '#1A1A1A',
    textAlign: 'center',
    padding: 0,
    height: 25,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingBottom: 20,
  },
  buttonContainerLandscape: {
    flexDirection: 'row',
    marginHorizontal: 2,
    justifyContent: 'space-around',
    marginTop: 'auto',
    paddingBottom: 0,
  },
  button: {
    marginBottom: 12,
    marginHorizontal: 6,
    height: 50,
    justifyContent: 'center',
    borderRadius: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  datePickerText: {
    fontSize: 16,
    color: '#1A1A1A',
    marginRight: 10,
  },
});

export default PanelDetailsScreen; 