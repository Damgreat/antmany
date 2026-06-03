import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface PanelItem {
  id: string;
  name: string;
  type: string;
  lotNumber?: string;
  expirationDate?: string;
  created_at: string;
  data: string; // JSON string of panel data
}

interface FileItemRowProps {
  file: PanelItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onView: (id: string) => void;
  onMove: (id: string) => void;
  onDelete: (id: string) => void;
  onPrint?: (id: string) => void;
  folderType: 'ABScreen' | 'ABID Panel' | 'Select Cells' | 'Case Archives' | 'Raw Panels';
}

const FileItemRow: React.FC<FileItemRowProps> = ({
  file,
  isSelected,
  onToggleSelect,
  onView,
  onMove,
  onDelete,
  onPrint,
  folderType
}) => {
  // Format a readable display name based on the panel data
  const getDisplayName = () => {
    if (folderType === 'Case Archives') {
      return file.name;
    }
    
    return `Lot ${file.lotNumber || 'Unknown'} - Exp: ${file.expirationDate || 'Unknown'}`;
  };
  
  // Format creation date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return 'Unknown';
    }
  };

  if (folderType === 'Raw Panels') {
    return (
      <View style={styles.panelFileRow}>
        <View style={styles.panelIcon}>
          <Icon name="file-document-outline" size={20} color="#336699" />
        </View>
        <Text style={styles.fileName}>{getDisplayName()}</Text>
        <View style={styles.fileActions}>
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => onDelete(file.id)}
          >
            <Icon name="trash-can-outline" size={20} color="#336699" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  if (folderType === 'Case Archives') {
    // For Case Archives, we use a different component structure
    return (
      <View style={styles.archiveRow}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => onToggleSelect(file.id)}
        >
          <Icon
            name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
            size={20}
            color="#336699"
          />
        </TouchableOpacity>
        <View style={styles.cell}>
          <Text style={styles.cellText}>{formatDate(file.created_at)}</Text>
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
          onPress={() => onView(file.id)}
        >
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Standard file row for ABScreen, ABID Panel, and Select Cells
  return (
    <View style={styles.standardFileRow}>
      <TouchableOpacity 
        style={styles.checkboxContainer}
        onPress={() => onToggleSelect(file.id)}
      >
        <Icon
          name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
          size={20}
          color="#336699"
        />
      </TouchableOpacity>
      <Text style={styles.fileName}>{getDisplayName()}</Text>
      <View style={styles.fileActions}>
        <TouchableOpacity 
          style={styles.actionIcon}
          onPress={() => onMove(file.id)}
        >
          <Icon name="transfer-right" size={20} color="#336699" />
        </TouchableOpacity>
        {onPrint && (
          <TouchableOpacity 
            style={styles.actionIcon}
            onPress={() => onPrint(file.id)}
          >
            <Icon name="printer-outline" size={20} color="#336699" />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.actionIcon}
          onPress={() => onDelete(file.id)}
        >
          <Icon name="trash-can-outline" size={20} color="#336699" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  standardFileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  panelFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  panelIcon: {
    marginRight: 15,
  },
  fileName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    padding: 10,
    marginLeft: 5,
  },
  checkboxContainer: {
    marginRight: 15,
  },
  archiveRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 15,
    paddingHorizontal: 5,
    alignItems: 'center',
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
    backgroundColor: '#f5f5f5',
    height: 30,
    marginHorizontal: 5,
    borderRadius: 4,
  },
  cellText: {
    fontSize: 14,
    color: '#333',
  },
  viewButton: {
    backgroundColor: '#5c8599',
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginLeft: 10,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default FileItemRow; 