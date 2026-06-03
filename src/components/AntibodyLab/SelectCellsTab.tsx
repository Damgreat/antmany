import React, { useState, useRef, useEffect, createRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Alert, ActivityIndicator, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FONTS, COLORS } from '../../constants/fonts';
import DatabaseService from '../../services/DatabaseService';

interface SelectCellsTabProps {
  handleSearchButtonPress: (antibodies: string[], ruleOutAntibodies: string[], dosages?: {[key: string]: string}, excludePanelIds?: string[]) => void;
  firstPanel?: any;
  secondPanel?: any;
}

// New interface for categorized antigens
interface AntigenCategory {
  name: string;
  antigens: string[];
}

export const SelectCellsTab: React.FC<SelectCellsTabProps> = ({
  handleSearchButtonPress,
  firstPanel,
  secondPanel
}) => {
  // State for antibodies and rule-out antibodies
  const [antibodies, setAntibodies] = useState<{id: number, name: string}[]>([{id: 1, name: ''}]);
  const [ruleOutAntibodies, setRuleOutAntibodies] = useState<{id: number, name: string, dosage: string}[]>([
    {id: 1, name: '', dosage: '1'}
  ]);
  
  // Available antigens loaded from database - flat list format
  const [availableAntigens, setAvailableAntigens] = useState<string[]>([]);
  
  // New state for categorized antigens
  const [antigenCategories, setAntigenCategories] = useState<AntigenCategory[]>([]);
  
  // State to manage which dropdown is visible
  const [dropdownVisible, setDropdownVisible] = useState<{type: 'antibody' | 'ruleOut' | 'dosage', id: number} | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Keep track of currently loaded panel IDs to exclude from search
  const [loadedPanelIds, setLoadedPanelIds] = useState<string[]>([]);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Position info for dropdown
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 150,
    maxHeight: 200,
    direction: 'down' as 'up' | 'down'
  });
  
  // Available dosage options
  const dosageOptions = ['Not Set', '1', '2'];
  
  // Store refs for all dropdown elements
  const antibodyRefs = useRef<{[key: string]: React.RefObject<TouchableOpacity>}>({});
  const ruleOutRefs = useRef<{[key: string]: React.RefObject<TouchableOpacity>}>({});
  const dosageRefs = useRef<{[key: string]: React.RefObject<TouchableOpacity>}>({});
  
  // Filter the dropdown list based on search input
  const [searchInput, setSearchInput] = useState("");
  
  // Function to categorize antigens into blood group systems
  const categorizeAntigens = (antigenList: string[]): AntigenCategory[] => {
    // Create categories structure
    const categories: AntigenCategory[] = [
      { name: "Rh System", antigens: [] },
      { name: "Kell System", antigens: [] },
      { name: "Duffy System", antigens: [] },
      { name: "Kidd System", antigens: [] },
      { name: "MNS System", antigens: [] },
      { name: "Lewis System (IgM, usually not significant)", antigens: [] },
      { name: "P System (IgM, cold-reactive)", antigens: [] },
      { name: "Lutheran System", antigens: [] },
      { name: "Colton System", antigens: [] },
      { name: "Diego System", antigens: [] },
      { name: "Other Clinically Significant or Rare", antigens: [] }
    ];
    
    // Map antigens to their respective categories
    antigenList.forEach(antigen => {
      if (["D", "C", "E", "c", "e"].includes(antigen)) {
        categories[0].antigens.push(antigen); // Rh System
      } else if (["K", "k", "Kpa", "Kpb"].includes(antigen) || antigen === "K (K1)" || antigen === "k (Cellano)") {
        categories[1].antigens.push(antigen); // Kell System
      } else if (["Fya", "Fyb"].includes(antigen)) {
        categories[2].antigens.push(antigen); // Duffy System
      } else if (["Jka", "Jkb"].includes(antigen)) {
        categories[3].antigens.push(antigen); // Kidd System
      } else if (["M", "N", "S", "s", "U"].includes(antigen)) {
        categories[4].antigens.push(antigen); // MNS System
      } else if (["Lea", "Leb"].includes(antigen)) {
        categories[5].antigens.push(antigen); // Lewis System
      } else if (antigen === "P1") {
        categories[6].antigens.push(antigen); // P System
      } else if (["Lua", "Lub"].includes(antigen)) {
        categories[7].antigens.push(antigen); // Lutheran System
      } else if (["Coa", "Cob"].includes(antigen)) {
        categories[8].antigens.push(antigen); // Colton System
      } else if (["Dia", "Dib"].includes(antigen)) {
        categories[9].antigens.push(antigen); // Diego System
      } else {
        // Other Clinically Significant or Rare antigens
        if (["Vel", "Jsa", "Jsb", "Wra", "Wrb"].includes(antigen) || antigen.includes("Bg")) {
          categories[8].antigens.push(antigen);
        } else {
          // Any unknown antigens go into Other category
          categories[8].antigens.push(antigen);
        }
      }
    });
    
    // Filter out empty categories and sort antigens within each category
    return categories
      .filter(category => category.antigens.length > 0)
      .map(category => ({
        ...category,
        antigens: category.antigens.sort()
      }));
  };
  
  // Filter categorized antigens based on search input
  const filteredCategories = searchInput
    ? antigenCategories.map(category => {
        const filteredAntigens = category.antigens.filter(antigen => 
          antigen.toLowerCase().includes(searchInput.toLowerCase())
        );
        return { ...category, antigens: filteredAntigens };
      }).filter(category => category.antigens.length > 0)
    : antigenCategories;
  
  // Initialize refs for each dropdown
  useEffect(() => {
    // Create refs for antibody dropdowns
    antibodies.forEach(item => {
      if (!antibodyRefs.current[`antibody-${item.id}`]) {
        antibodyRefs.current[`antibody-${item.id}`] = createRef();
      }
    });
    
    // Create refs for rule-out dropdowns
    ruleOutAntibodies.forEach(item => {
      if (!ruleOutRefs.current[`ruleOut-${item.id}`]) {
        ruleOutRefs.current[`ruleOut-${item.id}`] = createRef();
      }
      if (!dosageRefs.current[`dosage-${item.id}`]) {
        dosageRefs.current[`dosage-${item.id}`] = createRef();
      }
    });
  }, [antibodies, ruleOutAntibodies]);
  
  // Load antigens from database and identify currently loaded panels
  useEffect(() => {
    const loadAntigens = async () => {
      try {
        setIsLoading(true);
        // Initialize database
        await DatabaseService.initDatabase();
        
        // Get all panel files
        const screenFiles = await DatabaseService.getFiles({ type: 'ABScreen' });
        const panelFiles = await DatabaseService.getFiles({ type: 'ABIDPanel' });
        const selectCellsFiles = await DatabaseService.getFiles({ type: 'SelectCells' });
        const allFiles = [...screenFiles, ...panelFiles, ...selectCellsFiles];
        
        // Extract unique antigens from all panels
        const uniqueAntigens = new Set<string>();
        
        // Keep track of loaded panel IDs
        const panelIds: string[] = [];
        
        for (const file of allFiles) {
          try {
            const panelData = JSON.parse(file.data);
            if (panelData && Array.isArray(panelData.antigens)) {
              panelData.antigens.forEach(antigen => {
                if (typeof antigen === 'string' && antigen !== 'result' && antigen !== 'Result') {
                  uniqueAntigens.add(antigen);
                }
              });
            }
          } catch (error) {
            console.error('Error parsing panel data:', error);
          }
        }
        
        // Identify loaded panels (first and second panel)
        if (firstPanel) {
          if (firstPanel.id) {
            panelIds.push(firstPanel.id.toString());
          }
          
          // Extract antigens from first panel
          if (Array.isArray(firstPanel.antigens)) {
            firstPanel.antigens.forEach(antigen => {
              if (typeof antigen === 'string' && antigen !== 'result' && antigen !== 'Result') {
                uniqueAntigens.add(antigen);
              }
            });
          }
        }
        
        if (secondPanel) {
          if (secondPanel.id) {
            panelIds.push(secondPanel.id.toString());
          }
          
          // Extract antigens from second panel
          if (Array.isArray(secondPanel.antigens)) {
            secondPanel.antigens.forEach(antigen => {
              if (typeof antigen === 'string' && antigen !== 'result' && antigen !== 'Result') {
                uniqueAntigens.add(antigen);
              }
            });
          }
        }
        
        // Store loaded panel IDs
        setLoadedPanelIds(panelIds);
        
        // Convert to array and sort alphabetically
        const antigenList = Array.from(uniqueAntigens).sort();
        
        // Store flat list of antigens
        setAvailableAntigens(antigenList);
        
        // Create categorized antigens structure
        const categories = categorizeAntigens(antigenList);
        setAntigenCategories(categories);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading antigens:', error);
        // Set some default antigens as fallback using category structure
        const defaultCategories = [
          { 
            name: "Rh System", 
            antigens: ["D", "C", "E", "c", "e"] 
          },
          { 
            name: "Kell System", 
            antigens: ["K (K1)", "k (Cellano)", "Kp^a", "Kp^b"] 
          },
          { 
            name: "Duffy System", 
            antigens: ["Fy^a", "Fy^b"] 
          },
          { 
            name: "Kidd System", 
            antigens: ["Jk^a", "Jk^b"] 
          },
          { 
            name: "MNS System", 
            antigens: ["M", "N", "S", "s", "U"] 
          }
        ];
        
        setAntigenCategories(defaultCategories);
        setAvailableAntigens(defaultCategories.flatMap(cat => cat.antigens));
        setIsLoading(false);
      }
    };
    
    loadAntigens();
  }, [firstPanel, secondPanel]);
  
  // Toggle dropdown with perfect positioning
  const toggleDropdown = (type: 'antibody' | 'ruleOut' | 'dosage', id: number) => {
    // Close dropdown if already open for this item
    if (dropdownVisible && dropdownVisible.type === type && dropdownVisible.id === id) {
      setDropdownVisible(null);
      return;
    }
    
    // Reset search input when opening a new dropdown
    if (type !== 'dosage') {
      setSearchInput('');
    }
    
    // Get the appropriate ref based on type and id
    let elementRef: React.RefObject<TouchableOpacity> | null = null;
    
    if (type === 'antibody') {
      elementRef = antibodyRefs.current[`antibody-${id}`];
    } else if (type === 'ruleOut') {
      elementRef = ruleOutRefs.current[`ruleOut-${id}`];
    } else if (type === 'dosage') {
      elementRef = dosageRefs.current[`dosage-${id}`];
    }
    
    if (!elementRef || !elementRef.current) {
      console.error('No valid ref for dropdown positioning');
      return;
    }
    
    // Use the ref to measure the element position with precise coordinates
    elementRef.current.measureInWindow((x, y, width, height) => {
      const windowHeight = Dimensions.get('window').height;
      const windowWidth = Dimensions.get('window').width;
      
      // Calculate available space
      const spaceBelow = windowHeight - y - height;
      const spaceAbove = y;
      
      // Determine dropdown direction and position
      let direction: 'down' | 'up' = 'down';
      let dropdownTop = y + height - 16; // Position immediately below the trigger
      let maxHeight = 300; // Default max height
      
      // If not enough space below and more space above, show above
      // console.log(spaceBelow, spaceAbove);
      if (spaceBelow < 150 && spaceAbove > 150) {
        direction = 'up';
        maxHeight = Math.min(300, spaceAbove - 50);
      } else {
        direction = 'down';
        // Show below but limit height
        maxHeight = Math.min(300, spaceBelow - 70);
        dropdownTop = y - height - 20;
      }
      
      // Match dropdown width exactly to the trigger element width for perfect alignment
      const dropdownWidth = width;
      
      // Set final position with perfect alignment
      setDropdownPosition({
        top: dropdownTop,
        left: x,
        width: dropdownWidth,
        maxHeight,
        direction
      });
      
      // Show the dropdown
      setDropdownVisible({ type, id });
    });
  };
  
  // Handle selecting an antigen
  const handleAntigenSelection = (id: number, antigen: string) => {
    if (dropdownVisible?.type === 'antibody') {
      setAntibodies(prev => 
        prev.map(item => item.id === id ? { ...item, name: antigen } : item)
      );
    } else if (dropdownVisible?.type === 'ruleOut') {
      setRuleOutAntibodies(prev => 
        prev.map(item => item.id === id ? { ...item, name: antigen } : item)
      );
    }
    setDropdownVisible(null);
  };
  
  // Handle selecting a dosage
  const handleDosageSelection = (id: number, dosage: string) => {
    setRuleOutAntibodies(prev => 
      prev.map(item => item.id === id ? { ...item, dosage } : item)
    );
    setDropdownVisible(null);
  };
  
  // Add a new antibody row
  const addAntibody = () => {
    const newId = antibodies.length > 0 
      ? Math.max(...antibodies.map(a => a.id)) + 1 
      : 1;
    setAntibodies([...antibodies, { id: newId, name: '' }]);
    
    // Create a ref for the new item
    antibodyRefs.current[`antibody-${newId}`] = createRef();
  };
  
  // Add a new rule-out antibody row
  const addRuleOutAntibody = () => {
    const newId = ruleOutAntibodies.length > 0 
      ? Math.max(...ruleOutAntibodies.map(a => a.id)) + 1 
      : 1;
    setRuleOutAntibodies([...ruleOutAntibodies, { id: newId, name: '', dosage: '1' }]);
    
    // Create refs for the new items
    ruleOutRefs.current[`ruleOut-${newId}`] = createRef();
    dosageRefs.current[`dosage-${newId}`] = createRef();
  };
  
  // Delete an antibody
  const deleteAntibody = (id: number) => {
    if (antibodies.length > 1) {
      setAntibodies(antibodies.filter(item => item.id !== id));
      // Remove the ref
      delete antibodyRefs.current[`antibody-${id}`];
    } else {
      // Keep at least one row, just clear it
      setAntibodies([{ id: 1, name: '' }]);
    }
  };
  
  // Delete a rule-out antibody
  const deleteRuleOutAntibody = (id: number) => {
    if (ruleOutAntibodies.length > 1) {
      setRuleOutAntibodies(ruleOutAntibodies.filter(item => item.id !== id));
      // Remove the refs
      delete ruleOutRefs.current[`ruleOut-${id}`];
      delete dosageRefs.current[`dosage-${id}`];
    } else {
      // Keep at least one row, just clear it
      setRuleOutAntibodies([{ id: 1, name: '', dosage: '1' }]);
    }
  };
  
  // Handle search button press
  const onSearch = () => {
    // Get valid antibodies (non-empty)
    const validAntibodies = antibodies
      .filter(item => item.name.trim() !== '')
      .map(item => item.name);
    
    // Get valid rule-out antibodies (non-empty)
    const validRuleOutAntibodies = ruleOutAntibodies
      .filter(item => item.name.trim() !== '')
      .map(item => item.name);
    
    if (validAntibodies.length === 0) {
      Alert.alert('Missing Information', 'Please select at least one presumptive antibody to search');
      return;
    }
    
    // Create dosage map for rule-out antibodies
    const dosageMap: {[key: string]: string} = {};
    ruleOutAntibodies
      .filter(item => item.name.trim() !== '')
      .forEach(item => {
        dosageMap[item.name] = item.dosage;
      });
    
    // Call the parent handler with selected antibodies, dosage information, and excludePanelIds
    handleSearchButtonPress(
      validAntibodies, 
      validRuleOutAntibodies, 
      dosageMap,
      loadedPanelIds
    );
  };
  
  // Render antibody dropdown with ref
  const renderAntibodyDropdown = (id: number, type: 'antibody' | 'ruleOut') => {
    const antibodyItem = type === 'antibody' 
      ? antibodies.find(item => item.id === id) 
      : ruleOutAntibodies.find(item => item.id === id);
    
    const selectedValue = antibodyItem?.name || 'Select antibody';
    const isOpen = dropdownVisible?.type === type && dropdownVisible?.id === id;
    
    // Get the appropriate ref
    const refKey = type === 'antibody' ? `antibody-${id}` : `ruleOut-${id}`;
    const refObj = type === 'antibody' ? antibodyRefs.current[refKey] : ruleOutRefs.current[refKey];
    
    // Dynamic styles for active dropdown
    const activeStyles = isOpen ? {
      borderColor: '#5c8599',
      ...(dropdownPosition.direction === 'down' ? {
        borderBottomWidth: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      } : {
        borderTopWidth: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
      })
    } : {};
    
    return (
      <TouchableOpacity
        ref={refObj}
        style={[styles.dropdownSelector, activeStyles]}
        onPress={() => toggleDropdown(type, id)}
      >
        <Text style={[
          styles.selectedValue,
          antibodyItem?.name === '' && { color: '#999' }
        ]}>
          {selectedValue === '' ? 'Select antibody' : selectedValue}
        </Text>
        <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={16} color="#666" />
      </TouchableOpacity>
    );
  };
  
  // Render dosage dropdown with ref
  const renderDosageDropdown = (id: number) => {
    const ruleOutAntibody = ruleOutAntibodies.find(item => item.id === id);
    const selectedValue = ruleOutAntibody?.dosage || 'Not Set';
    const isOpen = dropdownVisible?.type === 'dosage' && dropdownVisible?.id === id;
    
    // Get the ref
    const refKey = `dosage-${id}`;
    const refObj = dosageRefs.current[refKey];
    
    // Dynamic styles for active dropdown
    const activeStyles = isOpen ? {
      borderColor: '#5c8599',
      ...(dropdownPosition.direction === 'down' ? {
        borderBottomWidth: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      } : {
        borderTopWidth: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
      })
    } : {};
    
    return (
      <TouchableOpacity
        ref={refObj}
        style={[styles.dropdownSelector, activeStyles]}
        onPress={() => toggleDropdown('dosage', id)}
      >
        <Text style={styles.selectedValue}>{selectedValue}</Text>
        <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={16} color="#666" />
      </TouchableOpacity>
    );
  };
  
  // Render category header for dropdown
  const renderCategoryHeader = (categoryName: string) => {
    return (
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryHeaderText}>{categoryName}</Text>
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        ref={scrollViewRef}
        onScroll={(event) => {
          setScrollOffset(event.nativeEvent.contentOffset.y);
          // Close dropdown when scrolling
          if (dropdownVisible) {
            setDropdownVisible(null);
          }
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.selectCellsContent}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Loading available antibodies...</Text>
            </View>
          ) : (
            <View style={styles.antibodyColumnsContainer}>
              {/* Left Column - Suspected Antibody/ies */}
              <View style={styles.antibodyColumn}>
                <Text style={styles.antibodyColumnTitle}>Presumptive Antibody</Text>
                
                {antibodies.map((item, index) => (
                  <View key={`antibody-${item.id}`} style={styles.antibodyRow}>
                    <Text style={styles.rowNumber}>{index + 1}.</Text>
                    <View style={styles.inputContainer}>
                      <View style={styles.dropdownContainer}>
                        {renderAntibodyDropdown(item.id, 'antibody')}
                      </View>
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => deleteAntibody(item.id)}
                      >
                        <Icon name="delete" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                
                <TouchableOpacity style={styles.addMoreButton} onPress={addAntibody}>
                  <Icon name="plus-circle-outline" size={18} color="#5d8aa8" />
                  <Text style={styles.addMoreText}>Add more</Text>
                </TouchableOpacity>
              </View>

              {/* Right Column - Antibodies to rule-out */}
              <View style={styles.antibodyColumn}>
                <Text style={styles.antibodyColumnTitle}>Exclusions Dosage</Text>
                
                {ruleOutAntibodies.map((item, index) => (
                  <View key={`rule-out-${item.id}`} style={styles.antibodyRow}>
                    <Text style={styles.rowNumber}>{index + 1}.</Text>
                    <View style={styles.inputContainer}>
                      <View style={styles.dropdownContainer}>
                        {renderAntibodyDropdown(item.id, 'ruleOut')}
                      </View>
                      <View style={styles.dosageContainer}>
                        {renderDosageDropdown(item.id)}
                      </View>
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => deleteRuleOutAntibody(item.id)}
                      >
                        <Icon name="delete" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                
                <TouchableOpacity style={styles.addMoreButton} onPress={addRuleOutAntibody}>
                  <Icon name="plus-circle-outline" size={18} color="#5d8aa8" />
                  <Text style={styles.addMoreText}>Add more</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={onSearch}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
          
          {loadedPanelIds.length > 0 && (
            <Text style={styles.searchInfoText}>
              Search will exclude {loadedPanelIds.length} currently loaded panel{loadedPanelIds.length > 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </ScrollView>
      
      {/* Perfect dropdown portal with exact positioning */}
      {dropdownVisible && (
        <View style={styles.portalContainer}>
          <TouchableOpacity
            style={styles.portalOverlay}
            onPress={() => setDropdownVisible(null)}
            activeOpacity={1}
          />
          <View
            style={[
              styles.dropdownPortal,
              {
                position: 'absolute',
                // For up direction, position above the element; for down, position below
                top: dropdownPosition.direction === 'down' ? dropdownPosition.top : undefined,
                bottom: dropdownPosition.direction === 'up' ? 
                  (Dimensions.get('window').height - dropdownPosition.top + 1) : undefined,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              },
              // Add dynamic border radius based on direction
              dropdownPosition.direction === 'down' ? {
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              } : {
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
              }
            ]}
          >
            {dropdownVisible.type !== 'dosage' && (
              <View style={[
                styles.searchInputContainer,
                // Conditional styles based on direction
                dropdownPosition.direction === 'up' ? {
                  borderTopWidth: 0,
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                } : {}
              ]}>
                <Icon name="magnify" size={18} color="#666" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search antibodies..."
                  placeholderTextColor="#999"
                  value={searchInput}
                  onChangeText={setSearchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchInput.length > 0 && (
                  <TouchableOpacity 
                    style={styles.clearSearchButton} 
                    onPress={() => setSearchInput("")}
                  >
                    <Icon name="close-circle" size={16} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={[
              styles.dropdownListContainer, 
              { maxHeight: dropdownPosition.maxHeight },
              // Conditional styles based on direction and type
              dropdownVisible.type !== 'dosage' ? {
                borderTopWidth: 0,
              } : (dropdownPosition.direction === 'up' ? {
                borderTopWidth: 0,
              } : {
                borderTopWidth: 1,
              })
            ]}>
              <ScrollView
                style={styles.dropdownListScroll}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.dropdownList}>
                  {dropdownVisible.type === 'dosage' ? (
                    // Dosage options
                    dosageOptions.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.dropdownItem,
                          ruleOutAntibodies.find(a => a.id === dropdownVisible?.id)?.dosage === option.toString() &&
                          styles.dropdownItemSelected
                        ]}
                        onPress={() => handleDosageSelection(dropdownVisible.id, option.toString())}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          ruleOutAntibodies.find(a => a.id === dropdownVisible?.id)?.dosage === option.toString() &&
                          styles.dropdownItemTextSelected
                        ]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    // Categorized antigen options
                    filteredCategories.length > 0 ? (
                      filteredCategories.map((category, categoryIndex) => (
                        <View key={`category-${categoryIndex}`}>
                          {/* Render category header */}
                          {renderCategoryHeader(category.name)}
                          
                          {/* Render antigens in this category */}
                          {category.antigens.map((antigen) => {
                            const currentSelection = dropdownVisible.type === 'antibody'
                              ? antibodies.find(a => a.id === dropdownVisible?.id)?.name
                              : ruleOutAntibodies.find(a => a.id === dropdownVisible?.id)?.name;
                              
                            return (
                              <TouchableOpacity
                                key={antigen}
                                style={[
                                  styles.dropdownItem,
                                  currentSelection === antigen && styles.dropdownItemSelected
                                ]}
                                onPress={() => handleAntigenSelection(dropdownVisible.id, antigen)}
                              >
                                <Text style={[
                                  styles.dropdownItemText,
                                  currentSelection === antigen && styles.dropdownItemTextSelected
                                ]}>
                                  {antigen}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))
                    ) : (
                      <View style={styles.noResultsContainer}>
                        <Text style={styles.noResultsText}>No antigens found</Text>
                      </View>
                    )
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  scrollContainer: {
    flex: 1,
    padding: 10,
  },
  selectCellsContent: {
    padding: 20,
    paddingBottom: 30,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.TEXT,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  antibodyColumnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  antibodyColumn: {
    alignItems: 'center',
    width: '48%',
  },
  antibodyColumnTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  antibodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
  },
  rowNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
    width: 20,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownContainer: {
    flex: 1,
    marginRight: 10,
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
  selectedValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  dosageContainer: {
    width: '30%',
    marginRight: 10,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#5d8aa8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  addMoreText: {
    color: '#5d8aa8',
    fontSize: 14,
    marginLeft: 5,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  searchButton: {
    backgroundColor: '#5d8aa8',
    alignSelf: 'center',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 30,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  searchInfoText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  // Category header styles
  categoryHeader: {
    backgroundColor: '#f2f6f9',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    width: '100%',
  },
  categoryHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#444',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  // Perfect dropdown portal styles for exact positioning
  portalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
    zIndex: 9999,
  },
  portalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  dropdownPortal: {
    backgroundColor: 'white',
    borderRadius: 4,
    overflow: 'hidden',
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 1,
    borderColor: '#5c8599',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 10,
    height: 40,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    height: 40,
    fontFamily: FONTS.POPPINS_REGULAR,
    marginLeft: 5,
  },
  searchIcon: {
    marginRight: 5,
  },
  clearSearchButton: {
    padding: 4,
  },
  dropdownListContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  dropdownListScroll: {
    flexGrow: 0,
  },
  dropdownList: {
    width: '100%',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  dropdownItemSelected: {
    backgroundColor: '#f0f7fa',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  dropdownItemTextSelected: {
    color: '#5c8599',
    fontWeight: '500',
  },
  noResultsContainer: {
    padding: 15,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#999',
    fontSize: 14,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
});

export default SelectCellsTab;