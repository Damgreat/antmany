import { StackNavigationOptions } from '@react-navigation/stack';

export const defaultStackNavOptions: StackNavigationOptions = {
  headerBackTitleVisible: false,
  headerLeft: () => null,
  headerStyle: {
    backgroundColor: '#f4511e',
  },
  headerTintColor: '#fff',
  headerTitleStyle: {
    fontWeight: 'bold',
  },
};
