import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import { FONTS, COLORS } from '../constants/fonts';

type RawFoldersScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RawFoldersScreen'>;
  route: RouteProp<RootStackParamList, 'RawFoldersScreen'>;
};

const RawFoldersScreen: React.FC<RawFoldersScreenProps> = ({ navigation }) => {
  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleSelectFolder = (folderName: string) => {
    navigation.navigate('FileListScreen', { folderName });
  };

  // Mock raw folder data
  const rawFolders = Array.from({ length: 12 }, (_, i) => ({
    id: `${i + 1}`,
    name: `03.25.2025 Lot # ${i + 1}`,
    isSelected: false,
  }));

  return (
    <SafeAreaView style={styles.container}>      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Icon name="arrow-left" size={24} color={COLORS.PRIMARY} />
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <View style={styles.titleHeader}>
        <Text style={styles.titleText}>Raw Folders</Text>
      </View>
      
      <ScrollView style={styles.folderList}>
        {rawFolders.map((folder) => (
          <View key={folder.id} style={styles.folderItem}>
            <View style={styles.folderRow}>
              <View style={styles.fileIconContainer}>
                <Icon name="file-outline" size={20} color={COLORS.PRIMARY} />
                <Text style={styles.fileTypeLabel}>RW</Text>
              </View>
              <Text style={styles.folderName}>{folder.name}</Text>
              <TouchableOpacity 
                style={styles.selectButton}
                onPress={() => handleSelectFolder(folder.name)}
              >
                <Text style={styles.selectButtonText}>SELECT</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      
      {/* <TouchableOpacity style={styles.closeButton} onPress={handleGoBack}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity> */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  titleHeader: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    fontFamily: FONTS.POPPINS_BOLD,
  },
  deviceInfoText: {
    fontSize: 12,
    color: COLORS.LIGHT_TEXT,
    marginTop: 5,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 20,
  },
  folderList: {
    flex: 1,
    padding: 20,
  },
  folderItem: {
    marginBottom: 10,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fileIconContainer: {
    position: 'relative',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fileTypeLabel: {
    position: 'absolute',
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    top: 14,
    fontFamily: FONTS.POPPINS_BOLD,
  },
  folderName: {
    flex: 1,
    fontSize: 16,
    color: COLORS.TEXT,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  selectButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
  },
  selectButtonText: {
    fontSize: 14,
    color: COLORS.SECONDARY,
    fontWeight: '500',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  closeButton: {
    backgroundColor: COLORS.SECONDARY,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    margin: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
});

export default RawFoldersScreen; 