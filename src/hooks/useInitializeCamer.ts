import { useEffect, useState } from 'react';
import { check, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Platform } from 'react-native';

export const useInitializeCamera = () => {
    const [hasPermission, setHasPermission] = useState(false);

    useEffect(() => {
        const getPermission = async () => {
            try {
                // Check Camera Permission
                const cameraStatus = await check(
                    Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA
                );

                setHasPermission(cameraStatus === RESULTS.GRANTED);

            } catch (error) {
                console.error('Permission check error:', error);
            }
        };

        getPermission();
    }, []);

    return hasPermission;
};
