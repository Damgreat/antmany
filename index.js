/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';
import 'react-native-get-random-values';
import 'react-native-quick-crypto';
import { Buffer } from 'buffer';
import { ReadableStream } from "web-streams-polyfill";
// import { Readable } from "stream";

if (typeof global.ReadableStream === "undefined") {
    global.ReadableStream = ReadableStream;
}

// Set global Buffer
global.Buffer = global.Buffer || Buffer;

// Optional: explicitly set global crypto if needed by specific libraries
if (!global.crypto) {
  global.crypto = require('react-native-quick-crypto');
}

AppRegistry.registerComponent(appName, () => App);
