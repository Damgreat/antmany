import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Dimensions,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
  ActivityIndicator,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import { PanelGrid } from '../components/PanelGrid';
import { PanelData, RuleResult, AntigenRuleState } from '../types';
import Orientation from 'react-native-orientation-locker';
import { COLORS, FONTS } from '../constants/fonts';
import { useTableDimensions } from '../utils/useTableDimentions';
import DatabaseService from '../services/DatabaseService';
import { format } from 'date-fns';
import { AnalysisTable } from '../components/Analysis/AnalysisTable';
import RNPrint from 'react-native-print';

type CaseArchiveViewScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CaseArchiveViewScreen'>;
  route: RouteProp<RootStackParamList, 'CaseArchiveViewScreen'>;
};

const CaseArchiveViewScreen: React.FC<CaseArchiveViewScreenProps> = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [firstPanel, setFirstPanel] = useState<any>(null);
  const [secondPanel, setSecondPanel] = useState<any>(null);
  const [patientInfo, setPatientInfo] = useState<any>(null);
  const [ruleState, setRuleState] = useState<any>(null);
  const [rules, setRules] = useState<any>([]);
  const { width: screenWidth } = useWindowDimensions();
  const [orientation, setOrientation] = useState(
    Dimensions.get('window').width > Dimensions.get('window').height ? 'landscape' : 'portrait'
  );
  const [activeTab, setActiveTab] = useState<'Screen & Panel' | 'Select Cells & Lot info'>('Screen & Panel');

  // Extract the source parameter from route params
  const { source } = route.params || {};

  // Define antigen groups for tables
  const ANTIGEN_GROUPS = {
    'ABScreen': [],
    'Rh-hr': ['D', 'C', 'E', 'c', 'e', 'Cw', 'V'],
    'KELL': ['K', 'k', 'Kpa', 'Kpb', 'Jsa', 'Jsb'],
    'DUFFY': ['Fya', 'Fyb'],
    'KIDD': ['Jka', 'Jkb'],
    'SEX': ['Xga'],
    'LEWIS': ['Lea', 'Leb'],
    'MNS': ['S', 's', 'M', 'N'],
    'P': ['P1'],
    'LUTHERAN': ['Lua', 'Lub'],
    'COLTON': ['Coa', 'Cob'],
    'DIEGO': ['Dia', 'Dib'],    
    'Patient Result': ['Result']
  };

  // Use the useTableDimensions hook to calculate responsive table dimensions
  const tableDimensions = useTableDimensions(ANTIGEN_GROUPS, 2);

  // Force landscape orientation when screen mounts
  useEffect(() => {
    // Add orientation change detection
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setOrientation(window.width > window.height ? 'landscape' : 'portrait');
    });

    return () => subscription.remove();
  }, []);

  // Load report data
  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true);
        
        // Check for either reportId or fileId in route params
        const { reportId, fileId } = route.params || {};
        const reportIdToUse = reportId || fileId;
        
        console.log('Loading report with ID:', reportIdToUse);
        
        if (!reportIdToUse) {
          console.error('No report ID provided');
          setLoading(false);
          return;
        }
        
        // Get the report from the database
        const report = await DatabaseService.getCaseReportById(reportIdToUse);
        
        if (!report) {
          console.error('Report not found');
          setLoading(false);
          return;
        }
        
        console.log('Report found:', report.id);
        setReportData(report);
        
        // Parse the report data
        try {
          const parsedReportData = JSON.parse(report.report_data);
          console.log('Successfully parsed report data');
          
          setPatientInfo(parsedReportData.patientInfo);
          setFirstPanel(parsedReportData.firstPanel);
          setSecondPanel(parsedReportData.secondPanel);
          setRuleState(parsedReportData.ruleState);
          setRules(parsedReportData.rules);
        } catch (parseError) {
          console.error('Error parsing report data:', parseError);
          Alert.alert(
            'Error',
            'Failed to parse report data. The report may be corrupted.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('Error loading report:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadReport();
  }, [route.params]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handlePrintReport = async () => {
    try {
      setLoading(true);
      
      // Create HTML content for printing
      const htmlContent = generatePrintableHTML();
      
      // Use RNPrint to print the HTML content
      const result = await RNPrint.print({
        html: htmlContent,
        jobName: `AntibodyLabReport-${reportData?.id || new Date().getTime()}`,
      });
      
      setLoading(false);
      
      // Show alert with print result
      if (result) {
        Alert.alert(
          'Success',
          'Report sent to printer successfully!',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error printing report:', error);
      setLoading(false);
      
      Alert.alert(
        'Print Error',
        'Failed to print the report. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Generate HTML for printing
  const generatePrintableHTML = () => {
    // Build the HTML string for printing with all panel cells
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Antibody Lab Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .report-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .report-title {
              font-size: 24px;
              font-weight: bold;
            }
            .report-date {
              font-size: 14px;
              color: #666;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 10px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .patient-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .info-row {
              margin-bottom: 10px;
            }
            .info-label {
              font-weight: bold;
              display: inline-block;
              width: 130px;
            }
            .panel-title {
              font-size: 16px;
              font-weight: bold;
              margin: 15px 0 10px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 6px;
              text-align: center;
            }
            th {
              background-color: #f2f2f2;
            }
            .conclusion {
              margin-top: 20px;
              padding: 10px;
              border: 1px solid #ddd;
              background-color: #f9f9f9;
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div class="report-title">Antibody Lab Report</div>
            <div class="report-date">${reportData?.created_at ? new Date(reportData.created_at).toLocaleString() : 'N/A'}</div>
          </div>
          
          <div class="section">
            <div class="section-title">Patient Information</div>
            <div class="patient-info">
              <div class="info-row">
                <span class="info-label">Patient Name:</span>
                <span>${patientInfo?.name || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Patient ID:</span>
                <span>${patientInfo?.id || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Sample ID:</span>
                <span>${patientInfo?.sampleId || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Collection Date:</span>
                <span>${patientInfo?.drawDate || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Technician:</span>
                <span>${patientInfo?.tech || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          ${generatePanelHTML(firstPanel, 'ABScreen', ruleState?.first)}
          ${generatePanelHTML(secondPanel, 'ABID Panel', ruleState?.second)}
          
          <div class="conclusion">
            <div class="section-title">Conclusion</div>
            <p>${patientInfo?.conclusion || 'No conclusion provided.'}</p>
          </div>
          
          <div class="section">
            <div class="section-title">Notes</div>
            <p>${patientInfo?.notes || 'No notes provided.'}</p>
          </div>
        </body>
      </html>
    `;
  };

  // Helper function to generate HTML for each panel
  const generatePanelHTML = (panel, panelTitle, panelRuleState) => {
    if (!panel || !panel.cells || !panel.antigens) {
      return '';
    }
    
    // Generate header row with antigen names
    const headerRow = panel.antigens.map(antigen => 
      `<th>${antigen}</th>`
    ).join('');
    
    // Generate cell rows - showing ALL cells in the panel
    const cellRows = panel.cells.map((cell, index) => {
      const cellData = panel.antigens.map(antigen => {
        let cellValue = cell.results[antigen] || '';
        return `<td>${cellValue}</td>`;
      }).join('');
      
      return `
        <tr>
          <td>${index + 1}</td>
          ${cellData}
          <td>${cell.results['result'] || ''}</td>
        </tr>
      `;
    }).join('');
    
    // Generate ruled out antigens section
    const ruledOutAntigens = panelRuleState ? 
      Object.keys(panelRuleState)
        .filter(antigen => panelRuleState[antigen]?.isRuledOut)
        .join(', ') : 
      'None';
    
    return `
      <div class="section">
        <div class="section-title">${panelTitle}</div>
        <table>
          <thead>
            <tr>
              <th>Cell</th>
              ${headerRow}
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            ${cellRows}
          </tbody>
        </table>
        <div class="info-row">
          <span class="info-label">Ruled Out Antigens:</span>
          <span>${ruledOutAntigens}</span>
        </div>
      </div>
    `;
  };

  const handleSaveReport = async () => {
    try {
      // Show loading while saving
      setLoading(true);
      
      // Check if we have the report data to save - at least patient info and one panel
      if (!patientInfo || (!firstPanel && !secondPanel)) {
        Alert.alert(
          'Error',
          'Missing report data. Cannot save report.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
      
      console.log('Saving report with patient:', patientInfo.name);
      
      // Create a new timestamp for the saved report
      const timestamp = new Date().toISOString();
      
      // Create a case report entry in the Case Archives folder
      const caseReportId = await DatabaseService.saveCaseReport({
        patientName: patientInfo.name || 'Unknown',
        patientId: patientInfo.id || 'Unknown',
        sampleId: patientInfo.sampleId || '',
        drawDate: patientInfo.drawDate || '',
        conclusion: patientInfo.conclusion || '',
        notes: patientInfo.notes || '',
        technician: patientInfo.tech || '',
        createdAt: timestamp,
        // Include panel IDs if available from report data
        firstPanelId: reportData?.first_panel_id || null,
        secondPanelId: reportData?.second_panel_id || null,
        // Include the complete report data
        reportData: JSON.stringify({
          patientInfo,
          firstPanel,
          secondPanel,
          ruleState,
          rules
        })
      });
      
      console.log('Save result, case report ID:', caseReportId);
      setLoading(false);
      
      if (caseReportId) {
        // Show success alert with options
        Alert.alert(
          'Success',
          'Report successfully saved to Case Archives!',
          [
            { 
              text: 'View in Case Archives', 
            },
            { 
              text: 'Return to Home', 
              onPress: () => navigation.navigate('Home')
            }
          ]
        );
      } else {
        throw new Error('Failed to save report');
      }
    } catch (error) {
      console.error('Error saving report:', error);
      setLoading(false);
      
      Alert.alert(
        'Error',
        'Failed to save report to Case Archives. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleCellPress = (cellIndex: number, antigenId: string) => {
    console.log(`Cell pressed: ${cellIndex}, Antigen: ${antigenId}`);
    // Handle cell press logic
  };

  const handleResultPress = (cellIndex: number) => {
    console.log(`Result cell pressed: ${cellIndex}`);
    // Handle result press logic
  };

  // Render the Save Report button conditionally based on source
  const renderSaveReportButton = () => {
    // Only show Save Report button if coming from AntibodyLab
    console.log('Source in renderSaveReportButton:', source);
    if (source === 'antibodyLab') {
      return (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleSaveReport}
        >
          <Text style={styles.closeButtonText}>Save Report</Text>
        </TouchableOpacity>
      );
    }
    return null; // Don't render the button if coming from FileList
  };

  // Content based on active tab
  const renderTabContent = () => {
    if (loading) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Loading report...</Text>
        </SafeAreaView>
      );
    }

    return (
      <ScrollView style={styles.contentContainer}>
        <View style={styles.reportHeader}>
          <Text style={styles.reportTitle}>Antibody Lab Report</Text>
          <Text style={styles.reportDate}>
            {reportData?.created_at ? format(new Date(reportData.created_at), 'MMM dd, yyyy • h:mm a') : 'N/A'}
          </Text>
        </View>
        
        <View style={styles.patientInfoSection}>
          <Text style={styles.sectionTitle}>Patient Information</Text>
          
          <View style={styles.patientInfoRow}>
            <View style={styles.patientInfoItem}>
              <Text style={styles.patientInfoLabel}>Patient Name:</Text>
              <Text style={styles.patientInfoValue}>{patientInfo?.name || 'N/A'}</Text>
            </View>
            
            <View style={styles.patientInfoItem}>
              <Text style={styles.patientInfoLabel}>Patient ID:</Text>
              <Text style={styles.patientInfoValue}>{patientInfo?.id || 'N/A'}</Text>
            </View>
          </View>
          
          <View style={styles.patientInfoRow}>
            <View style={styles.patientInfoItem}>
              <Text style={styles.patientInfoLabel}>Sample ID:</Text>
              <Text style={styles.patientInfoValue}>{patientInfo?.sampleId || 'N/A'}</Text>
            </View>
            
            <View style={styles.patientInfoItem}>
              <Text style={styles.patientInfoLabel}>Collection Date:</Text>
              <Text style={styles.patientInfoValue}>{patientInfo?.drawDate || 'N/A'}</Text>
            </View>
          </View>
          
          <View style={styles.patientInfoRow}>
            <View style={styles.patientInfoFull}>
              <Text style={styles.patientInfoLabel}>Conclusion:</Text>
              <Text style={styles.patientInfoValue}>{patientInfo?.conclusion || 'N/A'}</Text>
            </View>
          </View>
          
          <View style={styles.patientInfoRow}>
            <View style={styles.patientInfoFull}>
              <Text style={styles.patientInfoLabel}>Notes:</Text>
              <Text style={styles.patientInfoValue}>{patientInfo?.notes || 'N/A'}</Text>
            </View>
          </View>
          
          <View style={styles.patientInfoRow}>
            <View style={styles.patientInfoFull}>
              <Text style={styles.patientInfoLabel}>Technician:</Text>
              <Text style={styles.patientInfoValue}>{patientInfo?.tech || 'N/A'}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.analysisSection}>
          <Text style={styles.sectionTitle}>Analysis Results</Text>
          
          {firstPanel && (
            <>
              <Text style={styles.panelTitle}>ABScreen</Text>
              <AnalysisTable
                panel={firstPanel}
                rules={rules}
                ruledOutAntigens={Object.keys(ruleState?.first || {}).filter(
                  antigen => ruleState?.first[antigen]?.isRuledOut
                )}
                showPatternSummary={true}
              />
            </>
          )}
          
          {secondPanel && (
            <>
              <Text style={styles.panelTitle}>ABID Panel</Text>
              <AnalysisTable
                panel={secondPanel}
                rules={rules}
                ruledOutAntigens={Object.keys(ruleState?.second || {}).filter(
                  antigen => ruleState?.second[antigen]?.isRuledOut
                )}
                showPatternSummary={true}
              />
            </>
          )}
        </View>
      </ScrollView>
    );
  };

  const handleTabPress = (tab: 'Screen & Panel' | 'Select Cells & Lot info') => {
    setActiveTab(tab);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Icon name="arrow-left" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Tab Selection */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'Screen & Panel' ? styles.activeTabButton : {}
          ]}
          onPress={() => handleTabPress('Screen & Panel')}
        >
          <Text style={[
            styles.tabButtonText,
            activeTab === 'Screen & Panel' ? styles.activeTabButtonText : {}
          ]}>Screen & Panel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'Select Cells & Lot info' ? styles.activeTabButton : {}
          ]}
          onPress={() => handleTabPress('Select Cells & Lot info')}
        >
          <Text style={[
            styles.tabButtonText,
            activeTab === 'Select Cells & Lot info' ? styles.activeTabButtonText : {}
          ]}>Select Cells & Lot info</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.contentScrollView}
        contentContainerStyle={styles.scrollViewContent}
        horizontal={false}
        showsHorizontalScrollIndicator={false}
      >
        {renderTabContent()}
      </ScrollView>
        
      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.printButton}
            onPress={handlePrintReport}
          >
            <Text style={styles.printButtonText}>Print Report</Text>
          </TouchableOpacity>
          {renderSaveReportButton()}
        </View>
      </View>
    </SafeAreaView>
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    marginLeft: 8,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 30,
    overflow: 'hidden',
    marginHorizontal: 15,
    marginVertical: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  activeTabButton: {
    backgroundColor: COLORS.SECONDARY,
  },
  tabButtonText: {
    fontSize: 16,
    color: '#333',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  activeTabButtonText: {
    color: '#fff',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  contentScrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  contentContainer: {
    flex: 1,
    padding: 15,
  },
  patientInfoContainer: {
    padding: 15,
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 15,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  patientInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  patientInfoItem: {
    flex: 1,
    marginRight: 10,
  },
  patientInfoFull: {
    flex: 1,
  },
  patientInfoLabel: {
    fontWeight: 'bold',
    color: '#333',
    marginRight: 5,
    width: 130,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  patientInfoValue: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 2,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  panelSectionContainer: {
    marginHorizontal: 10,
    marginBottom: 10,
    width: SCREEN_WIDTH - 20,
    alignSelf: 'center',
  },
  panelSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    fontFamily: FONTS.POPPINS_BOLD,
    marginLeft: 15,
  },
  actionButtonsContainer: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  printButton: {
    backgroundColor: COLORS.SECONDARY,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  selectCellsContainer: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  // New styles for Select Cells & Lot info tab
  selectCellsTableSection: {
    marginVertical: 15,
    marginHorizontal: 5,
  },
  selectCellsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
    fontFamily: FONTS.POPPINS_BOLD,
  },
  panelDetailsContainer: {
    marginHorizontal: 15,
    marginVertical: 10,
  },
  panelDetailsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
    fontFamily: FONTS.POPPINS_BOLD,
  },
  panelDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  panelDetailsColumn: {
    flex: 1,
    marginRight: 15,
  },
  panelDetailsColumnTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
    fontFamily: FONTS.POPPINS_BOLD,
  },
  lotInfoContainer: {
    marginBottom: 15,
  },
  lotInfoField: {
    marginBottom: 4,
  },
  lotInfoLabel: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  lotInfoValue: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 2,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  tableScrollContainer: {
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 10,
  },
  horizontalScroll: {
    flexGrow: 0,
  },
  horizontalScrollContent: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  landscapeTableContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#fff',
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  reportHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  reportDate: {
    fontSize: 14,
    color: '#666',
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  patientInfoSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  analysisSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
});

export default CaseArchiveViewScreen;