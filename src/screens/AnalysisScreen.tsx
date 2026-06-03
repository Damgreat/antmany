import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, Card, DataTable, Divider, Button, useTheme, IconButton } from 'react-native-paper';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Analysis'>;
  route: RouteProp<RootStackParamList, 'Analysis'>;
};

const AnalysisScreen: React.FC<Props> = ({ route }) => {
  const theme = useTheme();
  const { panels, rules, ruleState } = route.params;
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const renderPanelMetadata = (panelKey: 'first' | 'second') => {
    const panel = panels[panelKey];
    const headerTitle = panelKey === 'first' ? 'Screen Panel' : `Panel ${panel.metadata.panelType}`;

    return (
      <Card style={styles.card}>
        <Card.Title
          title={headerTitle}
          titleStyle={styles.cardTitle}
          right={(props) => (
            <IconButton
              {...props}
              icon={expandedSections.includes(`metadata-${panelKey}`) ? 'chevron-up' : 'chevron-down'}
              onPress={() => toggleSection(`metadata-${panelKey}`)}
            />
          )}
        />
        {expandedSections.includes(`metadata-${panelKey}`) && (
          <Card.Content>
            <DataTable>
              <DataTable.Row>
                <DataTable.Cell>Manufacturer</DataTable.Cell>
                <DataTable.Cell>{panel.metadata.manufacturer}</DataTable.Cell>
              </DataTable.Row>
              <DataTable.Row>
                <DataTable.Cell>Lot Number</DataTable.Cell>
                <DataTable.Cell>{panel.metadata.lotNumber}</DataTable.Cell>
              </DataTable.Row>
              <DataTable.Row>
                <DataTable.Cell>Expiration Date</DataTable.Cell>
                <DataTable.Cell>{panel.metadata.expirationDate}</DataTable.Cell>
              </DataTable.Row>
              <DataTable.Row>
                <DataTable.Cell>Test Name</DataTable.Cell>
                <DataTable.Cell>{panel.metadata.testName}</DataTable.Cell>
              </DataTable.Row>
            </DataTable>
          </Card.Content>
        )}
      </Card>
    );
  };

  const renderRuleAnalysis = (panelKey: 'first' | 'second') => {
    const panel = panels[panelKey];
    const currentRules = rules[panelKey];
    const currentRuleState = ruleState[panelKey];

    const ruledOutCount = Object.values(currentRuleState).filter(state => state.isRuledOut).length;
    const activeCount = panel.antigens.length - ruledOutCount;

    return (
      <Card style={styles.card}>
        <Card.Title
          title="Rule Analysis"
          titleStyle={styles.cardTitle}
          subtitle={`${activeCount} Active / ${ruledOutCount} Ruled Out`}
          right={(props) => (
            <IconButton
              {...props}
              icon={expandedSections.includes(`rules-${panelKey}`) ? 'chevron-up' : 'chevron-down'}
              onPress={() => toggleSection(`rules-${panelKey}`)}
            />
          )}
        />
        {expandedSections.includes(`rules-${panelKey}`) && (
          <Card.Content>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Antigen</DataTable.Title>
                <DataTable.Title>Status</DataTable.Title>
                <DataTable.Title>Rule Type</DataTable.Title>
                <DataTable.Title numeric>Supporting Cells</DataTable.Title>
              </DataTable.Header>

              {panel.antigens.map((antigen, index) => {
                const state = currentRuleState[antigen];
                const rule = currentRules.find(r => r.antigen === antigen);

                return (
                  <DataTable.Row key={index}>
                    <DataTable.Cell>{antigen}</DataTable.Cell>
                    <DataTable.Cell>
                      <Text style={{
                        color: state?.isRuledOut ? theme.colors.error : theme.colors.primary
                      }}>
                        {state?.isRuledOut ? 'Ruled Out' : 'Active'}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {rule?.type || '-'}
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      {state?.cells.length || 0}
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>
          </Card.Content>
        )}
      </Card>
    );
  };

  const renderReactionPatterns = (panelKey: 'first' | 'second') => {
    const panel = panels[panelKey];

    return (
      <Card style={styles.card}>
        <Card.Title
          title="Reaction Patterns"
          titleStyle={styles.cardTitle}
          right={(props) => (
            <IconButton
              {...props}
              icon={expandedSections.includes(`patterns-${panelKey}`) ? 'chevron-up' : 'chevron-down'}
              onPress={() => toggleSection(`patterns-${panelKey}`)}
            />
          )}
        />
        {expandedSections.includes(`patterns-${panelKey}`) && (
          <Card.Content>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Cell</DataTable.Title>
                <DataTable.Title>Donor</DataTable.Title>
                <DataTable.Title>Result</DataTable.Title>
                <DataTable.Title>Positive Antigens</DataTable.Title>
              </DataTable.Header>

              {panel.cells.map((cell, index) => {
                const positiveAntigens = panel.antigens.filter(
                  antigen => cell.results[antigen] === '+'
                );

                return (
                  <DataTable.Row key={index}>
                    <DataTable.Cell>{cell.cellId}</DataTable.Cell>
                    <DataTable.Cell>{cell.donorNumber}</DataTable.Cell>
                    <DataTable.Cell>
                      <Text style={{
                        color: cell.results['result'] === '+'
                          ? theme.colors.error
                          : cell.results['result'] === '0'
                            ? theme.colors.primary
                            : theme.colors.onSurface
                      }}>
                        {cell.results['result'] || '-'}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {positiveAntigens.join(', ') || '-'}
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>
          </Card.Content>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Screen Panel Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            Screen Panel Analysis
          </Text>
          {renderPanelMetadata('first')}
          {renderRuleAnalysis('first')}
          {renderReactionPatterns('first')}
        </View>

        <Divider style={styles.divider} />

        {/* ID Panel Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            ID Panel Analysis
          </Text>
          {renderPanelMetadata('second')}
          {renderRuleAnalysis('second')}
          {renderReactionPatterns('second')}
        </View>

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={() => {/* Add print functionality */ }}
            icon="printer"
            style={styles.actionButton}
          >
            Print Report
          </Button>
          <Button
            mode="outlined"
            onPress={() => {/* Add save functionality */ }}
            icon="content-save"
            style={styles.actionButton}
          >
            Save Report
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        fontWeight: '600',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  card: {
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardTitle: {
    fontSize: 16,
    ...Platform.select({
      ios: {
        fontWeight: '600',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  divider: {
    marginVertical: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
  },
  actionButton: {
    minWidth: 150,
  },
});

export default AnalysisScreen;