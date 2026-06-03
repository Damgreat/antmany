import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FileItem } from '../../types/files';

type StandardFileListProps = {
  files: FileItem[];
  onViewFile: (fileId: number) => void;
  onTransferFile: (fileId: number) => void;
  onDeleteFile: (fileId: number) => void;
};

const StandardFileList: React.FC<StandardFileListProps> = ({
  files,
  onViewFile,
  onTransferFile,
  onDeleteFile,
}) => {
  if (files.length === 0) {
    return (
      <View style={styles.emptyStateContainer}>
        <Icon name="folder-open-outline" size={50} color="#999" />
        <Text style={styles.emptyStateText}>No files in this folder</Text>
      </View>
    );
  }
  
  // Group files by type
  const filesByType: {[key: string]: FileItem[]} = {};
  
  files.forEach(file => {
    try {
      if (file.data) {
        const panelData = JSON.parse(file.data);
        const metadata = panelData.metadata || {};
        
        // Determine file type for grouping
        let fileType = '';
        if (file.type === 'ABID Panel' || file.type === 'ABIDPanel' || 
            metadata.testName?.includes('ABID') || file.name?.includes('ABID')) {
          fileType = 'ABID Panel';
        } else if (file.type === 'ABScreen' || file.name?.includes('ABScreen') || 
                  metadata.testName?.includes('ABScreen')) {
          fileType = 'ABScreen';
        } else {
          fileType = file.type || 'Other';
        }
        
        if (!filesByType[fileType]) {
          filesByType[fileType] = [];
        }
        filesByType[fileType].push(file);
      }
    } catch (error) {
      console.error('Error parsing file data:', error);
      // For files with parsing errors, put them in 'Other' category
      if (!filesByType['Other']) {
        filesByType['Other'] = [];
      }
      filesByType['Other'].push(file);
    }
  });
  
  // Create a flat array with section headers
  const sectionsWithHeaders: any[] = [];
  Object.keys(filesByType).forEach(type => {
    // Add section header
    sectionsWithHeaders.push({
      id: `header-${type}`,
      isHeader: true,
      title: type
    });
    
    // Add files in this section
    filesByType[type].forEach(file => {
      sectionsWithHeaders.push({
        ...file,
        isHeader: false
      });
    });
  });
  
  return (
    <FlatList
      scrollEnabled={false}
      data={sectionsWithHeaders}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => {
        // Render section header
        if (item.isHeader) {
          return <View></View>;
        }
        
        // Render file item
        const file = item;
        
        // Parse data to extract metadata properly
        let lotNumber = '';
        let expirationDate = '';
        
        try {
          if (file.data) {
            const panelData = JSON.parse(file.data);
            const metadata = panelData.metadata || {};
            
            lotNumber = metadata.lotNumber || 'Unknown';
            expirationDate = metadata.expirationDate || 'Unknown';
          }
        } catch (error) {
          console.error('Error parsing panel data:', error);
        }
        
        return (
          <TouchableOpacity
            style={styles.fileItem}
            onPress={() => onViewFile(file.id)}
            onLongPress={() => onDeleteFile(file.id)}
          >
            <View style={styles.fileDetails}>
              <View style={styles.panelInfoContainer}>
                <Text style={styles.lotExpirationText}>
                  Lot {lotNumber} Exp: {expirationDate}
                </Text>
                <Text style={styles.creationDateText}>
                  Created: {new Date(file.created_at).toLocaleDateString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            </View>
            
            <View style={styles.fileActions}>
              <TouchableOpacity 
                style={styles.actionIcon}
                onPress={() => onTransferFile(file.id)}
              >
                <Icon name="arrow-expand" size={20} color="#336699" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionIcon}
              >
                <Icon name="printer-outline" size={20} color="#336699" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionIcon}
                onPress={() => onDeleteFile(file.id)}
              >
                <Icon name="trash-can-outline" size={20} color="#336699" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  fileItem: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#F5F5F0',
    padding: 10,
    paddingVertical: 15,
    borderRadius: 0,
    borderWidth: 0,
  },
  fileDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  panelInfoContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  lotExpirationText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  creationDateText: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'normal',
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    padding: 8,
    marginLeft: 5,
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
});

export default StandardFileList; 