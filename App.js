import React from 'react';
import { DatabaseProvider } from './src/context/DatabaseContext';
import MainNavigation from './src/navigation/MainNavigation';

const App = () => {
  return (
    <DatabaseProvider>
      <MainNavigation />
    </DatabaseProvider>
  );
};

export default App; 