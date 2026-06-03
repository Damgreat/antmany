import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import SettingsHomeScreen from '../screens/SettingsHomeScreen';
import ScannerScreen from '../screens/ScannerScreen';
import PanelScreen from '../screens/PanelScreen';
import { ReportScreen } from '../screens/ReportScreen';
import AntigenDispSettingsScreen from '../screens/AntigenDispSettingsScreen';
import ProcessImageScreen from '../screens/ProcessImageScreen';
import CaseArchiveViewScreen from '../screens/CaseArchiveViewScreen';
import LoadFilesScreen from '../screens/LoadFilesScreen';
import RawFoldersScreen from '../screens/RawFoldersScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import VerifyPanelScreen from '../screens/VerifyPanelScreen';
import { OcrStructureMetrics, PanelData, RuleResult } from '../types';
import { CellConfidence } from '../services/PanelTableParser';
import PanelDetailsScreen from '../screens/PanelDetailsScreen';
import SearchResultScreen from '../screens/SearchResultScreen';
import SelectCellsSummaryScreen from '../screens/SelectCellsSummaryScreen';

export type RootStackParamList = {
  Home: undefined;
  Scanner: undefined;
  ProcessImage: { showGallery?: boolean };
  Panel: { panelData: PanelData };
  Print: { panel: PanelData };
  Analysis: { panel: PanelData; rules: RuleResult[] };
  Report: { panelData: PanelData };
  AntigenDispSettings: undefined;
  SettingsHome: undefined;
  CaseArchiveViewScreen: { fileId: string; source?: 'antibodyLab' | 'fileList' };
  LoadFilesScreen: undefined;
  RawFoldersScreen: undefined;
  FileListScreen: { folderName: string };
  SignIn: undefined;
  SearchResultScreen: undefined;
  SelectCellsSummaryScreen: undefined;
  PanelDetails: {
    lotNumber: string;
    expirationDate: string;
  };
  VerifyPanel: {
    panelData: PanelData;
    overallConfidence: number;
    cellConfidences: CellConfidence[][];
    lowConfidenceCells: CellConfidence[];
    parseErrors: string[];
    metrics: OcrStructureMetrics;
    manufacturer: string;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#6B4EAA',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProcessImage"
        component={ProcessImageScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LoadFilesScreen"
        component={LoadFilesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RawFoldersScreen"
        component={RawFoldersScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Panel"
        component={PanelScreen}
        options={{ title: 'RuleOut Pro' }}
      />
      <Stack.Screen
        name="Report"
        component={ReportScreen}
        options={{ title: 'Panel Report' }}
      />
      <Stack.Screen
        name="SettingsHome"
        component={SettingsHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AntigenDispSettings"
        component={AntigenDispSettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CaseArchiveViewScreen"
        component={CaseArchiveViewScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PanelDetails"
        component={PanelDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SearchResultScreen"
        component={SearchResultScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SelectCellsSummaryScreen"
        component={SelectCellsSummaryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Analysis"
        component={AnalysisScreen}
        options={{ title: 'Results' }}
      />
      <Stack.Screen
        name="VerifyPanel"
        component={VerifyPanelScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
