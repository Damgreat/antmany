import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type FileListHeaderProps = {
  folderName: string;
  onGoBack: () => void;
  isArchive?: boolean;
  searchText?: string;
  onSearchChange?: (text: string) => void;
  onSearchOptions?: () => void;
};

const FileListHeader: React.FC<FileListHeaderProps> = ({
  folderName,
  onGoBack,
  isArchive = false,
  searchText = '',
  onSearchChange,
  onSearchOptions,
}) => {
  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
          <Icon name="arrow-left" size={20} color="#336699" />
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Title only shown for non-archive folders */}
      {!isArchive && (
        <View style={styles.titleHeader}>
          <Text style={styles.titleText}>{folderName}</Text>
        </View>
      )}

      {/* Search bar for archives */}
      {isArchive && onSearchChange && (
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            value={searchText}
            onChangeText={onSearchChange}
          />
          {onSearchOptions && (
            <TouchableOpacity 
              style={styles.searchOptionsButton}
              onPress={onSearchOptions}
            >
              <Icon name="filter-variant" size={20} color="#336699" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: '#336699',
    fontSize: 16,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 0,
  },
  titleHeader: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  titleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  searchOptionsButton: {
    padding: 5,
  },
});

export default FileListHeader; 