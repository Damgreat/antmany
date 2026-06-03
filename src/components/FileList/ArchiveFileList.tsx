import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FileItem } from '../../types/files';

type ArchiveFileListProps = {
  files: FileItem[];
  selectedFiles: number[];
  orientation: 'portrait' | 'landscape';
  onToggleFileSelection: (fileId: number) => void;
  onViewFile: (fileId: number) => void;
  onDeleteSelected: () => void;
};

const ArchiveFileList: React.FC<ArchiveFileListProps> = ({
  files,
  selectedFiles,
  orientation,
  onToggleFileSelection,
  onViewFile,
  onDeleteSelected,
}) => {
  if (files.length === 0) {
    return (
      <View style={styles.emptyStateContainer}>
        <Icon name="folder-open-outline" size={50} color="#999" />
        <Text style={styles.emptyStateText}>No case archives found</Text>
      </View>
    );
  }
  
  return (
    <>
      <ScrollView style={styles.contentContainer}>
        <View style={styles.archiveContainer}>
          <View style={styles.archiveTableHeader}>
            <View style={styles.checkboxHeader}>
              <Icon name="checkbox-marked" size={16} color="#336699" />
            </View>
            <Text style={styles.headerText}>Date</Text>
            <Text style={styles.headerText}>Name</Text>
            <Text style={styles.headerText}>Patient ID</Text>
            <Text style={styles.headerText}>Specimen #</Text>
            <Text style={styles.actionHeaderText}>Action</Text>
          </View>
          
          {files.map((file) => (
            <View key={file.id} style={styles.archiveRow}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => onToggleFileSelection(file.id)}
              >
                <Icon
                  name={selectedFiles.includes(file.id) ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={20}
                  color="#336699"
                />
              </TouchableOpacity>
              <View style={styles.cell}>
                <Text style={styles.cellText}>{new Date(file.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.cellText}>{file.name}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.cellText}>PT-{Math.floor(Math.random() * 90000) + 10000}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.cellText}>SP-{Math.floor(Math.random() * 9000) + 1000}</Text>
              </View>
              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => onViewFile(file.id)}
              >
                <Text style={styles.viewButtonText}>View</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
      
      <View style={orientation === 'landscape' ? styles.archiveLandscapeBottomActions : styles.archiveBottomActions}>
        <TouchableOpacity
          style={orientation === 'landscape' ? styles.archiveLandscapeDeleteButton : styles.archiveDeleteButton}
          onPress={onDeleteSelected}
        >
          <Text style={styles.archiveDeleteButtonText}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={orientation === 'landscape' ? styles.archiveLandscapeExportButton : styles.archiveExportButton}
        >
          <Text style={styles.archiveExportButtonText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={orientation === 'landscape' ? styles.archiveLandscapeExportButton : styles.archiveExportButton}
        >
          <Text style={styles.archiveExportButtonText}>Print Report</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  archiveContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  archiveTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  checkboxHeader: {
    width: 40,
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 14,
    color: '#336699',
    textAlign: 'center',
  },
  actionHeaderText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#336699',
    textAlign: 'center',
    paddingHorizontal: 15,
    alignSelf: 'center',
  },
  archiveRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 5,
  },
  checkbox: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eee',
    alignSelf: 'center',
    height: 30,
    marginHorizontal: 5,
    borderRadius: 4,
  },
  viewButton: {
    backgroundColor: '#5c8599',
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  cellText: {
    fontSize: 14,
    color: '#333',
  },
  archiveBottomActions: {
    padding: 20,
  },
  archiveLandscapeBottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '80%',
    padding: 20,
    alignSelf: 'center',
  },
  archiveDeleteButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  archiveLandscapeDeleteButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
    marginHorizontal: 10,
  },
  archiveDeleteButtonText: {
    color: '#333',
    fontSize: 16,
  },
  archiveExportButton: {
    backgroundColor: '#5c8599',
    borderRadius: 8,
    paddingVertical: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  archiveLandscapeExportButton: {
    flex: 1,
    backgroundColor: '#5c8599',
    borderRadius: 8,
    paddingVertical: 15,
    marginBottom: 10,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  archiveExportButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default ArchiveFileList; 