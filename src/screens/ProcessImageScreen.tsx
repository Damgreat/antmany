import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Asset, launchImageLibrary} from 'react-native-image-picker';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../navigation';
import {FONTS, COLORS} from '../constants/fonts';
import CustomText from '../components/CustomText';
import {ScannerService} from '../services/scannerService';
import {Camera, useCameraDevices} from 'react-native-vision-camera';
//import fs from 'react-native-fs';
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3';
const API_ENDPOINT =
  'https://8pshngn4xe.execute-api.us-west-2.amazonaws.com/default/getTextractDownloadUrl';
import RNFS from 'react-native-fs';
import {Picker} from '@react-native-picker/picker';
import * as ConstAntigens from '../services/AntigenData';
import {
  AWS_ACCESS_KEY_ID,
  AWS_BUCKET_NAME,
  AWS_REGION,
  AWS_SECRET_ACCESS_KEY,
} from '@env';
import {buildTextractResponseKeys} from '../utils/textractResponseKeys';
import {
  getTextractKeysForAttempt,
  getTextractPollDelayMs,
  isTextractResponseNotReady,
  TEXTRACT_INITIAL_WAIT_MS,
  TEXTRACT_POLL_MAX_ATTEMPTS,
} from '../utils/textractPolling';
import ImageResizer from 'react-native-image-resizer';
import {analyzeDocumentFromS3} from '../services/textractAnalyzeService';
import {ocrDebugLog} from '../utils/ocrDebugLog';
import {enhanceForOCR} from '../utils/imageEnhancement';
import {
  logTextractParseOutcome,
  persistTextractResponse,
  type TextractCaptureMeta,
} from '../utils/textractResponseLog';

type ProcessImageScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ProcessImage'>;
  route: RouteProp<RootStackParamList, 'ProcessImage'>;
};

// Define a fallback color for disabled state
const DISABLED_COLOR = '#cccccc';
const DEFAULT_S3_REGION = 'us-west-2';
const MAX_FETCH_RETRY = 3;
const FETCH_RETRY_DELAY_MS = 1500;
const MAX_UPLOAD_DIMENSION = 2800;
const UPLOAD_JPEG_QUALITY = 85;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
let s3ClientCache: S3Client | null = null;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const getRequiredS3Config = () => {
  const bucket = AWS_BUCKET_NAME?.trim();
  const accessKey = AWS_ACCESS_KEY_ID?.trim();
  const secretKey = AWS_SECRET_ACCESS_KEY?.trim();
  const region = AWS_REGION?.trim() || DEFAULT_S3_REGION;

  if (!bucket || !accessKey || !secretKey) {
    throw new Error(
      'Missing S3 configuration. Set AWS_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION in your .env file.',
    );
  }

  return {
    bucket,
    accessKey,
    secretKey,
    region,
  };
};

const getS3Client = () => {
  const s3Config = getRequiredS3Config();

  if (!s3ClientCache) {
    s3ClientCache = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKey,
        secretAccessKey: s3Config.secretKey,
      },
    });
  }

  return {
    client: s3ClientCache,
    config: s3Config,
  };
};

const getFileExtension = (asset: Asset) => {
  const fileName = asset.fileName?.trim();
  if (fileName && fileName.includes('.')) {
    return fileName.split('.').pop()?.toLowerCase() || 'jpg';
  }

  const mimeSubtype = asset.type?.split('/').pop()?.toLowerCase();
  if (mimeSubtype === 'jpeg') {
    return 'jpg';
  }

  return mimeSubtype || 'jpg';
};

const buildS3FileName = (asset: Asset) => {
  const rawFileName = asset.fileName?.trim();
  const sanitizedName = rawFileName
    ? rawFileName.replace(/\s+/g, '-')
    : `upload.${getFileExtension(asset)}`;

  return `pix-${Date.now()}-${sanitizedName}`;
};

const resolveAssetUriForUpload = (asset: Asset) => {
  const assetUri = asset.uri?.trim();
  if (assetUri) {
    return assetUri;
  }

  const originalPath = asset.originalPath?.trim();
  if (Platform.OS === 'android' && originalPath) {
    return originalPath.startsWith('file://')
      ? originalPath
      : `file://${originalPath}`;
  }

  throw new Error('Selected image does not contain a valid file URI.');
};

const normalizeLocalFilePath = (uri: string) =>
  uri.startsWith('file://') ? decodeURIComponent(uri.replace('file://', '')) : uri;

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const hasTextractBlocks = (
  payload: unknown,
): payload is {Blocks: unknown[]} => {
  return Array.isArray((payload as {Blocks?: unknown[]})?.Blocks);
};

const hasExtractedTextPayload = (
  payload: unknown,
): payload is {data: string} => {
  return typeof (payload as {data?: unknown})?.data === 'string';
};

const describeTextractPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return 'Downloaded OCR file is not a JSON object.';
  }

  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record);
  const status =
    typeof record.JobStatus === 'string'
      ? ` JobStatus=${record.JobStatus}.`
      : '';
  const message =
    typeof record.message === 'string'
      ? ` Message=${record.message}.`
      : typeof record.error === 'string'
        ? ` Error=${record.error}.`
        : '';

  return `Downloaded OCR JSON does not contain Textract Blocks.${status}${message} Keys: ${
    keys.length ? keys.join(', ') : 'none'
  }.`;
};

type OcrDownloadResult =
  | {
      kind: 'textract';
      rawJson: string;
      captureMeta: TextractCaptureMeta | null;
    }
  | {
      kind: 'text';
      rawJson: string;
      extractedText: string;
      captureMeta: TextractCaptureMeta | null;
    };

const ProcessImageScreen: React.FC<ProcessImageScreenProps> = ({
  navigation,
  route,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Processing Image...');
  const [showFileSelectionModal, setShowFileSelectionModal] = useState(false);
  const [showRawFolderModal, setShowRawFolderModal] = useState(false);
  const [orientation, setOrientation] = useState(
    Dimensions.get('window').width > Dimensions.get('window').height
      ? 'landscape'
      : 'portrait',
  );

  // New state variables for the two images
  const [cameraActive, setCameraActive] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const cameraRef = React.useRef<Camera>(null);
  const hasOpenedGalleryFromRoute = React.useRef(false);
  const [manuchoice, setManuChoice] = useState('CUSTOM'); //<AntigenManufacturer>("DEFAULT");

  // Camera setup like in ScannerScreen
  const devices = useCameraDevices();
  const device = React.useMemo(() => {
    return devices.find(d => d.position === 'back');
  }, [devices]);

  // Create reference to scanner service
  const scannerService = React.useRef(new ScannerService()).current;

  // Set up orientation change detection
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({window}) => {
      setOrientation(window.width > window.height ? 'landscape' : 'portrait');
    });

    return () => subscription.remove();
  }, []);

  // Check camera permissions on mount like in ScannerScreen
  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    if (!route.params?.showGallery || hasOpenedGalleryFromRoute.current) {
      return;
    }

    hasOpenedGalleryFromRoute.current = true;
    handlePickUploadAndProcess();
    // This effect only reacts to the route flag. The upload handler intentionally
    // stays outside the dependency list to avoid reopening the picker on rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.showGallery]);

  const checkPermissions = async () => {
    const cameraPermission = await Camera.requestCameraPermission();
    setHasPermission(cameraPermission === 'granted');
  };

  const toggleCamera = () => {
    setCameraActive(prev => !prev);
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{name: 'SignIn'}],
    });
  };

  // Parse Textract JSON and navigate to VerifyPanelScreen
  const processImageResult = async (
    jsonText: string,
    captureMeta: TextractCaptureMeta | null = null,
  ) => {
    try {
      if (!jsonText || jsonText.trim() === '') {
        Alert.alert('Error', 'No OCR output received. Please try again.', [
          {text: 'OK'},
        ]);
        return;
      }

      const parseResult = scannerService.parseTextractJson(
        jsonText,
        manuchoice || 'CUSTOM',
      );

      if (captureMeta) {
        const phenotypeFilled = parseResult.panelData.cells.filter(cell =>
          String(cell.phenotype ?? '').trim(),
        ).length;
        const donorFilled = parseResult.panelData.cells.filter(cell => {
          const donor = String(cell.donorNumber ?? '').trim();
          return donor.length > 0 && donor !== String(cell.cellId ?? '').trim();
        }).length;

        await logTextractParseOutcome(captureMeta, {
          manufacturer:
            parseResult.panelData.metadata.manufacturer || manuchoice || 'CUSTOM',
          cellCount: parseResult.panelData.cells.length,
          extractionAccuracy: parseResult.metrics.extractionAccuracy ?? 0,
          overallConfidence: parseResult.overallConfidence,
          phenotypeFilled,
          donorFilled,
          parseErrorCount: parseResult.parseErrors.length,
          parseErrors: parseResult.parseErrors.slice(0, 10),
        });
      }

      if (
        parseResult.parseErrors.length > 0 &&
        parseResult.panelData.cells.length === 0
      ) {
        Alert.alert(
          'OCR Failed',
          'Could not extract any data from the image.\n\n' +
            parseResult.parseErrors.join('\n'),
          [{text: 'OK'}],
        );
        return;
      }

      navigation.navigate('VerifyPanel', {
        panelData: parseResult.panelData,
        overallConfidence: parseResult.overallConfidence,
        cellConfidences: parseResult.cellConfidences,
        lowConfidenceCells: parseResult.lowConfidenceCells,
        parseErrors: parseResult.parseErrors,
        metrics: parseResult.metrics,
        manufacturer:
          parseResult.panelData.metadata.manufacturer || manuchoice || 'CUSTOM',
      });
    } catch (error) {
      console.error('Image processing error:', error);
      Alert.alert(
        'Error',
        'Failed to process the image. Please try again.\n\nDetail: ' +
          String(error),
        [{text: 'OK'}],
      );
    }
  };

  function sleep(delay: number) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async function fetchRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    attempts: number = MAX_FETCH_RETRY,
  ) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(input, init);
        if (response.ok || attempt === attempts) {
          return response;
        }

        lastError = new Error(
          `Request failed with status ${response.status} ${response.statusText}`,
        );
      } catch (error) {
        lastError = error;
      }

      if (attempt < attempts) {
        await sleep(FETCH_RETRY_DELAY_MS);
      }
    }

    throw new Error(getErrorMessage(lastError));
  }

  async function prepareImageForUpload(localPath: string): Promise<string> {
    const sourceUri = localPath.startsWith('file://')
      ? localPath
      : `file://${localPath}`;

    let workingPath = localPath;
    try {
      const enhanced = await enhanceForOCR(sourceUri);
      workingPath = normalizeLocalFilePath(enhanced.uri);
    } catch (error) {
      console.warn('OCR image enhancement skipped, using original:', error);
    }

    const resizePass = async (maxDim: number, quality: number) => {
      const resized = await ImageResizer.createResizedImage(
        workingPath.startsWith('file://') ? workingPath : `file://${workingPath}`,
        maxDim,
        maxDim,
        'JPEG',
        quality,
        0,
        undefined,
        false,
      );
      return normalizeLocalFilePath(resized.uri);
    };

    try {
      workingPath = await resizePass(MAX_UPLOAD_DIMENSION, UPLOAD_JPEG_QUALITY);
      const stat = await RNFS.stat(workingPath);
      if (stat.size > MAX_UPLOAD_BYTES) {
        workingPath = await resizePass(2000, 75);
      }
      return workingPath;
    } catch (error) {
      console.warn('Image resize skipped, using enhanced/original:', error);
      return workingPath;
    }
  }

  async function downloadTextractOutput(
    fileKeys: string[],
    uploadedKey: string,
    onProgress?: (message: string) => void,
  ): Promise<OcrDownloadResult> {
    let lastFailureMessage = 'Textract output was not ready.';

    const tryDownloadKey = async (fileKey: string): Promise<OcrDownloadResult | null> => {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({fileKey}),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const apiError =
          errorData?.error || errorData?.message || response.statusText;
        lastFailureMessage = `Textract URL request failed for ${fileKey}: ${apiError}`;
        // #region agent log
        ocrDebugLog(
          'ProcessImageScreen.tsx:tryDownloadKey',
          'Textract URL API non-OK',
          {
            fileKey,
            status: response.status,
            apiError,
            notReady: isTextractResponseNotReady(response.status, apiError),
          },
          'H2',
        );
        // #endregion
        if (!isTextractResponseNotReady(response.status, apiError)) {
          throw new Error(lastFailureMessage);
        }
        return null;
      }

      const data = await response.json();
      const downloadUrl =
        typeof data?.downloadUrl === 'string' ? data.downloadUrl : null;

      if (!downloadUrl) {
        lastFailureMessage = `Textract URL response for ${fileKey} did not include downloadUrl.`;
        return null;
      }

      const fileResponse = await fetchRetry(downloadUrl);
      if (!fileResponse.ok) {
        lastFailureMessage = `Textract download failed for ${fileKey}: ${fileResponse.status} ${fileResponse.statusText}`;
        return null;
      }

      const textractOutput = await fileResponse.text();
      const parsedPayload = tryParseJson(textractOutput);

      if (!parsedPayload) {
        lastFailureMessage = `Downloaded OCR file for ${fileKey} is not valid JSON.`;
        return null;
      }

      const captureMeta = await persistTextractResponse(textractOutput, {
        source: hasTextractBlocks(parsedPayload) ? 'async_poll' : 'plain_text',
        uploadedKey,
        responseKey: fileKey,
        manufacturer: manuchoice || 'CUSTOM',
      });

      if (hasTextractBlocks(parsedPayload) && parsedPayload.Blocks.length > 0) {
        console.log('Textract block output ready from:', fileKey);
        return {kind: 'textract', rawJson: textractOutput, captureMeta};
      }

      if (hasExtractedTextPayload(parsedPayload)) {
        console.log('OCR text output ready from:', fileKey);
        return {
          kind: 'text',
          rawJson: textractOutput,
          extractedText: parsedPayload.data,
          captureMeta,
        };
      }

      lastFailureMessage = describeTextractPayload(parsedPayload);
      return null;
    };

    for (let attempt = 1; attempt <= TEXTRACT_POLL_MAX_ATTEMPTS; attempt += 1) {
      const keysThisRound = getTextractKeysForAttempt(fileKeys, attempt);
      onProgress?.(`Waiting for OCR… (${attempt}/${TEXTRACT_POLL_MAX_ATTEMPTS})`);
      // #region agent log
      ocrDebugLog(
        'ProcessImageScreen.tsx:downloadTextractOutput',
        'Poll round start',
        {attempt, keysThisRound, uploadedKey},
        'H3',
      );
      // #endregion

      const roundResults = await Promise.allSettled(
        keysThisRound.map(async fileKey => {
          try {
            return await tryDownloadKey(fileKey);
          } catch (error) {
            lastFailureMessage = `Failed to fetch Textract output for ${fileKey}: ${getErrorMessage(error)}`;
            throw error;
          }
        }),
      );

      for (const roundResult of roundResults) {
        if (roundResult.status === 'fulfilled' && roundResult.value) {
          return roundResult.value;
        }
      }

      if (attempt < TEXTRACT_POLL_MAX_ATTEMPTS) {
        await sleep(getTextractPollDelayMs(attempt));
      }
    }

    // #region agent log
    ocrDebugLog(
      'ProcessImageScreen.tsx:downloadTextractOutput',
      'Poll exhausted',
      {lastFailureMessage, fileKeys, uploadedKey, maxAttempts: TEXTRACT_POLL_MAX_ATTEMPTS},
      'H2',
    );
    // #endregion
    throw new Error(
      `${lastFailureMessage} (tried: ${fileKeys.join(', ')})`,
    );
  }

  async function runDirectTextractAnalysis(
    uploadedKey: string,
    onProgress?: (message: string) => void,
  ): Promise<OcrDownloadResult> {
    const s3Config = getRequiredS3Config();
    onProgress?.('Running OCR directly on uploaded image…');

    const rawJson = await analyzeDocumentFromS3({
      bucket: s3Config.bucket,
      key: uploadedKey,
      region: s3Config.region,
      accessKeyId: s3Config.accessKey,
      secretAccessKey: s3Config.secretKey,
    });

    const captureMeta = await persistTextractResponse(rawJson, {
      source: 'direct_analyze',
      uploadedKey,
      manufacturer: manuchoice || 'CUSTOM',
    });

    console.log('Direct Textract analysis completed for:', uploadedKey);
    return {kind: 'textract', rawJson, captureMeta};
  }

  async function fetchTextractOutput(
    uploadedKey: string,
    responseKeys: string[],
    onProgress?: (message: string) => void,
  ): Promise<OcrDownloadResult> {
    await sleep(TEXTRACT_INITIAL_WAIT_MS);

    try {
      return await downloadTextractOutput(responseKeys, uploadedKey, onProgress);
    } catch (pollError) {
      console.warn(
        'Async Textract polling failed; falling back to direct AnalyzeDocument:',
        pollError,
      );
      // #region agent log
      ocrDebugLog(
        'ProcessImageScreen.tsx:fetchTextractOutput',
        'Async poll failed, starting direct fallback',
        {
          pollError: getErrorMessage(pollError),
          uploadedKey,
          responseKeys,
        },
        'H4',
      );
      // #endregion
      try {
        const result = await runDirectTextractAnalysis(uploadedKey, onProgress);
        // #region agent log
        ocrDebugLog(
          'ProcessImageScreen.tsx:fetchTextractOutput',
          'Direct fallback succeeded',
          {uploadedKey, jsonBytes: result.rawJson.length},
          'H1',
          'post-fix',
        );
        // #endregion
        return result;
      } catch (directError) {
        // #region agent log
        ocrDebugLog(
          'ProcessImageScreen.tsx:fetchTextractOutput',
          'Direct fallback failed',
          {
            directError: getErrorMessage(directError),
            hasTextDecoder: typeof global.TextDecoder !== 'undefined',
          },
          'H1',
        );
        // #endregion
        const pollMessage = getErrorMessage(pollError);
        const directMessage = getErrorMessage(directError);
        throw new Error(
          `${pollMessage}\n\nDirect Textract fallback also failed: ${directMessage}`,
        );
      }
    }
  }

  const pickSingleImage = async (): Promise<Asset | null> => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 1,
      selectionLimit: 1,
      includeBase64: false,
    });

    if (result.didCancel) {
      return null;
    }

    if (result.errorCode) {
      throw new Error(result.errorMessage || 'Image selection failed');
    }

    const selectedAsset = result.assets?.[0];
    if (!selectedAsset?.uri && !selectedAsset?.originalPath) {
      throw new Error('No image selected');
    }

    return selectedAsset;
  };

  const uploadAssetToS3 = async (selectedAsset: Asset) => {
    const {client, config} = getS3Client();
    const sourceUri = resolveAssetUriForUpload(selectedAsset);
    const localPath = normalizeLocalFilePath(sourceUri);
    const key = buildS3FileName(selectedAsset);
    const contentType = selectedAsset.type || 'image/jpeg';
    const fileExists = await RNFS.exists(localPath);

    if (!fileExists) {
      throw new Error(`Selected image file does not exist at ${sourceUri}`);
    }

    try {
      const uploadPath = await prepareImageForUpload(localPath);
      const uploadStat = await RNFS.stat(uploadPath);
      if (uploadStat.size > MAX_UPLOAD_BYTES * 2) {
        throw new Error(
          `Prepared image is too large (${Math.round(uploadStat.size / 1024 / 1024)}MB). Try a closer photo.`,
        );
      }

      const base64Body = await RNFS.readFile(uploadPath, 'base64');
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: Buffer.from(base64Body, 'base64'),
          ContentType: 'image/jpeg',
        }),
      );
    } catch (err: any) {
      throw new Error(
        `S3 upload threw an exception: ${err?.message ?? JSON.stringify(err)}`,
      );
    }

    return key;
  };

  const handlePickUploadAndProcess = async () => {
    setShowFileSelectionModal(false);
    let uploadedKey: string | null = null;

    try {
      const selectedAsset = await pickSingleImage();
      if (!selectedAsset) {
        return;
      }

      setIsProcessing(true);

      setProcessingMessage('Uploading image…');
      uploadedKey = await uploadAssetToS3(selectedAsset);
      console.log('Image uploaded successfully to S3:', uploadedKey);
      const s3Config = getRequiredS3Config();
      // #region agent log
      ocrDebugLog(
        'ProcessImageScreen.tsx:handlePickUploadAndProcess',
        'S3 upload complete',
        {
          uploadedKey,
          bucket: s3Config.bucket,
          region: s3Config.region,
        },
        'H5',
      );
      // #endregion

      const responseKeys = buildTextractResponseKeys(uploadedKey);
      console.log('Polling Textract response keys:', responseKeys);
      setProcessingMessage('Starting OCR…');

      const output = await fetchTextractOutput(
        uploadedKey,
        responseKeys,
        setProcessingMessage,
      );
      setProcessingMessage('Parsing results…');
      await processImageResult(output.rawJson, output.captureMeta);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error('Image upload flow error:', error);
      const title = 'Error';
      const detail = uploadedKey
        ? `Image uploaded to S3 as ${uploadedKey}, but OCR parsing failed.\n\n${message}`
        : message;
      Alert.alert(title, detail, [{text: 'OK'}]);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('Processing Image...');
    }
  };

  const handleSelectFile2 = async () => {
    await handlePickUploadAndProcess();
  };

  const handleSelectRawFolder = () => {
    setShowFileSelectionModal(false);
    setShowRawFolderModal(true);
  };

  const handleSelectFromDevice = async () => {
    await handlePickUploadAndProcess();
  };

  const handleSelectFolder = (folderName: string) => {
    navigation.navigate('FileListScreen', {folderName: 'Raw Panels'});
    setShowRawFolderModal(false);
  };

  const handleCloseRawFolderModal = () => {
    setShowRawFolderModal(false);
  };

  const handleCloseFileSelectionModal = () => {
    setShowFileSelectionModal(false);
  };

  // Mock raw folder data
  const rawFolders = Array.from({length: 12}, (_, i) => ({
    id: `${i + 1}`,
    name: `03.25.2025 Lot # ${i + 1}`,
    isSelected: false,
  }));

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Icon name="arrow-left" size={24} color={COLORS.PRIMARY} />
          <CustomText variant="medium" style={styles.backText}>
            Go back
          </CustomText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <CustomText variant="medium" style={styles.logoutText}>
            Log out
          </CustomText>
          <Icon name="logout" size={24} color={COLORS.PRIMARY} />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />
    </>
  );

  const handleMenuPress = () => {
    navigation.navigate('AntigenDispSettings');
  };

  const renderContent = () => (
    <>
      <CustomText variant="medium" style={styles.screenTitle}>
        {isProcessing ? 'Processing...' : 'Process Image'}
      </CustomText>
      {/* Option Cards */}
      <View
        style={[
          styles.optionsContainer,
          orientation === 'landscape' && styles.optionsContainerLandscape,
        ]}>
        <CustomText variant="medium" style={styles.midText}>
          {'\n'}
        </CustomText>
      </View>
      <View style={styles.pickercontainer}>
        {/* <View style={[
        styles.optionsContainer,
        orientation === 'landscape' && styles.optionsContainerLandscape
      ]}> */}
        {/* <Text style={styles.fieldText}>Choose a Manufacturer to use as template:</Text>
         */}
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={manuchoice}
            onValueChange={itemValue => setManuChoice(itemValue)}
            style={styles.picker}
            dropdownIconColor="#007AFF">
            <Picker.Item label="Select Manufacturer..." value="" />

            {ConstAntigens.ANTIGEN_MANUFACTURERS.filter(
              manufacturer => manufacturer !== 'Create New',
            ).map((manufacturer, index) => (
              <Picker.Item
                key={`${manufacturer}-${index}`}
                label={manufacturer}
                value={manufacturer}
              />
            ))}
          </Picker>

          {/* The pointerEvents="none" ensures the picker still opens when clicking the icon */}
          {/* <View style={styles.iconOverlay} pointerEvents="none">
            <Text style={styles.chevron}>▼</Text>
          </View> */}
        </View>
        <View
          style={[
            styles.optionsContainer,
            orientation === 'landscape' && styles.optionsContainerLandscape,
          ]}>
          <CustomText variant="medium" style={styles.midText}>
            {'\n'}
          </CustomText>
        </View>

        <View
          style={[
            styles.optionsContainer,
            orientation === 'landscape' && styles.optionsContainerLandscape,
          ]}>
          {/* Select File Card */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              orientation === 'landscape' && styles.optionCardLandscape,
            ]}
            onPress={handleSelectFile2}
            disabled={isProcessing}>
            <Icon
              name="folder-download"
              size={60}
              color={isProcessing ? DISABLED_COLOR : COLORS.TEXT}
            />
            <CustomText
              variant="medium"
              style={[styles.optionText, isProcessing && styles.disabledText]}>
              Select from Files
            </CustomText>
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.optionsContainer,
            orientation === 'landscape' && styles.optionsContainerLandscape,
          ]}>
          <CustomText variant="medium" style={styles.midText}>
            {'\n'}
          </CustomText>
        </View>

        {/* <TouchableOpacity
                  style={styles.menuContainer}
                  onPress={() => handleMenuPress()}>
                <Text style={styles.menuText}>Or Go to Settings of Antigrams</Text>
                </TouchableOpacity> */}
      </View>
    </>
  );

  const renderLoading = () => {
    if (!isProcessing) return null;

    return (
      <Modal visible={isProcessing} transparent={true} animationType="fade">
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            <CustomText variant="medium" style={styles.loadingText}>
              {processingMessage}
            </CustomText>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderContent()}
      {renderLoading()}

      {/* Modals */}
      <Modal
        visible={showFileSelectionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseFileSelectionModal}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <CustomText variant="medium" style={styles.modalTitle}>
                Select Source
              </CustomText>
              <TouchableOpacity onPress={handleCloseFileSelectionModal}>
                <Icon name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptions}>
              {/* RAW Folder Option */}
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleSelectRawFolder}>
                <Icon
                  name="folder-outline"
                  size={24}
                  color="#000"
                  style={styles.modalOptionIcon}
                />
                <CustomText variant="medium" style={styles.modalOptionText}>
                  RAW Folders
                </CustomText>
              </TouchableOpacity>

              {/* Device Files Option */}
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleSelectFromDevice}>
                <Icon
                  name="devices"
                  size={24}
                  color="#000"
                  style={styles.modalOptionIcon}
                />
                <CustomText variant="medium" style={styles.modalOptionText}>
                  Device Files
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRawFolderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseRawFolderModal}>
        <SafeAreaView style={[styles.container, styles.rawFoldersContainer]}>
          <View style={styles.rawFoldersHeader}>
            <TouchableOpacity onPress={handleCloseRawFolderModal}>
              <Icon name="arrow-left" size={24} color="#000" />
            </TouchableOpacity>
            <CustomText variant="medium" style={styles.rawFoldersTitle}>
              RAW Folders
            </CustomText>
            <View style={{width: 24}} />
          </View>

          <ScrollView style={styles.rawFoldersList}>
            {rawFolders.map(folder => (
              <View key={folder.id} style={styles.rawFolderItem}>
                <View style={styles.fileIconContainer}>
                  <Icon name="file-outline" size={24} color="#000" />
                  <CustomText variant="regular" style={styles.fileTypeLabel}>
                    RW
                  </CustomText>
                </View>
                <CustomText variant="regular" style={styles.rawFolderName}>
                  {folder.name}
                </CustomText>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => handleSelectFolder(folder.name)}>
                  <CustomText variant="medium" style={styles.selectButtonText}>
                    SELECT
                  </CustomText>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
    textAlign: 'center',
    marginTop: 10,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center', // Ensures the picker doesn't bleed over border radius
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
    width: '80%',
    color: '#1A1A1A',
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  pickercontainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    width: '100%',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    marginLeft: 5,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    marginRight: 5,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 20,
  },
  screenTitle: {
    fontSize: 24,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    fontFamily: FONTS.POPPINS_BOLD,
  },

  midText: {
    fontSize: 18,
    color: COLORS.TEXT,
    textAlign: 'center',
    fontFamily: FONTS.POPPINS_BOLD,
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  optionsContainerLandscape: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  optionCard: {
    width: '80%',
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  optionCardLandscape: {
    width: '45%',
    marginHorizontal: 10,
  },
  optionText: {
    fontSize: 18,
    color: COLORS.TEXT,
    marginTop: 15,
    textAlign: 'center',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  disabledText: {
    color: DISABLED_COLOR,
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
  menuContainer: {
    width: '80%',
    maxWidth: 400,
    borderRadius: 8,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  menuText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: FONTS.POPPINS_MEDIUM,
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    color: '#000',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  modalOptions: {
    paddingVertical: 10,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionIcon: {
    marginRight: 15,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#000',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  rawFoldersContainer: {
    backgroundColor: '#f5f5f5',
  },
  rawFoldersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  rawFoldersTitle: {
    fontSize: 18,
    color: '#000',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  rawFoldersList: {
    flex: 1,
    padding: 15,
  },
  rawFolderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  fileIconContainer: {
    position: 'relative',
    marginRight: 15,
  },
  fileTypeLabel: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    color: '#666',
  },
  rawFolderName: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    fontFamily: FONTS.POPPINS_REGULAR,
  },
  selectButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 4,
  },
  selectButtonText: {
    color: '#5c8599',
    fontSize: 14,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingContent: {
    width: 180,
    height: 120,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    color: COLORS.TEXT,
    fontSize: 16,
  },
});

export default ProcessImageScreen;
