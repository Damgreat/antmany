import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { PanelGrid } from '../PanelGrid';
import { PanelData, RuleResult, AntigenRuleState } from '../../types';
import { StyleProp, ViewStyle } from 'react-native';

interface ScreenIdTabProps {
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
  zoomLevel: number;
  handlePanelResultPress: (panelType: 'first' | 'second' | 'additional', panelIndex: number, cellIndex: number) => void;
  handleAntigenOverride: (antigen: string) => void;
  validatePanelData: (panelData: any) => { isValid: boolean; message: string };
  getPanelContainerStyle: () => StyleProp<ViewStyle>;
}

export const ScreenIdTab: React.FC<ScreenIdTabProps> = ({
  firstPanel,
  secondPanel,
  additionalPanels,
  testType,
  rules,
  ruleState,
  zoomLevel,
  handlePanelResultPress,
  handleAntigenOverride,
  validatePanelData,
  getPanelContainerStyle,
}) => {
  if (!firstPanel && !secondPanel && additionalPanels.length === 0) {
    return (
      <View style={styles.noPanelContainer}>
        <Text style={styles.noPanelText}>
          Loading Panel Data...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.scrollContainer}
      showsVerticalScrollIndicator={true}
    >
      {/* Test Type Indicator */}
      <View style={styles.testTypeContainer}>
        <Text style={styles.testTypeText}>
          Test Type: <Text style={styles.testTypeValue}>{testType}</Text>
        </Text>
      </View>

      {/* Show ABScreen panel only if firstPanel is available */}
      {firstPanel && (
        <View style={styles.panelSectionContainer}>
          <Text style={styles.panelSectionTitle}>
            {firstPanel.metadata?.testName || 'ABScreen Panel'} - Lot {firstPanel.metadata?.lotNumber || 'Unknown'}
          </Text>
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={true}
            style={styles.tableScrollContainer}
            contentContainerStyle={styles.horizontalScrollContent}
            alwaysBounceHorizontal={true}
          >
            <View style={getPanelContainerStyle()}>
              <PanelGrid
                panel={firstPanel}
                rules={rules}
                ruleState={ruleState.first}
                combinedRuleState={ruleState.combined}
                additionalCellCount={3}
                editable={true}
                onCellPress={() => {}}
                onResultPress={(cellIndex) => handlePanelResultPress('first', 0, cellIndex)}
                onAntigenOverride={handleAntigenOverride}
                zoomLevel={zoomLevel}
                testingMethod={testType}
              />
            </View>
          </ScrollView>
        </View>
      )}
      
      {/* Show ABID panel only if secondPanel is available */}
      {secondPanel && validatePanelData(secondPanel).isValid && (
        <View style={styles.panelSectionContainer}>
          <Text style={styles.panelSectionTitle}>
            {secondPanel.metadata?.testName || 'ABID Panel 1'} - Lot {secondPanel.metadata?.lotNumber || 'Unknown'}
          </Text>
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={true}
            style={styles.tableScrollContainer}
            contentContainerStyle={styles.horizontalScrollContent}
            alwaysBounceHorizontal={true}
          >
            <View style={getPanelContainerStyle()}>
              <PanelGrid
                panel={secondPanel}
                rules={rules}
                ruleState={ruleState.second}
                combinedRuleState={ruleState.combined}
                additionalCellCount={3}
                editable={true}
                onCellPress={() => {}}
                onResultPress={(cellIndex) => handlePanelResultPress('second', 0, cellIndex)}
                onAntigenOverride={handleAntigenOverride}
                zoomLevel={zoomLevel}
                testingMethod={testType}
              />
            </View>
          </ScrollView>
        </View>
      )}

      {/* Show additional ABID panels if available */}
      {additionalPanels.length > 0 && additionalPanels.map((panel, index) => {
        // Skip invalid panels
        if (!panel || !validatePanelData(panel).isValid) return null;
        
        return (
          <View key={`additional-panel-${index}`} style={styles.panelSectionContainer}>
            <Text style={styles.panelSectionTitle}>
              {panel.metadata?.testName || `ABID Panel ${index + 2}`} - Lot {panel.metadata?.lotNumber || 'Unknown'}
            </Text>
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={true}
              style={styles.tableScrollContainer}
              contentContainerStyle={styles.horizontalScrollContent}
              alwaysBounceHorizontal={true}
            >
              <View style={getPanelContainerStyle()}>
                <PanelGrid
                  panel={panel}
                  rules={rules}
                  ruleState={ruleState.second} // Using the same rule state as the second panel
                  combinedRuleState={ruleState.combined}
                  additionalCellCount={3}
                  editable={true}
                  onCellPress={() => {}}
                  onResultPress={(cellIndex) => handlePanelResultPress('additional', index, cellIndex)}
                  onAntigenOverride={handleAntigenOverride}
                  zoomLevel={zoomLevel}
                  testingMethod={testType}
                />
              </View>
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    padding: 10,
    alignContent: 'center',
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
  testTypeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  testTypeValue: {
    color: '#336699',
    fontWeight: 'bold',
  },
  panelSectionContainer: {
    marginBottom: 15,
    alignItems: 'center',
  },
  panelSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  tableScrollContainer: {
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 10,
  },
  horizontalScrollContent: {
    padding: 10,
  },
  noPanelContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noPanelText: {
    color: '#5d8aa8',
    fontSize: 16,
    marginBottom: 20,
  },
});