import axios from 'axios';
import RNFS from 'react-native-fs';
import { PanelData } from '../types';

export class ReportGeneratorService {
    private apiKey: string;
    private templateUrl: string;

    constructor(apiKey: string, templateUrl: string) {
        this.apiKey = apiKey;
        this.templateUrl = templateUrl; // Your hosted template URL
    }

    //     private generatePrompt(panelData: PanelData): string {
    //         const cellData = panelData.cells.map(cell => {
    //             const results = Object.entries(cell.results)
    //                 .map(([antigen, result]) => `${antigen}: ${result}`)
    //                 .join(', ');

    //             return `Row ${cell.rowNumber}: Cell ID ${cell.cellId}, Donor ${cell.donorNumber}
    // Results: ${results}`;
    //         }).join('\n');

    //         return `Edit this antibody panel template image by replacing its data with the following values while maintaining the exact same format and layout:

    // 1. Header Information:
    // - Expiration Date: ${panelData.metadata.expirationDate}
    // - Manufacturer: ${panelData.metadata.manufacturer}
    // - Current Date/Time: ${new Date().toLocaleString()}
    // - Keep all other header elements unchanged

    // 2. Cell Data (replace existing values only):
    // ${cellData}

    // IMPORTANT REQUIREMENTS:
    // 1. Keep EXACT same layout and design
    // 2. Maintain all grid lines, borders, and cell sizes
    // 3. Keep yellow highlighting in "Patient Cells" row
    // 4. Preserve all font styles and sizes
    // 5. Maintain precise alignment of all values
    // 6. Keep the antibodycheck logo unchanged
    // 7. Preserve all column headers and groupings
    // 8. Keep exact same spacing and margins

    // Only edit the actual data values (+, 0, n) in the cells and the specified header information. Everything else must remain identical to the template.`;
    //     }
    private generatePrompt(panelData: PanelData): string {

        return `Using this antibody panel report template as reference, create an identical image with the following data updates.

Reference Image: ${this.templateUrl}
Create an identical antibody panel report matching this template image EXACTLY, but with the following data:

CRITICAL: The output must be an EXACT copy of the template's layout and design, including:
1. The "antibodycheck" logo at top left
2. All input fields (Patient ID, Conclusion, Tech)
3. The exact grid structure with all lines and borders
4. Yellow highlighted "Patient Cells" row
5. All column headers and groupings (Rh-hr, KELL, DUFFY, etc.)
6. The timestamp and version number format

Replace these specific elements:
1. Header Information:
- Exp. Date: ${panelData.metadata.expirationDate}
- Vendor: ${panelData.metadata.manufacturer}
- VSS Number: ${panelData.metadata.lotNumber}
- Current Time: ${new Date().toLocaleString()}

2. Cell Data (maintaining exact positioning):
${panelData.cells}

3. Keep "Homozygous Totals" row with all "0" values

STRICT FORMATTING REQUIREMENTS:
1. Match template's borders, lines, and cell sizes EXACTLY
2. Use identical fonts and text positioning
3. Maintain precise spacing between all elements
4. Keep all column widths and row heights the same
5. Position "+" and "0" "n" values exactly as shown in template
6. Preserve all headers and subheaders (including a/b divisions)
7. Keep all cell alignments identical
8. Maintain exact yellow highlighting color

The final image must be indistinguishable from the template in terms of layout and formatting - only the specified data values should differ.`;
    }

    async generateReport(panelData: PanelData): Promise<string> {
        try {
            console.log('Starting report generation');

            // Generate new image using DALL-E 3
            const response = await axios.post(
                'https://api.openai.com/v1/images/generations',  // Changed endpoint
                {
                    model: "dall-e-3",
                    prompt: this.generatePrompt(panelData),
                    n: 1,
                    size: "1024x1024",
                    quality: "hd",
                    style: "natural",
                    response_format: "b64_json"
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Image generated successfully');

            // Save the image
            const timestamp = Date.now();
            const fileName = `antibody_report_${timestamp}.png`;
            const filePath = `${RNFS.ExternalStorageDirectoryPath}/${fileName}`;

            await RNFS.writeFile(
                filePath,
                response.data.data[0].b64_json,
                'base64'
            );
            // const imageUrl = response.data.data[0].url;

            console.log('File saved:', filePath);
            return filePath;

        } catch (error) {
            console.error('Error generating report:', error);
            throw error;
        }
    }
}