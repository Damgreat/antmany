import React, { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
  BackHandler,
  FlatList,
  TextInput
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootStackParamList } from '../navigation';
import CustomText from '../components/CustomText';
import { COLORS, FONTS } from '../constants/fonts';
import DatabaseService from '../services/DatabaseService';
import { ANTIGEN_PAIRS } from '../utils/ruleOutUtils';
import LogoutModal from '../components/LogoutModal';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import * as ConstAntigens from '../services/AntigenData';

type AntigenDispSettingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AntigenDispSettings'>;
};

// Available threshold values for heterozygous cells
const THRESHOLD_VALUES = ['1', '2', '3'];

interface AntibodyRule {
  id: number;
  name: string;
  threshold: string; // Threshold as a string ('0', '1', '2', etc.)
}

// Tooltip content for rule settings
const TOOLTIP_CONTENT = {
  primaryRule: {
    title: "Primary Rule-Out (More Info)",
    content: "The main rule-out logic applied to all antibodies. Changes here set the baseline criteria for antibody exclusion."
  },
  addOnRule: {
    title: "Add-on Rule-Out for Anti-D (More Info)",
    content: "Increases the threshold for ruling out anti-D by requiring additional cells beyond the primary rule-out. This setting applies only to anti-D and does not affect other antibodies."
  },
  supplementalRule: {
    title: "Supplemental Rule-Out (More Info)",
    content: "Allows selected antibodies to be ruled out using heterozygous cells when homozygous cells are unavailable or when specific conditions apply. This setting supplements the primary rule-out and does not override it."
  }
};
type SelectedAntigens = Record<string, string>;
// Type for state: { "GroupName": Set(["Antigen1", "Antigen2"]) }
type SelectedAntigens2 = Record<string, boolean[]>;

// Helper component for stable antigen items to prevent drag-and-drop glitches
const AntigenItem = React.memo(({
  antigen,
  groupName,
  isSelected,
  drag,
  isActive,
  onToggle
}: {
  antigen: string;
  groupName: string;
  isSelected: boolean;
  drag: () => void;
  isActive: boolean;
  onToggle: (groupName: string, antigen: string) => void;
}) => {
  return (
    <ScaleDecorator>
      <View style={[
        styles.rradioOptionCont,
        { backgroundColor: isActive ? '#e8f4f8' : 'transparent' }
      ]}>
        <TouchableOpacity
          style={styles.rradioOptionInner}
          onPress={() => onToggle(groupName, antigen)}
        >
          <View style={[styles.radioCircle, isSelected && styles.selectedCircle]}>
            {isSelected && <View style={styles.selectedInnerCircle} />}
          </View>
          <Text style={styles.antigenText}>{antigen}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPressIn={drag} style={{ paddingHorizontal: 6 }}>
          <Icon name="drag-horizontal-variant" size={24} color="#999" />
        </TouchableOpacity>
      </View>
    </ScaleDecorator>
  );
});

const AntigenDispSettingsScreen: React.FC<AntigenDispSettingsScreenProps> = ({ navigation }) => {
  const [isEditing, setIsEditing] = useState(false);
  // Use null for initial radio button states (nothing selected)
  const [isRhHrChecked, setRhHrChecked] = useState<boolean | null>(null);
  const [isKellChecked, setKellChecked] = useState<boolean | null>(null);
  const [isDuffyChecked, setDuffyChecked] = useState<boolean | null>(null);
  const [isKiddChecked, setKiddChecked] = useState<boolean | null>(null);
  const [isMNSChecked, setMNSChecked] = useState<boolean | null>(null);
  const [isP1Checked, setP1Checked] = useState<boolean | null>(null);
  const [isLuthChecked, setLuthChecked] = useState<boolean | null>(null);
  const [isXgaChecked, setXgaChecked] = useState<boolean | null>(null);
  const [isLeewisChecked, setLewisChecked] = useState<boolean | null>(null);
  const [isOtherWrChecked, setOtherChecked] = useState<boolean | null>(null);
  const [isCiCoChecked, setCiCoChecked] = useState<boolean | null>(null);
  const [isDiaChecked, setDiaChecked] = useState<boolean | null>(null);
  const [addOnRuleOut, setAddOnRuleOut] = useState<number | null>(null);
  const [primaryRuleOut, setPrimaryRuleOut] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState<{ id: number; field: string } | null>(null);
  const [antibodies, setAntibodies] = useState<AntibodyRule[]>([
    { id: 1, name: 'C', threshold: '2' },
    { id: 2, name: 'E', threshold: '2' },
    { id: 3, name: 'K', threshold: '2' },
  ]);

  // State for tooltip modal
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<'primaryRule' | 'addOnRule' | 'supplementalRule'>('primaryRule');


  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const [selectedAntigens, setSelectedAntigens] = useState<SelectedAntigens>({});

  const handleSelect = (groupName: string, antigen: string) => {
    setSelectedAntigens(prev => ({
      ...prev,
      [groupName]: antigen,
    }));
  };
  // Initialize state with empty Sets for each group
  // const [selectedAnt, setSelected] = useState<SelectedAntigens2>(() => {
  //   return INITSTATE_GROUP_MEMBERS;
  // });
  const [selectedAnt, setSelected] = useState<SelectedAntigens2>(() => {

    let initialState: SelectedAntigens2 = {};
    for (const group in INITSTATE_GROUP_MEMBERS) {
      // Create an array of 'false' matching the number of antigens in this group
      initialState[group] = [...INITSTATE_GROUP_MEMBERS[group]];//new Array(DEFAULT_GROUP_MEMBERS[group].length).fill(false);
    }
    // initialState = [...INITSTATE_GROUP_MEMBERS];

    return initialState;
  });


  const toggleAntigen = (groupName: string, antigen: string) => {
    setSelected((prevSelected) => {
      // 1. Get the array of booleans for the current group
      const currentGroupSelections = prevSelected[groupName] || [];

      // 2. Find the index of the clicked antigen in the LIVE group members (not the hardcoded default)
      const antigenIndex = (groupMembers[groupName] || []).indexOf(antigen);

      if (antigenIndex === -1) return prevSelected; // antigen not found, do nothing

      // 3. Create a copy of the specific group's selection array
      const updatedGroupSelections = [...currentGroupSelections];

      // 4. Toggle the boolean value at that index
      updatedGroupSelections[antigenIndex] = !updatedGroupSelections[antigenIndex];

      // 5. Return the new state object with the updated group
      return {
        ...prevSelected,
        [groupName]: updatedGroupSelections,
      };
    });
  };

  const selectAll = (groupName: string) => {
    setSelected((prevSelected) => {
      const currentGroupAntigens = groupMembers[groupName] || [];
      return {
        ...prevSelected,
        [groupName]: new Array(currentGroupAntigens.length).fill(true),
      };
    });
  };

  const deselectAll = (groupName: string) => {
    setSelected((prevSelected) => {
      const currentGroupAntigens = groupMembers[groupName] || [];
      return {
        ...prevSelected,
        [groupName]: new Array(currentGroupAntigens.length).fill(false),
      };
    });
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = () => {
    setLogoutModalVisible(false);
    navigation.reset({
      index: 0,
      routes: [{ name: 'SignIn' }],
    });
  };

  // Get all available antigens from ANTIGEN_PAIRS
  // const availableAntigens = Object.keys(ANTIGEN_PAIRS).filter(
  //   antigen => !antibodies.some(a => a.name === antigen)
  // );
  const specifiedAntigens = [
    'C',
    'E',
    'K',
    'f',
    'Kpa',
    'Kpb',
    'Jsa',
    'Jsb',
    'Xga',
    'P1',
    'Lua',
    'Lea',
    'Leb',
  ];

  let INITSTATE_GROUP_MEMBERS: Record<string, boolean[]> = {
    "Rh-hr": [true, true, true, true, true, true, true, true],
    KELL: [true, true, true, true, true, true],
    DUFFY: [true, true],
    KIDD: [true, true],
    LEWIS: [true, true],
    MNS: [true, true, true, true],
    P: [true],
    LUTHERAN: [true, true],
    SEX: [true],
    COLTON: [false, false],
    DIEGO: [false, false],
    "Additonal Antigens": [false],
  };

  // const availableAntigens = Object.keys(ANTIGEN_PAIRS)
  //   .filter(antigen => specifiedAntigens.includes(antigen))
  //   .filter(antigen => !antibodies.some(a => a.name === antigen));
  const safeAntibodies = Array.isArray(antibodies) ? antibodies : [];
  const availableAntigens = [...specifiedAntigens].filter(antigen => !safeAntibodies.some(a => a.name === antigen));

  // Store position information for dropdown
  const [dropdownPosition, setDropdownPosition] = useState<{
    id: number | null;
    field: string | null;
    top: number;
    left: number;
    width: number;
    direction: 'down' | 'up';
    maxHeight: number;
  }>({
    id: null,
    field: null,
    top: 0,
    left: 0,
    width: 0,
    direction: 'down',
    maxHeight: 200
  });

  const scrollViewRef = useRef<ScrollView>(null);
  const manuInputRef = useRef<TextInput>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Add these state variables to track original values
  const [originalPrimaryRuleOut, setOriginalPrimaryRuleOut] = useState<number | null>(null);
  const [originalAddOnRuleOut, setOriginalAddOnRuleOut] = useState<number | null>(null);
  const [originalAntibodies, setOriginalAntibodies] = useState<AntibodyRule[]>([]);
  // 1. Create a Type from your array
  type AntigenManufacturer = typeof ConstAntigens.ANTIGEN_MANUFACTURERS[0];

  // 2. Tell the state to only accept those specific strings (or a default)
  const [manuchoice, setManuChoice] = useState("Create New");//<AntigenManufacturer>("DEFAULT"); 
  const [manuName, setManuNameText] = useState("");

  const [reorderRhHrflag, setRHHRReorder] = useState(false);
  const [groups, setGroups] = useState(ConstAntigens.DEFAULT_GROUP_ORDER);
  const [rhhrAntigens, setRHHRAnts] = useState((ConstAntigens.DataSources[manuchoice] || ConstAntigens.DEFAULT_GROUP_MEMBERS)["Rh-hr"]);
  const [groupMembers, setGroupMembers] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const loadManuData = async () => {
      const storedGroupsStr = await DatabaseService.getSetting(`groups_${manuchoice}`);
      const storedMembersStr = await DatabaseService.getSetting(`groupMembers_${manuchoice}`);
      const storedSelectedAntStr = await DatabaseService.getSetting(`selectedAnt_${manuchoice}`);

      if (storedGroupsStr && storedGroupsStr.value && storedMembersStr && storedMembersStr.value) {
        setGroups(JSON.parse(storedGroupsStr.value));
        setGroupMembers(JSON.parse(storedMembersStr.value));
      } else {
        const initialMembers = ConstAntigens.DataSources[manuchoice] || ConstAntigens.DEFAULT_GROUP_MEMBERS;
        const copyMembers: Record<string, string[]> = {};
        for (const key in initialMembers) {
          copyMembers[key] = [...initialMembers[key]];
        }
        setGroupMembers(copyMembers);
        setGroups(ConstAntigens.MANUFACTURER_GRPORDER_MAP[manuchoice] || ConstAntigens.DEFAULT_GROUP_ORDER);
      }

      if (storedSelectedAntStr && storedSelectedAntStr.value) {
        setSelected(JSON.parse(storedSelectedAntStr.value));
      } else {
        setSelected({});
      }
    };
    loadManuData();
  }, [manuchoice]);

  const moveAntigen = (groupName: string, index: number, direction: -1 | 1) => {
    const list = [...(groupMembers[groupName] || [])];
    const selections = [...(selectedAnt[groupName] || [])];
    const newIndex = index + direction;

    if (newIndex >= 0 && newIndex < list.length) {
      // Move antigen name
      const [movedItem] = list.splice(index, 1);
      list.splice(newIndex, 0, movedItem);

      // Move selection state if it exists
      if (selections.length > 0) {
        const [movedSelection] = selections.splice(index, 1);
        selections.splice(newIndex, 0, movedSelection);
      }

      setGroupMembers(prev => ({ ...prev, [groupName]: list }));
      setSelected(prev => ({ ...prev, [groupName]: selections }));

      // Keep old rhhr sync working if they use the hidden panel
      if (groupName.toLowerCase() === "rh-hr") {
        setRHHRAnts(list);
      }
    }
  };

  const [manufacturersList, setManufacturersList] = useState<string[]>(ConstAntigens.ANTIGEN_MANUFACTURERS);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<{ type: 'group' | 'antigen', groupName: string, antigenName?: string, index?: number } | null>(null);
  const [editInputValue, setEditInputValue] = useState("");

  const saveEdit = () => {
    if (!editInputValue.trim()) return;
    const newText = editInputValue.trim();
    if (editTarget?.type === 'group') {
      const oldGroupName = editTarget.groupName;
      // Validation to check if group already exists
      if (groups.includes(newText) && newText !== oldGroupName) {
        Alert.alert("Duplicate Group", "A group with this name already exists.");
        return;
      }
      // update groups array
      const newGroups = groups.map(g => g === oldGroupName ? newText : g);
      setGroups(newGroups);
      // update groupMembers record
      setGroupMembers(prev => {
        const newMembers = { ...prev };
        newMembers[newText] = newMembers[oldGroupName] || [];
        if (newText !== oldGroupName) delete newMembers[oldGroupName];
        return newMembers;
      });
      // Update selectedAnt
      setSelected((prev: any) => {
        const newSelected = { ...prev };
        if (newSelected[oldGroupName]) {
          newSelected[newText] = newSelected[oldGroupName];
          if (newText !== oldGroupName) delete newSelected[oldGroupName];
        }
        return newSelected;
      });
    } else if (editTarget?.type === 'antigen') {
      const groupName = editTarget.groupName;
      const idx = editTarget.index!;

      // Validation to check if antigen already exists in the same group
      const currentAntigens = groupMembers[groupName] || [];
      if (currentAntigens.some((name, i) => i !== idx && name === newText)) {
        Alert.alert("Duplicate Antigen", `An antigen named "${newText}" already exists in the "${groupName}" group.`);
        return;
      }

      setGroupMembers(prev => {
        const newMembers = { ...prev };
        const list = [...(newMembers[groupName] || [])];
        list[idx] = newText;
        newMembers[groupName] = list;
        return newMembers;
      });
      if (groupName.toLowerCase() === 'rh-hr') {
        setRHHRAnts(prev => {
          const list = [...prev];
          list[idx] = newText;
          return list;
        });
      }
    }
    setEditModalVisible(false);
  };

  const deleteAntigen = async (groupName: string, index: number) => {
    // Remove from groupMembers
    const updatedMembers = { ...groupMembers };
    const newList = [...(updatedMembers[groupName] || [])];
    newList.splice(index, 1);
    updatedMembers[groupName] = newList;
    setGroupMembers(updatedMembers);

    // Remove corresponding selection state
    const updatedSelections = { ...selectedAnt };
    const newSelections = [...(updatedSelections[groupName] || [])];
    newSelections.splice(index, 1);
    updatedSelections[groupName] = newSelections;
    setSelected(updatedSelections);

    // Sync rh-hr antigens if needed
    if (groupName.toLowerCase() === 'rh-hr') {
      setRHHRAnts(newList);
    }

    // Persist immediately to DB
    try {
      await DatabaseService.saveSetting(`groupMembers_${manuchoice}`, JSON.stringify(updatedMembers));
      await DatabaseService.saveSetting(`selectedAnt_${manuchoice}`, JSON.stringify(updatedSelections));
    } catch (err) {
      console.error('Error auto-saving after antigen delete:', err);
    }

    setEditModalVisible(false);
  };

  useEffect(() => {
    const initMfrs = async () => {
      const mfrListStr = await DatabaseService.getSetting('manufacturersList');
      if (mfrListStr && mfrListStr.value) {
        setManufacturersList(JSON.parse(mfrListStr.value));
      }
      const loadedManuchoice = await DatabaseService.getSetting('manuchoice');
      if (loadedManuchoice && loadedManuchoice.value) {
        setManuChoice(loadedManuchoice.value);
      }
    };
    initMfrs();
  }, []);

  const handleDeleteManufacturer = () => {
    if (manuchoice === "Create New") {
      Alert.alert("Cannot Delete", "The default custom placeholder cannot be deleted.");
      return;
    }
    Alert.alert(
      "Delete Manufacturer",
      `Are you sure you want to delete ${manuchoice}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive", onPress: async () => {
            const updatedList = manufacturersList.filter(m => m !== manuchoice);
            setManufacturersList(updatedList);
            setManuChoice("Create New");
            setManuNameText("");
            // Persist immediately — no need to press Save
            try {
              await DatabaseService.saveSetting('manufacturersList', JSON.stringify(updatedList));
              await DatabaseService.saveSetting('manuchoice', 'Create New');
            } catch (err) {
              console.error('Error saving after manufacturer delete:', err);
            }
          }
        }
      ]
    );
  };

  const handleEditManufacturer = () => {
    manuInputRef.current?.focus();
  };


  const handleGoBack = () => {
    // Check if there are unsaved changes
    const hasChanges = (
      primaryRuleOut !== originalPrimaryRuleOut ||
      addOnRuleOut !== originalAddOnRuleOut ||
      JSON.stringify(antibodies) !== JSON.stringify(originalAntibodies)
    );

    if (hasChanges) {
      // Show confirmation dialog only if there are changes
      setModalVisible(true);
    } else {
      // No changes, just go back without confirmation
      navigation.goBack();
    }
  };

  const confirmGoBack = () => {
    setModalVisible(false);
    navigation.goBack();
  };

  const cancelGoBack = () => {
    setModalVisible(false);
  };

  const handleAddAntibody = () => {
    // Logic to add a new antibody - default to first available antigen
    if (availableAntigens.length === 0) {
      Alert.alert('No more antigens available', 'All available antigens have been added.');
      return;
    }

    const safeAntibodies = Array.isArray(antibodies) ? antibodies : [];
    const newId = safeAntibodies.length > 0 ? Math.max(...safeAntibodies.map(a => a.id)) + 1 : 1;
    setAntibodies([...safeAntibodies, { id: newId, name: availableAntigens[0], threshold: '2' }]);
  };

  /**
   * Moves an item in the list up or down.
   * @param index The current index of the item to move.
   * @param direction The direction to move: -1 for up, 1 for down.
   */
  const moveItem = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    // Check if the new index is within valid bounds
    if (newIndex >= 0 && newIndex < groups.length) {
      // Create a copy of the array to avoid mutating the state directly
      const updatedGroups = [...groups];
      // Remove the item from its current position
      const [movedItem] = updatedGroups.splice(index, 1);
      // Insert the item into its new position
      updatedGroups.splice(newIndex, 0, movedItem);
      // Update the state to re-render the list
      setGroups(updatedGroups);
    }
  };
  const moveRhHrItem = (index: number, direction: -1 | 1) => {
    const list = [...rhhrAntigens];
    const selections = [...(selectedAnt["Rh-hr"] || [])];
    const newIndex = index + direction;

    if (newIndex >= 0 && newIndex < list.length) {
      const [movedItem] = list.splice(index, 1);
      list.splice(newIndex, 0, movedItem);

      if (selections.length > 0) {
        const [movedSelection] = selections.splice(index, 1);
        selections.splice(newIndex, 0, movedSelection);
      }

      setRHHRAnts(list);
      setGroupMembers(prev => ({ ...prev, "Rh-hr": list }));
      setSelected(prev => ({ ...prev, "Rh-hr": selections }));
    }
  };


  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<string>) => (
    <ScaleDecorator>
      <TouchableOpacity
        activeOpacity={1}
        onLongPress={drag}
        disabled={isActive}
        style={[styles.itemContainer, { backgroundColor: isActive ? '#e0f0f5' : '#f9f9f9', opacity: isActive ? 0.8 : 1 }]}
      >
        <Text style={styles.itemText}>{item}</Text>
        <View style={styles.buttonsContainer}>
          <TouchableOpacity onPressIn={drag}>
            <Icon name="drag-horizontal-variant" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </ScaleDecorator>
  ), []);

  const renderRHHRItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.itemContainer2}>
      <Text style={styles.itemText}>{item}</Text>
      <View style={styles.buttonsContainer}>
        {/* Up Button */}
        <TouchableOpacity
          onPress={() => moveRhHrItem(index, -1)}
          disabled={index === 0} // Disable if at the top
          style={[styles.button, index === 0 && styles.buttonDisabled]}
        >
          {/* Using a simple 'up' symbol, replace with actual icon if using a library */}
          <Icon name="arrow-up" size={20} color={index === 0 ? '#6264d4' : '#000'} />
        </TouchableOpacity>

        {/* Down Button */}
        <TouchableOpacity
          onPress={() => moveRhHrItem(index, 1)}
          disabled={index === rhhrAntigens.length - 1} // Disable if at the bottom
          style={[styles.button, index === rhhrAntigens.length - 1 && styles.buttonDisabled]}
        >
          <Icon name="arrow-down" size={20} color={index === rhhrAntigens.length - 1 ? '#6264d4' : '#000'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const toggleDropdown = (id: number, field: string, event: any) => {
    // Close if already open
    if (dropdownVisible && dropdownVisible.id === id && dropdownVisible.field === field) {
      setDropdownVisible(null);
      return;
    }

    // Get the target element
    const target = event.target;

    // Use measure in window which gives coordinates relative to window
    target.measureInWindow((x: number, y: number, width: number, height: number) => {
      const windowHeight = Dimensions.get('window').height;
      const windowWidth = Dimensions.get('window').width;

      // Calculate space below and above the element
      const spaceBelow = windowHeight - y - height;
      const spaceAbove = y;

      // Determine dropdown direction and position
      let direction: 'down' | 'up' = 'down';
      let dropdownTop = y + height; // Default position below the element
      let maxHeight = 200; // Default max height

      // If there's not enough space below (less than 150px) and more space above, show dropdown above
      if (spaceBelow < 150 && spaceAbove > spaceBelow) {
        direction = 'up';
        dropdownTop = y - 10; // Position above with small offset
        maxHeight = Math.min(200, spaceAbove - 20); // Limit to space available above
      } else {
        // Show below, but limit height if near bottom of screen
        maxHeight = Math.min(200, spaceBelow - 20);
      }

      // Ensure width doesn't exceed screen boundaries
      const dropdownWidth = Math.min(width, windowWidth - x - 10);

      setDropdownPosition({
        id,
        field,
        top: dropdownTop,
        left: x,
        width: dropdownWidth,
        direction,
        maxHeight
      });

      // Show the dropdown
      setDropdownVisible({ id, field });
    });
  };

  // Handle showing tooltip
  const showTooltip = (tooltipType: 'primaryRule' | 'addOnRule' | 'supplementalRule') => {
    setActiveTooltip(tooltipType);
    setTooltipVisible(true);
  };

  const handleAntigenSelection = (id: number, antigen: string) => {
    const safeAntibodies = Array.isArray(antibodies) ? antibodies : [];
    setAntibodies(
      safeAntibodies.map(antibody =>
        antibody.id === id
          ? { ...antibody, name: antigen }
          : antibody
      )
    );
    setDropdownVisible(null);
  };

  const handleThresholdSelection = (id: number, threshold: string) => {
    const safeAntibodies = Array.isArray(antibodies) ? antibodies : [];
    setAntibodies(
      safeAntibodies.map(antibody =>
        antibody.id === id
          ? { ...antibody, threshold }
          : antibody
      )
    );
    setDropdownVisible(null);
  };

  const deleteAntibody = (id: number) => {
    const safeAntibodies = Array.isArray(antibodies) ? antibodies : [];
    const updated = safeAntibodies.filter(antibody => antibody.id !== id);
    setAntibodies(updated);

    // Persist immediately — no need to press Save
    const antibodyRulesData = updated.map(antibody => ({
      id: antibody.id,
      name: antibody.name,
      isSelected: 'Yes',
      isHeterozygous: antibody.threshold,
    }));
    DatabaseService.saveAntibodyRules(antibodyRulesData).catch(err =>
      console.error('Error auto-saving after delete:', err)
    );
    // Keep original state in sync so the unsaved-changes guard stays quiet
    setOriginalAntibodies(updated);
  };

  const handleSave = async () => {
    // Validate required selections
    // if (primaryRuleOut === null) {
    //   Alert.alert('Required Selection', 'Please select a Primary Rule-Out option');
    //   return;
    // }

    try {
      let currentChoice = manuchoice;
      let currentList = [...manufacturersList];

      if (manuName !== "" && manuName !== manuchoice) {
        if (!currentList.includes(manuName)) {
          if (manuchoice !== "Create New") {
            currentList = currentList.filter(m => m !== manuchoice);
          }
          currentList.push(manuName);
        }
        currentChoice = manuName;
        setManuChoice(currentChoice);
        setManufacturersList(currentList);
        setManuNameText("");
      }

      await DatabaseService.saveSetting('manuchoice', currentChoice);
      await DatabaseService.saveSetting('manufacturersList', JSON.stringify(currentList));
      await DatabaseService.saveSetting(`groups_${currentChoice}`, JSON.stringify(groups));
      await DatabaseService.saveSetting(`groupMembers_${currentChoice}`, JSON.stringify(groupMembers));
      await DatabaseService.saveSetting(`selectedAnt_${currentChoice}`, JSON.stringify(selectedAnt));

      // Save Primary Rule-Out
      if (primaryRuleOut !== null) {
        await DatabaseService.saveSetting('primaryRuleOut', primaryRuleOut.toString());
      }

      // Save Add-on Rule-Out
      const addOnRuleOutValue = addOnRuleOut === null ? 0 : addOnRuleOut;
      await DatabaseService.saveSetting('addOnRuleOut', addOnRuleOutValue.toString());

      // Convert antibodies to format expected by the database
      const safeAntibodies = Array.isArray(antibodies) ? antibodies : [];
      const antibodyRulesData = safeAntibodies.map(antibody => ({
        id: antibody.id,
        name: antibody.name,
        isSelected: 'Yes',
        isHeterozygous: antibody.threshold
      }));

      // Save antibody rules
      await DatabaseService.saveAntibodyRules(antibodyRulesData);

      // After successful save, update original values to match current values
      setOriginalPrimaryRuleOut(primaryRuleOut);
      setOriginalAddOnRuleOut(addOnRuleOut);
      setOriginalAntibodies([...antibodies]);

      // Show success message
      Alert.alert('Success', 'Antigens Settings saved successfully');

      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error('Error saving rules:', error);
      Alert.alert('Error', 'Failed to save rules');
    }
  };

  const renderAntigenDropdown = (id: number, selectedAntigen: string) => {
    const isOpen = dropdownVisible && dropdownVisible.id === id && dropdownVisible.field === 'antigen';

    return (
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          style={[styles.dropdownSelector, isOpen && { borderColor: '#5c8599' }]}
          onPress={(event) => toggleDropdown(id, 'antigen', event)}
        >
          <Text style={styles.selectedValue}>{selectedAntigen}</Text>
          {/* <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={16} color="#666" /> */}
        </TouchableOpacity>
      </View>
    );
  };

  const renderThresholdDropdown = (id: number, threshold: string) => {
    const isOpen = dropdownVisible && dropdownVisible.id === id && dropdownVisible.field === 'threshold';

    return (
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          style={[styles.dropdownSelector, isOpen && { borderColor: '#5c8599' }]}
          onPress={(event) => toggleDropdown(id, 'threshold', event)}
        >
          <Text style={styles.selectedValue}>{threshold}</Text>
          {/* <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={16} color="#666" /> */}
        </TouchableOpacity>
      </View>
    );
  };

  // // Toggle the Anti-D rule selection
  // const handleAntiDSelection = (value: number) => {
  //   // If the current value is already selected, deselect it (set to null)
  //   if (addOnRuleOut === value) {
  //     setAddOnRuleOut(null);
  //   } else {
  //     setAddOnRuleOut(value);
  //   }
  // };

  const renderAntigenContent = () => {
    const content: ReactNode[] = [];
    const selectedData = groupMembers;

    for (const groupName of groups) {
      if (!selectedData[groupName]) continue;
      const antigens = selectedData[groupName];

      let antigenDisplay: ReactNode;

      if (isEditing) {
        // Edit mode: DraggableFlatList with drag handles, no arrows
        antigenDisplay = (
          <DraggableFlatList
            data={antigens}
            keyExtractor={(item) => `${groupName}-${item}`}
            scrollEnabled={false}
            nestedScrollEnabled={true}
            onDragEnd={({ data }) => {
              // Functional update to ensure we have the latest state and batch correctly
              setGroupMembers(prevMembers => {
                const oldOrder = prevMembers[groupName] || [];

                setSelected(prevSelected => {
                  const selections = prevSelected[groupName] || [];
                  const newSelections = data.map(antigen => {
                    const oldIdx = oldOrder.indexOf(antigen);
                    return oldIdx >= 0 ? (selections[oldIdx] ?? false) : false;
                  });
                  return { ...prevSelected, [groupName]: newSelections };
                });

                if (groupName.toLowerCase() === 'rh-hr') {
                  setRHHRAnts(data);
                }

                return { ...prevMembers, [groupName]: data };
              });
            }}
            renderItem={({ item: antigen, drag, isActive }) => {
              const currentGroupSelections = selectedAnt[groupName] || [];
              const currentGroupAntigens = groupMembers[groupName] || [];
              const i = currentGroupAntigens.indexOf(antigen);
              const isSelected = currentGroupSelections[i] ?? false;

              return (
                <AntigenItem
                  antigen={antigen}
                  groupName={groupName}
                  isSelected={isSelected}
                  drag={drag}
                  isActive={isActive}
                  onToggle={toggleAntigen}
                />
              );
            }}
          />
        );
      } else {
        // View mode: original horizontal grid
        const antigenButtons: ReactNode[] = [];
        for (let i = 0; i < antigens.length; i++) {
          const antigen = antigens[i];
          if (!antigen) continue;
          const isSelected = selectedAnt[groupName] ? selectedAnt[groupName][i] : false;
          antigenButtons.push(
            <View key={`${groupName}-${antigen}`} style={styles.rradioOptionCont}>
              <TouchableOpacity
                style={styles.rradioOptionInner}
                disabled={true}
              >
                <View style={[styles.radioCircle, isSelected && styles.selectedCircle, { borderColor: '#ccc' }]}>
                  {isSelected && <View style={[styles.selectedInnerCircle, { backgroundColor: '#ccc' }]} />}
                </View>
                <Text style={styles.antigenText}>{antigen}</Text>
              </TouchableOpacity>
            </View>
          );
        }
        antigenDisplay = <View style={styles.antigenGrid}>{antigenButtons}</View>;
      }

      content.push(
        <View key={groupName} style={styles.groupContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.groupTitle, { marginBottom: 0 }]}>{groupName}</Text>
              {isEditing && (
                <TouchableOpacity
                  style={{ marginLeft: 10, padding: 4 }}
                  onPress={() => { setEditTarget({ type: 'group', groupName }); setEditInputValue(groupName); setEditModalVisible(true); }}
                >
                  <Icon name="pencil" size={16} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {isEditing && (
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  style={styles.groupActionButton}
                  onPress={() => selectAll(groupName)}
                >
                  <Text style={styles.groupActionText}>Select All</Text>
                </TouchableOpacity>

              </View>
            )}
          </View>
          {antigenDisplay}
        </View>
      );
    }

    return content;
  };
  // Load rules from database when component mounts
  useEffect(() => {
    const loadRules = async () => {
      try {
        await DatabaseService.initDatabase();

        // Load primary rule out setting
        const primaryRuleOutSetting = await DatabaseService.getSetting('primaryRuleOut');
        if (primaryRuleOutSetting) {
          const value = parseInt(primaryRuleOutSetting.value);
          setPrimaryRuleOut(value);
          setOriginalPrimaryRuleOut(value); // Store original value
        }

        // Load add-on rule out setting
        const addOnRuleOutSetting = await DatabaseService.getSetting('addOnRuleOut');
        if (addOnRuleOutSetting) {
          const value = parseInt(addOnRuleOutSetting.value);
          // Only set non-zero values (0 should remain null for unchecked state)
          if (value > 0) {
            setAddOnRuleOut(value);
            setOriginalAddOnRuleOut(value); // Store original value
          } else {
            setOriginalAddOnRuleOut(null); // Ensure null is stored for 0
          }
        }

        // Load antibody rules
        const antibodyRules = await DatabaseService.getAntibodyRules();
        if (antibodyRules && antibodyRules.length > 0) {
          // Convert from database format to our format
          const loadedAntibodies = antibodyRules.map(rule => ({
            id: rule.id,
            name: rule.name,
            threshold: rule.isHeterozygous === 'Not Set' ? '2' : rule.isHeterozygous
          }));
          setAntibodies(loadedAntibodies);
          setOriginalAntibodies([...loadedAntibodies]); // Store original value using spread to create a deep copy
        }
      } catch (error) {
        console.error('Error loading rules:', error);
      }
    };

    loadRules();
  }, []);

  // Add new useEffect to handle navigation
  useEffect(() => {
    // Disable swipe back gesture when there are unsaved changes
    const hasChanges = () => {
      return (
        primaryRuleOut !== originalPrimaryRuleOut ||
        addOnRuleOut !== originalAddOnRuleOut ||
        JSON.stringify(antibodies) !== JSON.stringify(originalAntibodies)
      );
    };

    // Configure navigation options to prevent swipe back when there are changes
    navigation.setOptions({
      gestureEnabled: !hasChanges()
    });
  }, [
    primaryRuleOut,
    originalPrimaryRuleOut,
    addOnRuleOut,
    originalAddOnRuleOut,
    antibodies,
    originalAntibodies,
    navigation
  ]);

  // Add back button handler for Android
  useFocusEffect(
    useCallback(() => {
      const hasChanges =
        primaryRuleOut !== originalPrimaryRuleOut ||
        addOnRuleOut !== originalAddOnRuleOut ||
        JSON.stringify(antibodies) !== JSON.stringify(originalAntibodies);

      const onBackPress = () => {
        if (hasChanges) {
          setModalVisible(true);
          return true; // Prevent default behavior
        }
        return false; // Let default back action happen
      };

      // Add back button listener
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => subscription.remove(); // Cleanup on unmount
    }, [
      primaryRuleOut,
      originalPrimaryRuleOut,
      addOnRuleOut,
      originalAddOnRuleOut,
      antibodies,
      originalAntibodies
    ])
  );

  // 1. Create the lookup mapping
  const MANUFACTURER_DATA_MAP: Record<typeof ConstAntigens.ANTIGEN_MANUFACTURERS[number], Record<string, string[] | Set<string>>> = {
    DEFAULT: ConstAntigens.DEFAULT_GROUP_MEMBERS,
    ORTHO: ConstAntigens.ORTHO_GROUP_MEMBERS,
    ALBA: ConstAntigens.ALBA_GROUP_MEMBERS,
    BIOTEST: ConstAntigens.BIOTEST_GROUP_MEMBERS,
    IMMUCOR: ConstAntigens.IMMUCOR_GROUP_MEMBERS,
    MEDION: ConstAntigens.MEDION_GROUP_MEMBERS,
    GRIFOLS: ConstAntigens.BIORAD_GRIFOLS_GROUP_MEMBERS,
    QUOTIENT: ConstAntigens.QUOTIENT_GROUP_MEMBERS,
    "BIO-RAD": ConstAntigens.BIORAD_GRIFOLS_GROUP_MEMBERS,
  };

  // let content: ReactNode[] = [];
  // content = renderAntigenContent();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Icon name="arrow-left" size={24} color="#336699" />
            <Text style={styles.backText}>Go back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Log out</Text>
            <Icon name="logout" size={24} color="#336699" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <CustomText variant="medium" style={styles.screenTitle}>Customize Antigram Table</CustomText>
        <CustomText variant="medium" style={styles.whatToDo}>Configure the antigen panel according to your manufacturer</CustomText>

        <ScrollView
          style={styles.scrollContent}
          ref={scrollViewRef}
          onScroll={(event) => {
            setScrollOffset(event.nativeEvent.contentOffset.y);
            // If dropdown is visible, close it when scrolling
            if (dropdownVisible) {
              setDropdownVisible(null);
            }
          }}
          scrollEventThrottle={16}
        >

          {/*     <View style={styles.container}>
      <Text style={styles.fieldText}>Manufacturer:</Text>
      {ANTIGEN_MANUFACTURERS.map((item) => (
        <TouchableOpacity
          key={item}
          style={styles.option}
          onPress={() => setManuChoice(item)}
        >
          <View style={styles.radio}>
            {manuchoice === item && <View style={styles.selected} />}
          </View>
          <Text style={styles.fieldText}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>  */}

          {/* <View style={styles.container}>
      <Text style={styles.fieldText}>Choose a Manufacturer:</Text>
      <Picker
        selectedValue={manuchoice}
        onValueChange={(itemValue: React.SetStateAction<string>) => setManuChoice(itemValue)}
        style={styles.picker}
      >
        <Picker.Item label="Select Manufacturer..." value="" />
        <Picker.Item label={ANTIGEN_MANUFACTURERS[0]} value={ANTIGEN_MANUFACTURERS[0]} />
        <Picker.Item label={ANTIGEN_MANUFACTURERS[1]} value={ANTIGEN_MANUFACTURERS[1]} />
        <Picker.Item label={ANTIGEN_MANUFACTURERS[2]} value={ANTIGEN_MANUFACTURERS[2]} />
        <Picker.Item label={ANTIGEN_MANUFACTURERS[3]} value={ANTIGEN_MANUFACTURERS[3]} />
        <Picker.Item label={ANTIGEN_MANUFACTURERS[4]} value={ANTIGEN_MANUFACTURERS[4]} />
        <Picker.Item label={ANTIGEN_MANUFACTURERS[5]} value={ANTIGEN_MANUFACTURERS[5]} />
        <Picker.Item label={ANTIGEN_MANUFACTURERS[6]} value={ANTIGEN_MANUFACTURERS[6]} />
        <Picker.Item label={ANTIGEN_MANUFACTURERS[7]} value={ANTIGEN_MANUFACTURERS[7]} />

      </Picker>
      </View> */}
          <View style={styles.container}>
            <Text style={styles.fieldText}>Choose a Manufacturer:</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.pickerWrapper, { flex: 1 }]}>
                <Picker
                  selectedValue={manuchoice}
                  onValueChange={(itemValue) => setManuChoice(itemValue)}
                  style={styles.picker}
                  dropdownIconColor="#007AFF"
                >
                  <Picker.Item label="Select Manufacturer..." value="" />

                  {/* Mapping through the array to generate items dynamically */}
                  {manufacturersList.map((manufacturer, index) => (
                    <Picker.Item
                      key={`${manufacturer}-${index}`}
                      label={manufacturer}
                      value={manufacturer}
                    />
                  ))}
                </Picker>
              </View>
              <TouchableOpacity onPress={handleDeleteManufacturer} style={{ marginLeft: 10 }}>
                <Icon name="delete" size={24} color="red" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary Rules Section */}
          <View style={styles.section}>
            <View style={[styles.sectionLeftTitleContainer, { justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={styles.sectionLeftTitle}>Antigen Panel Configuration</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditing(!isEditing)}
                style={{ backgroundColor: isEditing ? '#888' : '#336699', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{isEditing ? 'Cancel' : 'Edit'}</Text>
              </TouchableOpacity>
            </View>
            {/* <View style={styles.fieldContainer}>
            {(
              <Text style={styles.fieldText}>Manufacturer (edit to change name): {manuchoice}</Text>
            )}
          </View>  */}
            <View style={styles.fieldContainer}>
              <TextInput
                ref={manuInputRef}
                style={styles.fieldText}
                value={manuName !== "" ? manuName : (manuchoice === "Create New" ? "" : manuchoice)}
                onChangeText={(text) => setManuNameText(text)}
                placeholder={manuchoice === "Create New" ? "Create New" : "Or enter Manufacturer"}
              />
            </View>
            {/* SPLIT LAYOUT */}
            <View style={{ flexDirection: 'row', flex: 1 }}>
              {/* LEFT SIDE */}
              <View style={{ flex: isEditing ? 6 : 10, paddingRight: isEditing ? 15 : 0 }}>
                <Text style={styles.sectionLeftSubtitle}>Blood Group Antigens</Text>

                <View style={[styles.scrcontainer, { minHeight: 400 }]}>
                  {renderAntigenContent()}
                </View>
              </View>

              {/* RIGHT SIDE */}
              {isEditing && (
                <View style={{ flex: 4, paddingLeft: 10 }}>
                  <Text style={styles.sectionLeftTitle}>Reorder Antigen Groups</Text>
                  <View style={{ minHeight: 400, flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 10 }}>
                    <DraggableFlatList
                      data={groups}
                      renderItem={renderItem}
                      keyExtractor={(item) => item}
                      onDragEnd={({ data }) => setGroups(data)}
                      style={styles.list}
                      containerStyle={{ flex: 1 }}
                      nestedScrollEnabled={true}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Supplemental Rule-Out Section */}
          <View style={styles.section}>
            <View style={styles.sectionLeftTitleContainer}>
              <Text style={styles.sectionLeftTitle}>Supplemental Rule-Out (Antibody Rules)</Text>
              <TouchableOpacity onPress={() => showTooltip('supplementalRule')}>
                <Icon name="information-outline" size={22} color="#336699" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={handleAddAntibody}>
              <Icon name="plus-circle" size={24} color="#336699" />
              <Text style={styles.addButtonText}>Add Antibody rule</Text>
            </TouchableOpacity>

            <View style={styles.tableHeader}>
              <Text style={styles.antibodyHeader}>Antibody</Text>
              <Text style={styles.heterozygousHeader}>Rule-Out Threshold (Cells)</Text>
              <Text style={styles.actionHeader}>Action</Text>
            </View>

            {(Array.isArray(antibodies) ? antibodies : []).map((antibody) => (
              <View key={antibody.id} style={styles.tableRow}>
                <View style={styles.antibodyCell}>
                  {renderAntigenDropdown(antibody.id, antibody.name)}
                </View>
                <View style={styles.heterozygousCell}>
                  {renderThresholdDropdown(antibody.id, antibody.threshold)}
                </View>
                <View style={styles.actionCell}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteAntibody(antibody.id)}
                  >
                    <Icon name="delete" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Dropdown Portal - rendered outside of ScrollView but inside SafeAreaView */}
        {dropdownVisible && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'transparent',
              pointerEvents: 'box-none',
              zIndex: 9999,
            }}
          >
            <View
              style={[
                styles.dropdownPortal,
                {
                  position: 'absolute',
                  top: dropdownPosition.direction === 'down' ? dropdownPosition.top : undefined,
                  bottom: dropdownPosition.direction === 'up' ? (Dimensions.get('window').height - dropdownPosition.top) : undefined,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width || 150, // Provide fallback width
                  maxWidth: Dimensions.get('window').width * 0.9, // Ensure it doesn't go off screen
                }
              ]}
            >
              {/* Added a container with maxHeight and ScrollView */}
              <View
                style={[
                  styles.dropdownListContainer,
                  { maxHeight: dropdownPosition.maxHeight }
                ]}
              >
                <ScrollView
                  style={styles.dropdownListScroll}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                >
                  <View style={styles.dropdownList}>
                    {dropdownVisible && dropdownVisible.field === 'antigen' ? (
                      // Show antigen options
                      [...availableAntigens, (Array.isArray(antibodies) ? antibodies : []).find(a => a.id === dropdownVisible.id)?.name]
                        .filter(Boolean)
                        .sort() // Sort alphabetically for better usability
                        .map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.dropdownItem,
                              (Array.isArray(antibodies) ? antibodies : []).find(a => a.id === dropdownVisible?.id)?.name === option &&
                              { backgroundColor: '#f0f7fa' }
                            ]}
                            onPress={() => handleAntigenSelection(dropdownVisible.id, option)}
                          >
                            <Text style={[
                              styles.dropdownItemText,
                              (Array.isArray(antibodies) ? antibodies : []).find(a => a.id === dropdownVisible?.id)?.name === option &&
                              { color: '#5c8599', fontWeight: '500' }
                            ]}>
                              {option}
                            </Text>
                          </TouchableOpacity>
                        ))
                    ) : (
                      // Show threshold options
                      THRESHOLD_VALUES.map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.dropdownItem,
                            (Array.isArray(antibodies) ? antibodies : []).find(a => a.id === dropdownVisible?.id)?.threshold === option &&
                            { backgroundColor: '#f0f7fa' }
                          ]}
                          onPress={() => handleThresholdSelection(dropdownVisible!.id, option)}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            (Array.isArray(antibodies) ? antibodies : []).find(a => a.id === dropdownVisible?.id)?.threshold === option &&
                            { color: '#5c8599', fontWeight: '500' }
                          ]}>
                            {option}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>
          </View>
        )}

        {/* Tooltip Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={tooltipVisible}
          onRequestClose={() => setTooltipVisible(false)}
        >
          <TouchableOpacity
            style={styles.tooltipOverlay}
            activeOpacity={1}
            onPress={() => setTooltipVisible(false)}
          >
            <View style={styles.tooltipContainer}>
              <View style={styles.tooltipContent}>
                <Text style={styles.tooltipTitle}>{TOOLTIP_CONTENT[activeTooltip].title}</Text>
                <Text style={styles.tooltipText}>{TOOLTIP_CONTENT[activeTooltip].content}</Text>

                <TouchableOpacity
                  style={styles.tooltipCloseButton}
                  onPress={() => setTooltipVisible(false)}
                >
                  <Text style={styles.tooltipCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Edit Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={editModalVisible}
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Edit {editTarget?.type === 'group' ? 'Group' : 'Antigen'} Name
              </Text>
              <TextInput
                style={[styles.fieldText, { width: '100%', marginBottom: 20 }]}
                value={editInputValue}
                onChangeText={setEditInputValue}
                placeholder="Enter new name"
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.confirmButton} onPress={saveEdit}>
                  <Text style={styles.confirmButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              {/* {editTarget?.type === 'antigen' && (
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: '#ff4444', marginTop: 10 }]}
                  onPress={() => {
                    Alert.alert(
                      'Delete Antigen',
                      `Are you sure you want to delete "${editTarget.antigenName || editInputValue}"?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => deleteAntigen(editTarget.groupName, editTarget.index!),
                        },
                      ]
                    );
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: '#fff' }]}>Delete Antigen</Text>
                </TouchableOpacity>
              )} */}
            </View>
          </View>
        </Modal>

        <LogoutModal
          visible={logoutModalVisible}
          onCancel={() => setLogoutModalVisible(false)}
          onConfirm={confirmLogout}
        />

        {/* Confirmation Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={cancelGoBack}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Are you sure you want to go back?</Text>
              <Text style={styles.modalText}>All entered data will be lost!</Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={confirmGoBack}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelGoBack}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginLeft: 5,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginVertical: 20,
    fontFamily: FONTS.POPPINS_BOLD,
  },
  radio: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selected: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: '#555',
  },
  whatToDo: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginVertical: 10,
    fontFamily: FONTS.POPPINS_BOLD,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    color: '#336699',
    fontSize: 16,
    marginRight: 5,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 20,
  },
  scrollContent: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
    width: '100%',
  },
  option: {

    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,

  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#336699',
    fontWeight: '500',
    marginRight: 8,
  },
  sectionLeftTitleContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  sectionLeftTitle: {
    fontSize: 20,
    color: '#336699',
    fontWeight: '500',
    marginRight: 8,
    textAlign: 'left',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
  },
  sectionLeftSubtitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    textAlign: 'left',
  },
  fieldContainer: {
    backgroundColor: '#B8B8B8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 15,
    justifyContent: 'center',
  },
  fieldText: {
    fontSize: 16,
    color: '#1A1A1A',
    textAlign: 'left',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    position: 'relative',
    overflow: 'hidden', // Ensures the picker doesn't bleed over border radius
  },
  iconOverlay: {
    position: 'absolute',
    right: 15,
    top: 18,
  },
  chevron: {
    fontSize: 12,
    color: '#007AFF',
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
  },
  picker: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1d1a1a',
    height: 50,
    width: '100%',
    color: '#1A1A1A',
  },
  result: {
    marginTop: 20,
    fontSize: 16,
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
  scrcontainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },

  scrheader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  groupContainer: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allows antigens to wrap to next line
  },
  radioButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
    marginBottom: 4,
  },
  radioCircle: {
    height: 20,
    width: 20,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  selectedCircle: {
    borderColor: '#007AFF',
  },
  selectedInnerCircle: {
    height: 10,
    width: 10,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#333',
  },

  ggroupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  antigenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rradioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
    minWidth: 60,
  },

  antigenText: {
    fontSize: 16,
    color: '#000',
  },

  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.TEXT,
    marginVertical: 10,
    fontFamily: FONTS.POPPINS_BOLD,
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
    borderColor: '#5c8599',
  },
  itemContainer2: {
    flexDirection: 'row',
    marginVertical: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.21,
    elevation: 2,
    borderColor: '#5c8599',
  },
  itemText: {
    fontSize: 16,
    flex: 1,
    color: '#000',
  },
  buttonsContainer: {
    flexDirection: 'row',
  },
  button: {
    padding: 5,
    marginLeft: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOption: {
    marginRight: 30,
  },
  rradioOptionCont: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rradioOptionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  radioAntigenButton: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  radioButtonSelected: {
    backgroundColor: '#5c8599',
    borderColor: '#5c8599',
  },
  radioText: {
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 16,
    color: '#336699',
    marginLeft: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 10,
    marginBottom: 5,
    position: 'relative',
    width: '100%',
  },
  antibodyHeader: {
    width: '30%',
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  heterozygousHeader: {
    width: '55%',
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  actionHeader: {
    width: '15%',
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 15,
    position: 'relative',
    width: '100%',
  },
  antibodyCell: {
    width: '30%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heterozygousCell: {
    width: '55%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCell: {
    width: '15%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    width: '90%',
    position: 'relative',
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  // Dropdown Portal styles - separate from the dropdownContainer
  dropdownPortal: {
    zIndex: 9999,
    elevation: 9999,
  },
  // New container for ScrollView
  dropdownListContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 9999,
    width: '100%',
  },
  // Scrollable area
  dropdownListScroll: {
    flexGrow: 0,
  },
  // Original list style (but without border styles which moved to container)
  dropdownList: {
    width: '100%',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
  },
  selectedValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  deleteButton: {
    padding: 5,
  },
  saveButton: {
    backgroundColor: '#5c8599',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
    width: '100%',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmButton: {
    backgroundColor: '#5c8599',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 5,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 5,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 14,
  },
  // Tooltip Modal Styles
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tooltipContent: {
    padding: 20,
  },
  tooltipTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#336699',
    marginBottom: 12,
  },
  tooltipText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
    marginBottom: 20,
  },
  tooltipCloseButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#5c8599',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  tooltipCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  groupActionButton: {
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'black',
  },
  groupActionText: {
    fontSize: 11,
    color: 'black',
    fontWeight: '600',
  },
});

export default AntigenDispSettingsScreen;