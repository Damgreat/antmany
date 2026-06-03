import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, DataTable } from 'react-native-paper';
import { PanelData, RuleResult } from '../../types';

interface AnalysisTableProps {
  panel: PanelData;
  rules: RuleResult[];
  ruledOutAntigens: string[];
  showPatternSummary?: boolean;
}

// Helper type for pattern summary data
export interface PatternSummaryItem {
  antigen: string;
  positiveCount: number;
}

export const AnalysisTable: React.FC<AnalysisTableProps> = ({
  panel,
  ruledOutAntigens,
  showPatternSummary = true
}) => {
  // Get remaining antigens (not ruled out)
  const remainingAntigens = panel.antigens.filter(
    antigen => !ruledOutAntigens.includes(antigen)
  );

  // Get cells with result '+'
  const positiveCells = panel.cells.filter(
    cell => cell.results['result'] === '+'
  );

  // Create pattern summary data
  const patternSummaryData: PatternSummaryItem[] = remainingAntigens
    .map(antigen => {
      const positiveCount = positiveCells.filter(
        cell => cell.results[antigen] === '+'
      ).length;
      return { antigen, positiveCount };
    })
    .filter(item => item.positiveCount > 0)
    .sort((a, b) => b.positiveCount - a.positiveCount); // Sort by positiveCount in descending order

  return (
    <View style={styles.container}>
      <ScrollView horizontal>
        <View>
          <DataTable>
            {/* Header Row */}
            <DataTable.Header>
              {/* <DataTable.Title style={styles.cellColumn}>Cell</DataTable.Title> */}
              {remainingAntigens.map((antigen, index) => (
                <DataTable.Title
                  key={index}
                  style={styles.antigenColumn}
                >
                  {antigen}
                </DataTable.Title>
              ))}
              <DataTable.Title style={styles.resultColumn}>Result</DataTable.Title>
            </DataTable.Header>

            {/* Data Rows */}
            {panel.cells.map((cell, index) => (
              <DataTable.Row key={index}>
                {/* <DataTable.Cell style={styles.cellColumn}>
                  <Text>{cell.cellId}</Text>
                  <Text style={styles.donorNumber}>{cell.donorNumber}</Text>
                </DataTable.Cell> */}

                {remainingAntigens.map((antigen, index) => {
                  const value = cell.results[antigen];
                  const isHighlighted = value === '+' && cell.results['result'] === '+';

                  return (
                    <DataTable.Cell
                      key={index}
                      style={[
                        styles.antigenColumn,
                        isHighlighted && styles.highlightedCell
                      ]}
                    >
                      <Text style={isHighlighted && styles.highlightedText}>
                        {value || ''}
                      </Text>
                    </DataTable.Cell>
                  );
                })}

                <DataTable.Cell style={styles.resultColumn}>
                  <Text style={cell.results['result'] === '+' ? styles.positiveResult : styles.negativeResult}>
                    {cell.results['result'] || ''}
                  </Text>
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>

          {/* Summary Section - Only show if showPatternSummary is true */}
          {showPatternSummary && positiveCells.length > 0 && (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Pattern Summary:</Text>
              {patternSummaryData.map((item, index) => (
                <Text key={index} style={styles.summaryText}>
                  {item.antigen}: {item.positiveCount} positive reactions
                </Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  cellColumn: {
    width: 80,
  },
  antigenColumn: {
    width: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultColumn: {
    width: 60,
    alignContent: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donorNumber: {
    fontSize: 12,
    color: '#666',
  },
  highlightedCell: {
    backgroundColor: '#e3f2fd',
  },
  highlightedText: {
    fontWeight: 'bold',
    color: '#2196f3',
  },
  positiveResult: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  negativeResult: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  summary: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    marginBottom: 4,
  }
});