import { useMemo } from 'react';
import { Dimensions, useWindowDimensions } from 'react-native';
import { AntigenGroups } from '../types';

const DEFAULT_ADDITIONAL_CELL_COUNT = 3;
const MIN_ANTIGEN_WIDTH = 16;

export const calculateTableDimensions = (
    antigenGroups: AntigenGroups,
    additionalCellCount?: number,
    viewport?: { width: number; height: number }
) => {
    const { width: screenWidth, height: screenHeight } = viewport ?? Dimensions.get('window');
    // Calculate total number of columns
    const totalAntigens = Object.values(antigenGroups)
        .reduce((sum, antigens) => sum + antigens.length, 0);

    const tableWidth = (screenWidth > screenHeight ? screenWidth : screenHeight);
    const safeAdditionalCellCount = Number.isFinite(additionalCellCount) && additionalCellCount! > 0
        ? additionalCellCount!
        : DEFAULT_ADDITIONAL_CELL_COUNT;
    const totalColumns = Math.max(totalAntigens + safeAdditionalCellCount, 1);

    // Calculate width for each antigen column
    const antigenWidth = tableWidth / totalColumns;

    // Ensure minimum widths
    const finalAntigenWidth = Math.max(antigenWidth, MIN_ANTIGEN_WIDTH);

    return {
        cellNumberWidth: finalAntigenWidth,
        donorIdWidth: finalAntigenWidth * 3,
        resultWidth: finalAntigenWidth,
        antigenWidth: finalAntigenWidth,
        totalWidth: tableWidth,
        totalAntigens,
    };
};

export const useTableDimensions = (antigenGroups: AntigenGroups, additionalCellCount?: number) => {
    const { width, height } = useWindowDimensions();

    return useMemo(() =>
        calculateTableDimensions(antigenGroups, additionalCellCount, { width, height }),
        [width, height, antigenGroups, additionalCellCount]
    );
};
