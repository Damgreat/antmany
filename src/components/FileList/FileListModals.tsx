import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';

interface DeleteConfirmationModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  message: string;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  message,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{message}</Text>
          <View style={styles.modalButtonsRow}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface TransferModalProps {
  visible: boolean;
  onCancel: () => void;
  onMove: (targetFolder: string) => void;
  currentFolder: string;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  visible,
  onCancel,
  onMove,
  currentFolder,
}) => {
  // Define the possible target folders
  const folders = [
    'ABScreen',
    'ABID Panel',
    'Select Cells',
  ];

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Move to folder:</Text>
          <View style={styles.transferButtonsContainer}>
            {folders
              .filter(folder => folder !== currentFolder)
              .map((folder, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.transferButton}
                  onPress={() => onMove(folder)}
                >
                  <Text style={styles.transferButtonText}>{folder}</Text>
                </TouchableOpacity>
              ))}
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

interface SearchOptionsModalProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (mode: 'partial' | 'whole') => void;
  currentMode: 'partial' | 'whole';
}

export const SearchOptionsModal: React.FC<SearchOptionsModalProps> = ({
  visible,
  onCancel,
  onSelect,
  currentMode,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.searchOptionsModalContainer}>
          <Text style={styles.searchOptionsTitle}>Search Options</Text>
          <TouchableOpacity
            style={[
              styles.searchOptionButton, 
              currentMode === 'partial' && styles.activeSearchOption
            ]}
            onPress={() => onSelect('partial')}
          >
            <Text style={styles.searchOptionText}>Partial Match</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.searchOptionButton, 
              currentMode === 'whole' && styles.activeSearchOption
            ]}
            onPress={() => onSelect('whole')}
          >
            <Text style={styles.searchOptionText}>Whole Match</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeOptionButton}
            onPress={onCancel}
          >
            <Text style={styles.closeOptionText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#e57373', // Red for delete confirmation
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
  },
  transferButtonsContainer: {
    width: '100%',
    marginBottom: 10,
  },
  transferButton: {
    backgroundColor: '#5c8599',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  transferButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  // Search Options Modal styles
  searchOptionsModalContainer: {
    width: '70%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  searchOptionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  searchOptionButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  activeSearchOption: {
    backgroundColor: '#e6f0f7',
    borderWidth: 1,
    borderColor: '#336699',
  },
  searchOptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  closeOptionButton: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#ddd',
    borderRadius: 5,
    marginTop: 5,
    alignItems: 'center',
  },
  closeOptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
}); 