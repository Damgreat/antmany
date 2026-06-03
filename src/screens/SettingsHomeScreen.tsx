import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { FONTS, COLORS } from '../constants/fonts';
import CustomText from '../components/CustomText';

type SettingsHomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

const SettingsHomeScreen: React.FC<SettingsHomeScreenProps> = ({ navigation }) => {
  const [orientation, setOrientation] = useState(
    Dimensions.get('window').width > Dimensions.get('window').height ? 'landscape' : 'portrait'
  );

  // Set up orientation change detection
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setOrientation(window.width > window.height ? 'landscape' : 'portrait');
    });

    return () => subscription.remove();
  }, []);

  const menuItems = [
    {
      text: "Exclusion Criteria",
      screen: "AntigenDispSettings" as const,
      icon: "clipboard-text-outline"
    },
    {
      text: "Antigrams",
      screen: "AntigenDispSettings" as const,
      icon: "format-list-bulleted"
    },
  ];

  const handleGoBack = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const handleMenuPress = (screen: string) => {
    // @ts-ignore - We know these screens exist in our navigation
    navigation.navigate(screen);
  };

  // const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // const handleLogout = () => {
  //   setLogoutModalVisible(true);
  // };
  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'SignIn' }],
    });
  };

  // Render portrait view
  const renderPortraitView = () => (
    <>
      {/* Header */}
      {/* <View style={styles.header}>
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
      </View> */}

      <View style={styles.divider} />
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/nexid_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Menu Buttons - Vertical Layout */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuButton}
            onPress={() => handleMenuPress(item.screen)}
          >
            <Icon name={item.icon} size={24} color="#fff" style={styles.menuIcon} />
            <CustomText variant="medium" style={styles.menuText}>{item.text}</CustomText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout Button */}
      {/* <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleGoBack}
      >
        <CustomText variant="regular" style={styles.logoutText}>Go Back</CustomText>
      </TouchableOpacity> */}
    </>
  );

  // Render landscape view (original grid layout)
  const renderLandscapeView = () => (
    <>
      {/* Logo Section with Logout */}
      <View style={styles.topSection}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/nexid_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <TouchableOpacity
          style={styles.logoutButtonLandscape}
          onPress={handleGoBack}
        >
          <CustomText variant="regular" style={styles.logoutTextLandscape}>Go Back</CustomText>
        </TouchableOpacity>
      </View>

      {/* Menu Grid */}
      <View style={styles.menuGridLandscape}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuTileLandscape}
            onPress={() => handleMenuPress(item.screen)}
          >
            <Icon name={item.icon} size={40} color="#fff" style={styles.menuIconLandscape} />
            <CustomText variant="medium" style={styles.menuTextLandscape}>{item.text}</CustomText>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    // <SafeAreaView style={[
    //   styles.container,
    //   orientation === 'landscape' ? styles.containerLandscape : styles.containerPortrait
    // ]}>
    //   {orientation === 'landscape' ? renderLandscapeView() : renderPortraitView()}
    <SafeAreaView style={[styles.container]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Icon name="arrow-left" size={24} color={COLORS.PRIMARY} />
          <CustomText variant="medium" style={styles.backText}>Go back</CustomText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <CustomText variant="medium" style={styles.logoutText}>Log out</CustomText>
          <Icon name="logout" size={24} color={COLORS.PRIMARY} />
        </TouchableOpacity>
      </View>
      <View style={[
        orientation === 'landscape' ? styles.containerLandscape : styles.containerPortrait
      ]}>
        {orientation === 'landscape' ? renderLandscapeView() : renderPortraitView()}
        {/* Footer */}

        <View style={[
          styles.footer,
          orientation === 'landscape' ? styles.footerLandscape : styles.footerPortrait
        ]}>
          <CustomText variant="regular" style={styles.footerText}>Innovation by Dream Forge Workshop</CustomText>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Common styles
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.BACKGROUND,
  },
  containerPortrait: {
    flex: 1,
    backgroundColor: '#F5F5F5', // Light gray background like in the image
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerLandscape: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    padding: 0,
  },
  logo: {
    width: 150,
    height: 80,
  },
  footerText: {
    fontSize: 14,
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
  },
  backText: {
    color: '#336699',
    fontSize: 16,
    marginLeft: 5,
  },
  // Portrait mode styles
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  menuContainer: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 20,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B96AC', // Blue-gray color from the image
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
    height: 60,
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
  },
  logoutText: {
    color: '#333333',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 20,
  },
  footerPortrait: {
    position: 'absolute',
    bottom: 20,
    alignItems: 'center',
  },

  // Landscape mode styles (original)
  topSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 30,
    position: 'relative',
  },
  logoutButtonLandscape: {
    position: 'absolute',
    top: 30,
    right: 30,
  },
  logoutTextLandscape: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  menuGridLandscape: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
  },
  menuTileLandscape: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: COLORS.SECONDARY,
    borderRadius: 10,
    margin: '1%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIconLandscape: {
    marginBottom: 15,
  },
  menuTextLandscape: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    fontFamily: FONTS.POPPINS_MEDIUM,
    textAlign: 'center',
  },
  footerLandscape: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footer: {
    alignItems: 'center',
  },
});

export default SettingsHomeScreen;
