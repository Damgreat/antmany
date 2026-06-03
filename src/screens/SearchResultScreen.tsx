import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { FONTS, COLORS } from '../constants/fonts';
import { RootStackParamList } from '../navigation';
import DatabaseService from '../services/DatabaseService';
import { findMatchingCells, sortResultsByRelevance } from '../utils/panelSearch';

type SearchResultScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SearchResultScreen'>;
  route: RouteProp<RootStackParamList, 'SearchResultScreen'>;
};

const SearchResultScreen: React.FC<SearchResultScreenProps> = ({ navigation, route }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [matchingCellsOnly, setMatchingCellsOnly] = useState<any[]>([]);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useState<{
    antibodies: string[];
    ruleOutAntibodies: string[];
    dosageMap?: {[key: string]: string};
    sourceScreen?: string;
    excludePanelIds?: string[];
  }>({ antibodies: [], ruleOutAntibodies: [], excludePanelIds: [] });

  // Get screen dimensions for table height
  const { height: screenHeight } = Dimensions.get('window');
  
  // Calculate a reasonable table height (50% of screen height)
  const tableHeight = screenHeight * 0.6;

  // Standard antigens to display (matching the UI in the example)
  const standardAntigens = ['D', 'C', 'E', 'Cw', 'V', 'K', 'Kpa', 'Jsa', 'Fyb', 'Jkb', 'Xga', 'Leb', 'S', 'M', 'Lua'];

  // Extract search parameters from route
  useEffect(() => {
    if (route.params?.searchParams) {
      const params = route.params.searchParams;
      setSearchParams({
        antibodies: params.antibodies || [],
        ruleOutAntibodies: params.ruleOutAntibodies || [],
        dosageMap: params.dosages || {}, // Note: it's 'dosages' in the route params
        sourceScreen: params.sourceScreen,
        excludePanelIds: params.excludePanelIds || []
      });
    }
  }, [route.params]);

  // Fetch all panels from database and perform search
  const performSearch = useCallback(async () => {
    try {
      setIsLoading(true);

      // Validate search parameters
      if (!searchParams.antibodies || searchParams.antibodies.length === 0) {
        Alert.alert('Error', 'No antibodies specified for search');
        setIsLoading(false);
        return;
      }

      // Initialize database
      await DatabaseService.initDatabase();

      // Get all panels from database
      const screenFiles = await DatabaseService.getFiles({ type: 'ABScreen' });
      const panelFiles = await DatabaseService.getFiles({ type: 'ABIDPanel' });
      const selectCellsFiles = await DatabaseService.getFiles({ type: 'SelectCells' });
      const allFiles = [...screenFiles, ...panelFiles, ...selectCellsFiles];

      // Filter out panels that are already loaded (if excludePanelIds is provided)
      const filteredFiles = searchParams.excludePanelIds?.length 
        ? allFiles.filter(file => !searchParams.excludePanelIds?.includes(file.id.toString()))
        : allFiles;

      console.log(`Searching through ${filteredFiles.length} panels after excluding loaded panels`);

      // Process each panel file to find matching cells
      const matchingResults: any[] = [];
      const allMatchingCells: any[] = []; // Store only the cells that match search criteria

      for (const file of filteredFiles) {
        try {
          const panelData = JSON.parse(file.data);
          
          // Skip if panel doesn't have required data
          if (!panelData || !panelData.cells || !panelData.antigens) {
            continue;
          }

          // Find cells that match search criteria
          const matchingCells = findMatchingCells(
            panelData,
            searchParams.antibodies || [],
            searchParams.ruleOutAntibodies || [],
            searchParams.dosageMap || {}
          );

          if (matchingCells && matchingCells.length > 0) {
            // Prepare matching cells for this panel
            const panelMatchingCells: any[] = [];
            
            // Add each matching cell to our results with full metadata
            matchingCells.forEach((matchCell, index) => {
              const cellData = matchCell;
              
              const enrichedCell = {
                ...cellData,
                cellIndex: matchCell.cellIndex,
                panelId: file.id,
                panelName: file.name || panelData.metadata?.testName || 'Unnamed Panel',
                panelType: file.type,
                lotNumber: panelData.metadata?.lotNumber || '',
                expiryDate: panelData.metadata?.expiryDate || '',
                uniqueId: `${file.id}-${matchCell.cellIndex}`,
                availableAntigens: panelData.antigens,
                isMatchingCell: true
              };
              
              allMatchingCells.push(enrichedCell);
              panelMatchingCells.push(enrichedCell);
            });

            matchingResults.push({
              id: file.id,
              name: file.name || panelData.metadata?.testName || 'Unnamed Panel',
              type: file.type,
              matchingCells: panelMatchingCells, // Keep the original structure for sorting function
              matchingCellsCount: matchingCells.length,
              panelData
            });
          }
        } catch (error) {
          console.error('Error processing panel file:', error);
        }
      }

      // Sort results by relevance with proper error handling
      let sortedResults = matchingResults;
      try {
        if (matchingResults.length > 0 && typeof sortResultsByRelevance === 'function') {
          sortedResults = sortResultsByRelevance(
            matchingResults, 
            searchParams.antibodies || [],
            searchParams.ruleOutAntibodies || [],
            searchParams.dosageMap || {}
          );
        }
      } catch (sortError) {
        console.error('Error sorting results, using unsorted results:', sortError);
        // Continue with unsorted results if sorting fails
      }

      // Set the results
      setResults(sortedResults);

      // Store only the matching cells for display
      setMatchingCellsOnly(allMatchingCells);

      // Auto-select all matching cells
      const newSelectedCells = new Set<string>();
      allMatchingCells.forEach(cell => {
        newSelectedCells.add(cell.uniqueId);
      });
      setSelectedCells(newSelectedCells);

      setIsLoading(false);
    } catch (error) {
      console.error('Error performing search:', error);
      Alert.alert('Error', 'Failed to perform search. Please try again.');
      setIsLoading(false);
    }
  }, [searchParams]);

  // Load search results when parameters change
  useEffect(() => {
    if (searchParams.antibodies && searchParams.antibodies.length > 0) {
      performSearch();
    }
  }, [searchParams, performSearch]);

  // Handle back button press
  const handleGoBack = () => {
    navigation.goBack();
  };

  // Toggle cell selection
  const toggleCellSelection = (cellId: string) => {
    setSelectedCells(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(cellId)) {
        newSelection.delete(cellId);
      } else {
        newSelection.add(cellId);
      }
      return newSelection;
    });
  };

  // Handle the FocusVue button press
  const handleFocusVue = () => {
    // Check if any cells are selected
    if (selectedCells.size === 0) {
      Alert.alert('No Cells Selected', 'Please select at least one cell for analysis.');
      return;
    }

    // Filter the selected cells from the matching cells only
    const selectedCellsData = matchingCellsOnly.filter(cell => 
      selectedCells.has(cell.uniqueId)
    );

    if (selectedCellsData.length === 0) {
      Alert.alert('No Cells Selected', 'Please select at least one matching cell for analysis.');
      return;
    }

    // Create display antigens list
    const displayAntigens = [
      ...standardAntigens,
      ...searchParams.antibodies.filter(a => !standardAntigens.includes(a)),
      ...searchParams.ruleOutAntibodies.filter(a => !standardAntigens.includes(a) && 
                                                    !searchParams.antibodies.includes(a))
    ];

    // Navigate to the SelectCellsSummaryScreen with the selected matching cells
    navigation.navigate('SelectCellsSummaryScreen', {
      selectedCells: selectedCellsData,
      searchParams: searchParams,
      displayAntigens: displayAntigens
    });
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
    
    return (
      <Text style={[styles.tableCell, resultStyle]}>
        {result}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Searching panels...</Text>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <Text style={styles.screenTitle}>
            Search Result
          </Text>
          
          {matchingCellsOnly.length > 0 ? (
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
              <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <View style={styles.checkboxCell}></View>
                  <Text style={styles.headerCell}>Cell</Text>
                  <Text style={styles.headerCell}>Lot</Text>
                  <Text style={styles.headerCell}>Expiry</Text>
                  
                  {/* Standard Antigens */}
                  {standardAntigens.map((antigen, index) => (
                    <Text key={`header-${antigen}`} style={styles.headerCell}>{antigen}</Text>
                  ))}
                  
                  {/* Required Search Antigens (if not in standard list) */}
                  {searchParams.antibodies.filter(a => !standardAntigens.includes(a)).map((antigen, index) => (
                    <Text key={`header-req-${antigen}`} style={[styles.headerCell, styles.searchAntigenHeader]}>{antigen}</Text>
                  ))}
                  
                  {/* Rule-Out Antigens (if not in standard list) */}
                  {searchParams.ruleOutAntibodies.filter(a => !standardAntigens.includes(a) &&
                                                       !searchParams.antibodies.includes(a)).map((antigen, index) => (
                    <Text key={`header-rule-${antigen}`} style={[styles.headerCell, styles.ruleOutAntigenHeader]}>{antigen}</Text>
                  ))}
                  
                  <Text style={styles.headerCell}>Result</Text>
                </View>

                {/* Vertical ScrollView for Table Rows */}
                <ScrollView 
                  style={[styles.tableBodyScroll, { height: tableHeight }]}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {/* Table Rows - Only showing matching cells */}
                  {matchingCellsOnly.map((cell, rowIndex) => (
                    <View key={`row-${cell.uniqueId}`} style={[
                      styles.tableRow,
                      styles.matchingRow // All rows are matching since we're only showing matching cells
                    ]}>
                      {/* Checkbox Cell */}
                      <TouchableOpacity 
                        style={styles.checkboxCell}
                        onPress={() => toggleCellSelection(cell.uniqueId)}
                      >
                        {selectedCells.has(cell.uniqueId) ? (
                          <Icon name="check-circle" size={22} color={COLORS.PRIMARY} />
                        ) : (
                          <Icon name="circle-outline" size={22} color="#777" />
                        )}
                      </TouchableOpacity>
                      
                      {/* Cell Number */}
                      <Text style={styles.tableCell}>{cell.cellNumber || cell.cellIndex + 1}</Text>
                      
                      {/* Lot Number */}
                      <Text style={styles.tableCell}>{cell.lotNumber || ''}</Text>
                      
                      {/* Expiry Date */}
                      <Text style={styles.tableCell}>{cell.expiryDate || ''}</Text>
                      
                      {/* Standard Antigens Results */}
                      {standardAntigens.map((antigen, index) => (
                        <React.Fragment key={`cell-${rowIndex}-${antigen}`}>
                          {renderCellResult(cell, antigen)}
                        </React.Fragment>
                      ))}
                      
                      {/* Required Search Antigens (if not in standard list) */}
                      {searchParams.antibodies.filter(a => !standardAntigens.includes(a)).map((antigen, index) => (
                        <React.Fragment key={`cell-${rowIndex}-req-${antigen}`}>
                          {renderCellResult(cell, antigen)}
                        </React.Fragment>
                      ))}
                      
                      {/* Rule-Out Antigens (if not in standard list) */}
                      {searchParams.ruleOutAntibodies.filter(a => !standardAntigens.includes(a) &&
                                                          !searchParams.antibodies.includes(a)).map((antigen, index) => (
                        <React.Fragment key={`cell-${rowIndex}-rule-${antigen}`}>
                          {renderCellResult(cell, antigen)}
                        </React.Fragment>
                      ))}
                      
                      {/* Result */}
                      {renderCellResult(cell, 'result')}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.noResultsContainer}>
              <Icon name="alert-circle-outline" size={60} color="#999" />
              <Text style={styles.noResultsText}>
                No matching cells found.
              </Text>
              <Text style={styles.noResultsSubtext}>
                Try adjusting your search criteria.
              </Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={handleGoBack}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.focusVueButton,
                matchingCellsOnly.length === 0 && styles.disabledButton
              ]} 
              onPress={handleFocusVue}
              disabled={matchingCellsOnly.length === 0}
            >
              <Text style={styles.focusVueButtonText}>FocusVue</Text>
              <Icon name="magnify" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f0f0f0',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    fontFamily: FONTS.POPPINS_MEDIUM,
    color: '#333',
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#5d8aa8',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#5d8aa8',
    paddingVertical: 12,
    position: 'sticky',
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
  tableBodyScroll: {
    flexGrow: 0,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  matchingRow: {
    backgroundColor: '#f0f7fa', // Light blue background for matching rows
  },
  tableCell: {
    minWidth: 80,
    paddingHorizontal: 10,
    paddingVertical: 15,
    textAlign: 'center',
    color: '#333',
  },
  checkboxCell: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noResultsText: {
    fontSize: 18,
    color: '#333',
    marginTop: 15,
    marginBottom: 6,
    fontFamily: FONTS.POPPINS_MEDIUM,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    fontFamily: FONTS.POPPINS_REGULAR,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 5,
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: '45%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#5d8aa8',
    fontSize: 16,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  focusVueButton: {
    backgroundColor: '#5d8aa8',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: '45%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  focusVueButtonText: {
    color: '#fff',
    fontSize: 16,
    marginRight: 10,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
});

export default SearchResultScreen;