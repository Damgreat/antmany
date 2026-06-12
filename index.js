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

// AWS SDK v3 (Textract) requires TextEncoder/TextDecoder — not provided by Hermes/RN
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    constructor(encoding = 'utf-8') {
      this.encoding = encoding;
    }
    decode(input) {
      if (input == null) {
        return '';
      }
      if (input instanceof ArrayBuffer) {
        return Buffer.from(input).toString('utf8');
      }
      if (ArrayBuffer.isView(input)) {
        return Buffer.from(input.buffer, input.byteOffset, input.byteLength).toString(
          'utf8',
        );
      }
      return Buffer.from(input).toString('utf8');
    }
  };
}

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(input = '') {
      const buf = Buffer.from(String(input), 'utf8');
      return Uint8Array.from(buf);
    }
  };
}

// Optional: explicitly set global crypto if needed by specific libraries
if (!global.crypto) {
  global.crypto = require('react-native-quick-crypto');
}

AppRegistry.registerComponent(appName, () => App);
