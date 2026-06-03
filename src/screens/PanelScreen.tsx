import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Button, FAB, Portal, Dialog, Text, SegmentedButtons } from 'react-native-paper';
import { PanelGrid } from '../components/PanelGrid';
import {
  PanelData,
  RuleResult,
  ResultValue,
  AntigenRuleState,
} from '../types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import { AnalysisButton } from '../components/Analysis/AnalysisButton';
import { AnalysisTable } from '../components/Analysis/AnalysisTable';
import RNFS from 'react-native-fs';
import {
  calculateAntigenScore,
  shouldRuleOutAntigen,
  SPECIAL_ANTIGENS
} from '../utils/ruleOutUtils';

interface LinkedRuleState {
  first: AntigenRuleState;
  second: AntigenRuleState;
  combined: AntigenRuleState;
}

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Panel'>;
  route: RouteProp<RootStackParamList, 'Panel'>;
};

const PanelScreen: React.FC<Props> = ({ route, navigation }) => {
  const { firstPanel, secondPanel } = route.params.panelData;
  const [panels, setPanels] = useState({
    first: firstPanel,
    second: secondPanel
  });
  const [rules, setRules] = useState<{
    first: RuleResult[];
    second: RuleResult[];
  }>({ first: [], second: [] });
  const [ruleState, setRuleState] = useState<LinkedRuleState>({
    first: {},
    second: {},
    combined: {}
  });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [viewMode, setViewMode] = useState('combined');
  const [activePanel, setActivePanel] = useState<'first' | 'second'>('first');

  const firstScrollRef = useRef<ScrollView>(null);
  const secondScrollRef = useRef<ScrollView>(null);
  const isManualScroll = useRef<boolean>(false);
  const scrollPosition = useRef<number>(0);
  useEffect(() => {
    processRules();
  }, [panels]);

  const processRules = () => {
    const newRuleState: LinkedRuleState = {
      first: calculatePanelRuleState(panels.first, {}),
      second: {},
      combined: {}
    };

    // Process second panel with knowledge of first panel's rules
    newRuleState.second = calculatePanelRuleState(panels.second, newRuleState.first);

    // Combine rules from both panels
    newRuleState.combined = combinePanelRules(newRuleState.first, newRuleState.second);

    setRuleState(newRuleState);
    generateRules('first', newRuleState.first);
    generateRules('second', newRuleState.second);
  };

  const calculatePanelRuleState = (
    panel: PanelData,
    previousRuleState: AntigenRuleState
  ): AntigenRuleState => {
    const newRuleState: AntigenRuleState = {};

    panel.antigens.forEach(antigen => {
      const score = calculateAntigenScore(panel.cells, antigen);
      const isSpecialAntigen = SPECIAL_ANTIGENS.includes(antigen);
      const currentState = previousRuleState[antigen];

      // Determine if the antigen should be ruled out
      const shouldRuleOut = shouldRuleOutAntigen(
        antigen,
        score,
        newRuleState,
      );

      newRuleState[antigen] = {
        isRuledOut: shouldRuleOut || currentState?.isRuledOut || false,
        overridden: currentState?.overridden || null,
        heterozygousCount: score.heterozygousCount,
        homozygousCount: score.homozygousCount,
        manualOverride: currentState?.manualOverride || false,
        cells: score.supportingCells,
        score: score.totalScore,
        isSpecialAntigen
      };
    });

    return newRuleState;
  };

  const combinePanelRules = (
    firstState: AntigenRuleState,
    secondState: AntigenRuleState
  ): AntigenRuleState => {
    const combinedState: AntigenRuleState = {};
    const allAntigens = new Set([
      ...Object.keys(firstState),
      ...Object.keys(secondState)
    ]);

    allAntigens.forEach(antigen => {
      const first = firstState[antigen];
      const second = secondState[antigen];

      if (first && second) {
        combinedState[antigen] = {
          isRuledOut: first.isRuledOut || second.isRuledOut,
          overridden: first.overridden || second.overridden,
          heterozygousCount: first.heterozygousCount + second.heterozygousCount,
          homozygousCount: first.homozygousCount + second.homozygousCount,
          manualOverride: first.manualOverride || second.manualOverride,
          cells: [...first.cells, ...second.cells],
          score: first.score + second.score,
          isSpecialAntigen: first.isSpecialAntigen
        };
      } else {
        combinedState[antigen] = first || second;
      }
    });

    return combinedState;
  };

  const generateRules = (panelKey: 'first' | 'second', state: AntigenRuleState) => {
    const newRules: RuleResult[] = [];

    Object.entries(state).forEach(([antigen, data]) => {
      // Handle homozygous rules
      if (data.homozygousCount > 0) {
        newRules.push({
          type: 'homozygous',
          antigen: antigen,
          confidence: 1,
          cells: data.cells,
          indicator: 'X'
        });
      }

      // Handle heterozygous special cases (K, C, E)
      if (SPECIAL_ANTIGENS.includes(antigen)) {
        const requiredCount = antigen === 'K' ? 1 : 2;
        if (data.heterozygousCount >= requiredCount) {
          // For C/E, check if D is not ruled out
          if (antigen === 'K' || !state['D']?.isRuledOut) {
            newRules.push({
              type: 'heterozygous',
              antigen: antigen,
              confidence: data.heterozygousCount / requiredCount,
              cells: data.cells,
              indicator: 'slash'
            });
          }
        }
      }
    });

    setRules(prev => ({
      ...prev,
      [panelKey]: newRules
    }));
  };
  const handleCellPress = (
    panelKey: 'first' | 'second',
    index: number,
    antigenId: string
  ) => {
    setPanels(prev => {
      const updatedPanels = { ...prev };
      const panel = updatedPanels[panelKey];
      const cell = panel.cells[index];

      if (cell) {
        const currentResult = cell.results[antigenId];
        let newValue: ResultValue;

        // Cycle through possible values
        switch (currentResult) {
          case '0': newValue = '+'; break;
          case '+': newValue = '/'; break;
          case '/': newValue = '+s'; break;
          default: newValue = '0';
        }

        cell.results[antigenId] = newValue;
      }

      return updatedPanels;
    });
  };

  const handleResultPress = (
    panelKey: 'first' | 'second',
    index: number
  ) => {
    setPanels(prev => {
      const updatedPanels = { ...prev };
      const panel = updatedPanels[panelKey];
      const cell = panel.cells[index];

      if (cell) {
        const currentResult = cell.results['result'] || '';
        let newValue: ResultValue;

        // Only allow + and 0 for result column
        switch (currentResult) {
          case '': newValue = '+'; break;
          case '+': newValue = '0'; break;
          default: newValue = '';
        }

        cell.results['result'] = newValue;
      }

      return updatedPanels;
    });
  };

  const handleAntigenOverride = (
    panelKey: 'first' | 'second',
    antigen: string
  ) => {
    if (!SPECIAL_ANTIGENS.includes(antigen)) return;

    setRuleState(prev => {
      const newState = { ...prev };
      const panelState = { ...newState[panelKey] }; // Deep clone the panel state
      newState[panelKey] = panelState;

      if (antigen in panelState) {
        // Deep clone the antigen state
        const antigenState = {
          ...panelState[antigen],
          manualOverride: !panelState[antigen].manualOverride
        };
        panelState[antigen] = antigenState;

        // When toggling manual override
        if (antigenState.manualOverride) {
          // If we're turning on manual override, toggle the ruled out state
          antigenState.isRuledOut = !antigenState.isRuledOut;
        } else {
          // When removing manual override, recalculate rule-out status
          const score = calculateAntigenScore(panels[panelKey].cells, antigen);
          antigenState.isRuledOut = shouldRuleOutAntigen(antigen, score, panelState);
        }

        // For C and E, check D rule-out status
        if (['C', 'E'].includes(antigen)) {
          const isDRuledOut = panelState['D']?.isRuledOut;
          if (isDRuledOut) {
            antigenState.isRuledOut = false;
          }
        }

        // Immediately update the combined state
        newState.combined = combinePanelRules(
          panelKey === 'first' ? panelState : prev.first,
          panelKey === 'second' ? panelState : prev.second
        );
      }

      console.log('Updated rule state:', {
        antigen,
        panelKey,
        state: panelState[antigen]
      });

      return newState;
    });
  };

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
    isFirstPanel: boolean
  ) => {
    if (!isManualScroll.current) return;

    const offsetX = event.nativeEvent.contentOffset.x;
    scrollPosition.current = offsetX;

    try {
      isManualScroll.current = false;
      if (isFirstPanel) {
        secondScrollRef.current?.scrollTo({ x: offsetX, animated: false });
      } else {
        firstScrollRef.current?.scrollTo({ x: offsetX, animated: false });
      }
    } finally {
      setTimeout(() => {
        isManualScroll.current = true;
      }, 0);
    }
  };

  const handleScrollBeginDrag = () => {
    isManualScroll.current = true;
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const timestamp = Date.now();

      // Save panels with metadata
      const firstPanelData = {
        ...panels.first,
        rules: rules.first,
        ruleState: ruleState.first,
      };

      const secondPanelData = {
        ...panels.second,
        rules: rules.second,
        ruleState: ruleState.second,
      };

      // Save first panel
      let filePath = `${RNFS.ExternalStorageDirectoryPath}/${timestamp}_Screen.json`;
      await RNFS.writeFile(filePath, JSON.stringify(firstPanelData), 'utf8');

      // Save second panel
      filePath = `${RNFS.ExternalStorageDirectoryPath}/${timestamp}_Panel.json`;
      await RNFS.writeFile(filePath, JSON.stringify(secondPanelData), 'utf8');

      setShowSaveDialog(false);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving panels:', error);
    } finally {
      setLoading(false);
    }
  };
  const renderPanelGrids = () => {
    if (viewMode === 'combined') {
      return (
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.combinedContainer}>
            {/* First Panel */}
            <View style={styles.panelWrapper}>
              <Text style={styles.panelTitle}>
                Screen
              </Text>
              <ScrollView
                ref={firstScrollRef}
                horizontal
                showsHorizontalScrollIndicator={true}
                onScroll={(e) => handleScroll(e, true)}
                onScrollBeginDrag={handleScrollBeginDrag}
                scrollEventThrottle={16}
                contentContainerStyle={styles.horizontalScrollContent}
                style={styles.horizontalScroll}
              >
                <PanelGrid
                  panel={panels.first}
                  rules={rules.first}
                  ruleState={ruleState.first}
                  combinedRuleState={ruleState.combined}
                  additionalCellCount={3}
                  editable={true}
                  onCellPress={(index, antigenId) =>
                    handleCellPress('first', index, antigenId)}
                  onResultPress={(index) =>
                    handleResultPress('first', index)}
                  onAntigenOverride={(antigen) =>
                    handleAntigenOverride('first', antigen)}
                />
              </ScrollView>
            </View>

            <View style={styles.separator} />

            {/* Second Panel */}
            <View style={styles.panelWrapper}>
              <Text style={styles.panelTitle}>
                {panels.second.metadata.panelType}
              </Text>
              <ScrollView
                ref={secondScrollRef}
                horizontal
                showsHorizontalScrollIndicator={true}
                onScroll={(e) => handleScroll(e, false)}
                onScrollBeginDrag={handleScrollBeginDrag}
                scrollEventThrottle={16}
                contentContainerStyle={styles.horizontalScrollContent}
                style={styles.horizontalScroll}
              >
                <PanelGrid
                  panel={panels.second}
                  rules={rules.second}
                  ruleState={ruleState.second}
                  combinedRuleState={ruleState.combined}
                  additionalCellCount={3}
                  editable={true}
                  onCellPress={(index, antigenId) =>
                    handleCellPress('second', index, antigenId)}
                  onResultPress={(index) =>
                    handleResultPress('second', index)}
                  onAntigenOverride={(antigen) =>
                    handleAntigenOverride('second', antigen)}
                />
              </ScrollView>
            </View>
          </View>
        </ScrollView>
      );
    } else {
      return (
        <View style={styles.singleViewContainer}>
          <SegmentedButtons
            value={activePanel}
            onValueChange={value => setActivePanel(value as 'first' | 'second')}
            buttons={[
              {
                value: 'first',
                label: 'Screen',
              },
              {
                value: 'second',
                label: `${panels.second.metadata.panelType}`
              }
            ]}
            style={styles.panelToggle}
          />
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.scrollContent}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={styles.horizontalScrollContent}
              style={styles.horizontalScroll}
            >
              <PanelGrid
                panel={panels[activePanel]}
                rules={rules[activePanel]}
                ruleState={ruleState[activePanel]}
                combinedRuleState={ruleState.combined}
                additionalCellCount={3}
                editable={true}
                onCellPress={(index, antigenId) =>
                  handleCellPress(activePanel, index, antigenId)}
                onResultPress={(index) =>
                  handleResultPress(activePanel, index)}
                onAntigenOverride={(antigen) =>
                  handleAntigenOverride(activePanel, antigen)}
              />
            </ScrollView>
          </ScrollView>
        </View>
      );
    }
  };
  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={viewMode}
        onValueChange={setViewMode}
        buttons={[
          { value: 'combined', label: 'Combined View' },
          { value: 'single', label: 'Single View' }
        ]}
        style={styles.viewToggle}
      />

      {!showAnalysis ? (
        <View style={styles.contentContainer}>
          {renderPanelGrids()}
          <AnalysisButton
            onPress={() => setShowAnalysis(true)}
            disabled={!panels.first.cells.some(cell => cell.results['result']) &&
              !panels.second.cells.some(cell => cell.results['result'])}
          />
        </View>
      ) : (
        <>
          <ScrollView>
            <View style={styles.analysisContainer}>
              <AnalysisTable
                panel={panels.first}
                rules={rules.first}
                ruledOutAntigens={Object.keys(ruleState.first).filter(
                  antigen => ruleState.first[antigen].isRuledOut
                )}
              />
              <AnalysisTable
                panel={panels.second}
                rules={rules.second}
                ruledOutAntigens={Object.keys(ruleState.second).filter(
                  antigen => ruleState.second[antigen].isRuledOut
                )}
              />
            </View>
          </ScrollView>
          <Button
            mode="outlined"
            onPress={() => setShowAnalysis(false)}
            style={styles.backButton}
          >
            Back to Panels
          </Button>
        </>
      )}

      <FAB.Group
        open={fabOpen}
        icon={fabOpen ? 'minus' : 'plus'}
        actions={[
          {
            icon: 'content-save',
            label: 'Save',
            onPress: () => setShowSaveDialog(true)
          },
          {
            icon: 'printer',
            label: 'Print',
            onPress: () => console.log('Print panels')
          },
          {
            icon: 'chart-box',
            label: 'Analyze',
            onPress: () => navigation.navigate('Analysis', {
              panels,
              rules,
              ruleState
            })
          },
          {
            icon: 'file-document',
            label: 'Generate Report',
            onPress: () => navigation.navigate('Report', {
              panels,
              rules,
              ruleState
            })
          }
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
        visible={true}
      />

      <Portal>
        <Dialog
          visible={showSaveDialog}
          onDismiss={() => setShowSaveDialog(false)}
        >
          <Dialog.Title>Save Panels</Dialog.Title>
          <Dialog.Content>
            <Text>Do you want to save both panels?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button
              onPress={handleSave}
              loading={loading}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  horizontalScroll: {
    flexGrow: 0,
  },
  horizontalScrollContent: {
    flexGrow: 1,
  },
  combinedContainer: {
    flex: 1,
    paddingBottom: 60,
  },
  panelWrapper: {
    marginBottom: 8,
  },
  singleViewContainer: {
    flex: 1,
  },
  viewToggle: {
    margin: 8,
  },
  panelToggle: {
    margin: 8,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 4,
    marginHorizontal: 8,
    color: '#333',
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
    marginHorizontal: 8,
  },
  analysisContainer: {
    padding: 8,
    gap: 8,
  },
  backButton: {
    margin: 8,
  },
  gridContainer: {
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  dialogContainer: {
    padding: 16,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dialogContent: {
    marginBottom: 16,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  fabContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    margin: 16,
  }
});

export default PanelScreen;
