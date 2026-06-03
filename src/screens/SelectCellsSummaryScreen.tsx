import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { FONTS, COLORS } from '../constants/fonts';
import { RootStackParamList } from '../navigation';

type SelectCellsSummaryScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SelectCellsSummaryScreen'>;
  route: RouteProp<RootStackParamList, 'SelectCellsSummaryScreen'>;
};

const SelectCellsSummaryScreen: React.FC<SelectCellsSummaryScreenProps> = ({ navigation, route }) => {
  // Get the selected cells from route params
  const selectedCells = route.params?.selectedCells || [];
  const searchParams = route.params?.searchParams || { antibodies: [], ruleOutAntibodies: [] };

  console.log(selectedCells);
  console.log(searchParams);

  // Get screen dimensions for table height
  const { height: screenHeight } = Dimensions.get('window');

  // Calculate a reasonable table height (50% of screen height)
  const tableHeight = screenHeight * 0.5;

  // Handle close button
  const handleClose = () => {
    navigation.goBack();
  };

  // Handle save button
  const handleSave = () => {
    // Check if we have any cells to save
    if (selectedCells.length === 0) {
      Alert.alert('No Cells Selected', 'No matching cells to save for analysis.');
      return;
    }

    // Navigate to AntibodyLab with the selected cells
    const firstSelected = selectedCells[0];
  };

  // Get cell result display value
  const getCellResultDisplay = (cell: any, antigen: string): string => {
    if (!cell.results || typeof cell.results[antigen] === 'undefined') {
      return '';
    }

    const result = cell.results[antigen];
    return result;
  };

  // Render the cell result with appropriate styling
  const renderCellResult = (cell: any, antigen: string) => {
    const result = getCellResultDisplay(cell, antigen);

    // Set style based on result value
    let resultStyle = {};
    if (result === '+') {
      resultStyle = { color: '#d32f2f', fontWeight: 'bold' };
    } else if (result === '0') {
      resultStyle = { color: '#333' };
    } else if (result === '/') {
      resultStyle = { color: '#5c8599', fontWeight: 'bold' };
    } else if (result === '+w' || result === '+s') {
      resultStyle = { color: '#f57c00', fontWeight: 'bold' };
    }

    // Highlight if this is a searched antibody
    if (
      searchParams.antibodies.includes(antigen) ||
      Object.keys(searchParams.dosageMap).includes(antigen)
    ) {
      resultStyle = { ...resultStyle, backgroundColor: '#e3f2fd' };
    }

    return (
      <Text style={[styles.tableCell, resultStyle]}>
        {result}
      </Text>
    );
  };

  // We'll only show the columns for antigens that are in the search query
  const displayAntigens = [...searchParams.antibodies, Object.keys(searchParams.dosageMap)];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.focusVueHeader}>
          <Image
            source={require('../../assets/images/focusvue-icon.png')}
            style={styles.focusVueIcon}
          />
        </View>

        {/* Horizontal ScrollView for the entire table */}
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
          <View style={styles.tableContainer}>
            {/* Fixed Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.headerCell}>Lot</Text>
              <Text style={styles.headerCell}>Expiry</Text>
              <Text style={styles.headerCell}>Cell</Text>

              {/* Only show antigens from the search query */}
              {displayAntigens.map((antigen, index) => (
                <Text
                  key={`header-${antigen}`}
                  style={[styles.headerCell, styles.searchAntigenHeader]}
                >
                  {antigen}
                </Text>
              ))}
              <Text style={styles.headerCell}>Result</Text>
              <Text style={[styles.headerCell, styles.checkCellsHeader]}>Check cells</Text>
            </View>

            {/* Vertical ScrollView for Table Rows */}
            <ScrollView
              style={[styles.tableBodyScroll, { height: tableHeight }]}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Table Rows */}
              {selectedCells.length > 0 ? (
                selectedCells.map((cell, rowIndex) => {
                  return (
                    <View key={`row-${cell.uniqueId || rowIndex}`} style={styles.tableRow}>

                      {/* Lot Number */}
                      <Text style={styles.tableCell}>{cell.lotNumber || ''}</Text>

                      {/* Expiry Date */}
                      <Text style={styles.tableCell}>{cell.expiryDate || ''}</Text>

                      {/* Cell Number */}
                      <Text style={styles.tableCell}>{cell.cellNumber || cell.cellIndex + 1}</Text>

                      {/* Only show antigens from the search query */}
                      {displayAntigens.map((antigen, index) => (
                        <React.Fragment key={`cell-${rowIndex}-${antigen}`}>
                          {renderCellResult(cell, antigen)}
                        </React.Fragment>
                      ))}

                      {/* Result */}
                      {renderCellResult(cell, 'result')}

                      {/* Check cells column */}
                      <View style={[styles.tableCell, styles.checkCellContainer]}>
                        {getCellResultDisplay(cell, 'result') === '0' ? (
                          <Icon name="check-circle" size={22} color="#4CAF50" />
                        ) : (
                          <Text>{'NT'}</Text>
                        )}
                      </View>
                    </View>
                  );
                })
              ) : (
                // Fallback for no data
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No matching cells found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, selectedCells.length === 0 ? styles.disabledButton : null]}
            onPress={handleSave}
            disabled={selectedCells.length === 0}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  focusVueHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  focusVueIcon: {
    width: 200,
    height: 100,
    resizeMode: 'contain',
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#5d8aa8',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#5d8aa8',
    paddingVertical: 12,
    top: 0,
    zIndex: 10,
  },
  headerCell: {
    minWidth: 80,
    paddingHorizontal: 10,
    textAlign: 'center',
    color: '#5d8aa8',
    fontWeight: 'bold',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  searchAntigenHeader: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
  },
  ruleOutAntigenHeader: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  checkCellsHeader: {
    minWidth: 100, // Wider for "Check cells" column
  },
  tableBodyScroll: {
    // Fixed height for vertical scrolling
    flexGrow: 0,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableCell: {
    minWidth: 80,
    paddingHorizontal: 10,
    paddingVertical: 15,
    textAlign: 'center',
    color: '#333',
  },
  checkCellContainer: {
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 20,
    gap: 20,
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: '40%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#5d8aa8',
    fontSize: 16,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  saveButton: {
    backgroundColor: '#5d8aa8',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: '40%',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#a0b4c1', // Lighter color for disabled state
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
});

export default SelectCellsSummaryScreen;