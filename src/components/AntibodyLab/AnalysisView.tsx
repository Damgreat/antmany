import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { AnalysisTable } from '../Analysis/AnalysisTable';
import { PanelData, RuleResult, AntigenRuleState } from '../../types';
import { FONTS, COLORS } from '../../constants/fonts';

interface AnalysisViewProps {
  firstPanel: PanelData | null;
  secondPanel: PanelData | null;
  additionalPanels: PanelData[]; // Array of additional ABID panels
  testType: 'Gel' | 'Tube';
  rules: RuleResult[];
  ruleState: {
    first: AntigenRuleState;
    second: AntigenRuleState;
    combined: AntigenRuleState;
  };
  onClose: () => void;
  validatePanelData: (panelData: any) => { isValid: boolean; message: string };
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  firstPanel,
  secondPanel,
  additionalPanels,
  testType,
  rules,
  ruleState,
  onClose,
  validatePanelData
}) => {
  // Count the total number of panels
  const totalPanels = (firstPanel ? 1 : 0) + 
                      (secondPanel ? 1 : 0) + 
                      additionalPanels.length;

  return (
    <View style={styles.analysisScreenContainer}>
      <ScrollView style={styles.analysisScrollView}>
        <View style={styles.analysisContainer}>
          <View style={styles.traceVueHeader}>
            <Image
              source={require('../../../assets/images/tracevue-icon.png')}
              style={styles.traceVueIcon}
            />
          </View>
          
          {/* Test Type Indicator */}
          <View style={styles.testTypeContainer}>
            <Text style={styles.testTypeLabel}>
              Test Type: <Text style={styles.testTypeValue}>{testType}</Text>
            </Text>
          </View>
          
          {/* Display panel count */}
          <View style={styles.panelCountContainer}>
            <Text style={styles.panelCountText}>
              Analyzing {totalPanels} panel{totalPanels !== 1 ? 's' : ''}
            </Text>
          </View>
          
          {/* Only show ABScreen section if firstPanel is available */}
          {firstPanel && (
            <>
              <Text style={styles.analysisSectionTitle}>
                {firstPanel.metadata?.testName || 'ABScreen'} - Lot {firstPanel.metadata?.lotNumber || 'Unknown'}
              </Text>
              <AnalysisTable
                panel={firstPanel}
                rules={rules}
                ruledOutAntigens={Object.keys(ruleState.first).filter(
                  antigen => ruleState.first[antigen]?.isRuledOut
                )}
                showPatternSummary={false}
              />
            </>
          )}

          {/* Only show ABID section if secondPanel is available */}
          {secondPanel && validatePanelData(secondPanel).isValid && (
            <>
              <Text style={styles.analysisSectionTitle}>
                {secondPanel.metadata?.testName || 'ABID Panel 1'} - Lot {secondPanel.metadata?.lotNumber || 'Unknown'}
              </Text>
              <AnalysisTable
                panel={secondPanel}
                rules={rules}
                ruledOutAntigens={Object.keys(ruleState.second).filter(
                  antigen => ruleState.second[antigen]?.isRuledOut
                )}
                showPatternSummary={false}
              />
            </>
          )}
          
          {/* Show additional ABID panels if available */}
          {additionalPanels.length > 0 && additionalPanels.map((panel, index) => {
            // Skip invalid panels
            if (!panel || !validatePanelData(panel).isValid) return null;
            
            return (
              <React.Fragment key={`additional-panel-analysis-${index}`}>
                <Text style={styles.analysisSectionTitle}>
                  {panel.metadata?.testName || `ABID Panel ${index + 2}`} - Lot {panel.metadata?.lotNumber || 'Unknown'}
                </Text>
                <AnalysisTable
                  panel={panel}
                  rules={rules}
                  ruledOutAntigens={Object.keys(ruleState.second).filter(
                    antigen => ruleState.second[antigen]?.isRuledOut
                  )}
                  showPatternSummary={false}
                />
              </React.Fragment>
            );
          })}
          
          {/* Combined Analysis section - shows when multiple panels are present */}
          {totalPanels > 1 && (
            <>
              <Text style={[styles.analysisSectionTitle, styles.combinedTitle]}>
                Combined Analysis
              </Text>
              <View style={styles.combinedAnalysisContainer}>
                <Text style={styles.combinedAnalysisText}>
                  Ruled Out Antigens:
                </Text>
                <View style={styles.ruledOutAntigensList}>
                  {Object.keys(ruleState.combined)
                    .filter(antigen => ruleState.combined[antigen]?.isRuledOut)
                    .map((antigen, idx) => (
                      <View key={`ruled-out-${idx}`} style={styles.ruledOutAntigenItem}>
                        <Text style={styles.ruledOutAntigenText}>{antigen}</Text>
                      </View>
                    ))
                  }
                  {Object.keys(ruleState.combined).filter(antigen => 
                    ruleState.combined[antigen]?.isRuledOut).length === 0 && (
                      <Text style={styles.noRuledOutText}>No antigens ruled out in combined analysis</Text>
                    )}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.traceVueContainer}>
        <TouchableOpacity
          style={styles.traceVueButton}
          onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  analysisScreenContainer: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  analysisScrollView: {
    flex: 1,
  },
  analysisContainer: {
    padding: 8,
    gap: 8,
  },
  traceVueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  traceVueIcon: {
    width: 150,
    height: 80,
    resizeMode: 'contain',
  },
  testTypeContainer: {
    backgroundColor: '#E8EAEA',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
    alignSelf: 'center',
  },
  testTypeLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  testTypeValue: {
    color: '#336699',
    fontWeight: 'bold',
  },
  panelCountContainer: {
    marginBottom: 15,
    alignItems: 'center',
  },
  panelCountText: {
    fontSize: 16,
    color: '#555',
    fontStyle: 'italic',
  },
  analysisSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    marginTop: 15,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  combinedTitle: {
    color: '#5d8aa8',
    fontSize: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#5d8aa8',
    paddingBottom: 8,
    marginTop: 25,
  },
  combinedAnalysisContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  combinedAnalysisText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  ruledOutAntigensList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ruledOutAntigenItem: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ruledOutAntigenText: {
    color: '#721c24',
    fontWeight: '500',
  },
  noRuledOutText: {
    color: '#555',
    fontStyle: 'italic',
  },
  traceVueContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  traceVueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5d8aa8',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 40,
    minWidth: 180,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
});