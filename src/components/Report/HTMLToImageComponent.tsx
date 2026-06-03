import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import ViewShot from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import { PanelData } from '../../types';

interface HTMLToImageComponentProps {
  templateHtml: string;
  screenPanel: PanelData;
  idPanel: PanelData;
  formData: {
    patientId: string;
    conclusion: string;
    tech: string;
    notes: string;
  };
  includeRuledOut: boolean;
  onImageGenerated: (path: string) => void;
  onError: (error: string) => void;
}

const processTemplate = (
  templateHtml: string,
  screenPanel: PanelData,
  idPanel: PanelData,
  formData: HTMLToImageComponentProps['formData'],
  includeRuledOut: boolean
): string => {
  let html = templateHtml;

  try {
    // Replace form data
    const formReplacements = {
      'patientID': formData.patientId,
      'conclusion': formData.conclusion,
      'tech': formData.tech,
      'notes': formData.notes
    };

    Object.entries(formReplacements).forEach(([field, value]) => {
      const inputRegex = new RegExp(`<input[^>]*name="${field}"[^>]*>`, 'g');
      const textareaRegex = new RegExp(`<textarea[^>]*name="${field}"[^>]*>.*?</textarea>`, 'g');

      html = html.replace(inputRegex, `<input type="text" name="${field}" class="${field}" value="${value}" readonly>`);
      html = html.replace(textareaRegex, `<textarea name="${field}" class="${field}" readonly>${value}</textarea>`);
    });

    // Process panel data
    const processPanelRows = (panel: PanelData) => {
      const cells = panel.cells;
      return cells.map((cell, idx) => {
        return `
          <tr id="row${panel.metadata.lotNumber}_${cell.donorNumber}" class="donorRow" data-donor-id="${cell.donorNumber}" data-spannedovercols="2">
            <td>${idx + 1}</td>
            <td>${cell.cellId}</td>
            <td>${cell.donorNumber}</td>
            <!-- Rh-hr -->
            <td data-col="0" class="antibody matchable">${cell.results['D'] || ''}</td>
            <td data-col="1" class="antibody matchable">${cell.results['C'] || ''}</td>
            <td data-col="2" class="antibody matchable">${cell.results['E'] || ''}</td>
            <td data-col="3" class="antibody matchable">${cell.results['c'] || ''}</td>
            <td data-col="4" class="antibody matchable">${cell.results['e'] || ''}</td>
            <td data-col="5" class="antibody matchable">${cell.results['f'] || ''}</td>
            <td data-col="6" class="antibody matchable">${cell.results['Cw'] || ''}</td>
            <td data-col="7" class="antibody matchable endProtein">${cell.results['V'] || ''}</td>
            <!-- Kell -->
            <td data-col="8" class="antibody matchable">${cell.results['K'] || ''}</td>
            <td data-col="9" class="antibody matchable">${cell.results['k'] || ''}</td>
            <td data-col="10" class="antibody matchable">${cell.results['Kpa'] || ''}</td>
            <td data-col="11" class="antibody matchable">${cell.results['Kpb'] || ''}</td>
            <td data-col="12" class="antibody matchable">${cell.results['Jsa'] || ''}</td>
            <td data-col="13" class="antibody matchable endProtein">${cell.results['Jsb'] || ''}</td>
            <!-- Duffy -->
            <td data-col="14" class="antibody matchable">${cell.results['Fya'] || ''}</td>
            <td data-col="15" class="antibody matchable endProtein">${cell.results['Fyb'] || ''}</td>
            <!-- Kidd -->
            <td data-col="16" class="antibody matchable">${cell.results['Jka'] || ''}</td>
            <td data-col="17" class="antibody matchable endProtein">${cell.results['Jkb'] || ''}</td>
            <!-- Sex Linked -->
            <td data-col="18" class="antibody matchable endProtein">${cell.results['Xga'] || ''}</td>
            <!-- Lewis -->
            <td data-col="19" class="antibody matchable">${cell.results['Lea'] || ''}</td>
            <td data-col="20" class="antibody matchable endProtein">${cell.results['Leb'] || ''}</td>
            <!-- MNS -->
            <td data-col="21" class="antibody matchable">${cell.results['S'] || ''}</td>
            <td data-col="22" class="antibody matchable">${cell.results['s'] || ''}</td>
            <td data-col="23" class="antibody matchable">${cell.results['M'] || ''}</td>
            <td data-col="24" class="antibody matchable endProtein">${cell.results['N'] || ''}</td>
            <!-- P -->
            <td data-col="25" class="antibody matchable endProtein">${cell.results['P1'] || ''}</td>
            <!-- Lutheran -->
            <td data-col="26" class="antibody matchable">${cell.results['Lua'] || ''}</td>
            <td data-col="27" class="antibody matchable endProtein">${cell.results['Lub'] || ''}</td>
            <td class="emptyCol customizable preResultsClickable alreadyCustomizable" colspan="3">
                <span></span><input class="customInput" type="text" value="">
            </td>
            <td>${idx + 1}</td>
            <td data-click-id="Or_${cell.donorNumber}_0" 
                class="moveLR clickableCell moveAll impactsTotals phaseContextMenu phasesOnly cellIS alreadyClickable" 
                id="cellIs_0_${idx}" style="display: none;"><span></span></td>
            <td data-click-id="Or_${cell.donorNumber}_1" 
                class="moveLR clickableCell moveAll impactsTotals phaseContextMenu phasesOnly cell37 alreadyClickable" 
                id="cell37_0_${idx}" style="display: none;"><span></span></td>
            <td data-click-id="Or_${cell.donorNumber}_2" 
                class="moveLR clickableCell moveAll impactsTotals customizable ahg moveAll alreadyClickable alreadyCustomizable" 
                id="d${panel.metadata.lotNumber}_${cell.donorNumber}"><span></span>${cell.results['result'] || ''}</td>
            <td data-click-id="Or_${cell.donorNumber}_3" 
                class="moveLR clickableCell moveAll impactsTotals fullContextMenu phasesOnly cellCC alreadyClickable" 
                id="cellCc_0_${idx}" style="display: none;"><span></span></td>
            <td class="specialTypes" id="spType0_${idx}" title=""></td>
          </tr>
        `;
      }).join('');
    };

    // Process panel headers
    const generatePanelHeaders = (panel: PanelData) => {
      return `
        <tr class="panelHeadings">
          <th colspan="3" class="rowspan lotInfo">
            <span>0.8% ${panel.metadata.panelType}<br>
            ${panel.metadata.lotNumber}<br>
            <em class="inlineExpDates">${panel.metadata.expirationDate}</em></span>
          </th>
          <th class="headerCell rowspan">D</th>
          <th class="headerCell rowspan">C</th>
          <th class="headerCell rowspan">E</th>
          <th class="headerCell rowspan">c</th>
          <th class="headerCell rowspan">e</th>
          <th class="headerCell rowspan">f</th>
          <th class="headerCell rowspan">C<sup>w</sup></th>
          <th class="headerCell endProtein rowspan">V</th>
          <th class="headerCell rowspan">K</th>
          <th class="headerCell rowspan">k</th>
          <th class="headerCell" colspan="2">Kp</th>
          <th class="headerCell endProtein" colspan="2">Js</th>
          <th class="headerCell endProtein" colspan="2">Fy</th>
          <th class="headerCell endProtein" colspan="2">Jk</th>
          <th class="headerCell endProtein">Xg</th>
          <th class="headerCell endProtein" colspan="2">Le</th>
          <th class="headerCell rowspan">S</th>
          <th class="headerCell rowspan">s</th>
          <th class="headerCell rowspan">M</th>
          <th class="headerCell endProtein rowspan">N</th>
          <th class="headerCell endProtein rowspan">P<sub>1</sub></th>
          <th class="headerCell endProtein" colspan="2">Lu</th>
          <th class="top contractForPhases rowspan" colspan="5">&nbsp;</th>
          <th class="phasesOnly rowspan" style="display: none;"><span class="phaseHeader">IS</span></th>
          <th class="phasesOnly rowspan" style="display: none;"><span class="phaseHeader">37</span></th>
          <th class="phasesOnly rowspan" style="display: none;"><span class="phaseHeader">AHG</span></th>
          <th class="phasesOnly rowspan" style="display: none;"><span class="phaseHeader">CC</span></th>
          <th class="specialTypes noBorder rowspan">&nbsp;</th>
        </tr>
        <tr class="panelHeadings">
          <td colspan="3" class="rowspanned">&nbsp;</td>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell endProtein rowspanned">&nbsp;</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell subHeaderCell firstSubHeaderCell">a</th>
          <th class="subHeaderCell lastHeaderCell">b</th>
          <th class="headerCell subHeaderCell firstSubHeaderCell">a</th>
          <th class="subHeaderCell lastHeaderCell endProtein">b</th>
          <th class="headerCell subHeaderCell firstSubHeaderCell">a</th>
          <th class="subHeaderCell lastHeaderCell endProtein">b</th>
          <th class="headerCell subHeaderCell firstSubHeaderCell">a</th>
          <th class="subHeaderCell lastHeaderCell endProtein">b</th>
          <th class="headerCell subHeaderCell firstSubHeaderCell lastHeaderCell endProtein">a</th>
          <th class="headerCell subHeaderCell firstSubHeaderCell">a</th>
          <th class="subHeaderCell lastHeaderCell endProtein">b</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell rowspanned">&nbsp;</th>
          <th class="headerCell endProtein rowspanned">&nbsp;</th>
          <th class="headerCell endProtein rowspanned">&nbsp;</th>
          <th class="headerCell subHeaderCell firstSubHeaderCell">a</th>
          <th class="subHeaderCell lastHeaderCell endProtein">b</th>
          <th class="top contractForPhases rowspanned" colspan="5">&nbsp;</th>
          <th class="phasesOnly rowspanned" style="display: none;"></th>
          <th class="phasesOnly rowspanned" style="display: none;"></th>
          <th class="phasesOnly rowspanned" style="display: none;"></th>
          <th class="phasesOnly rowspanned" style="display: none;"></th>
          <td class="specialTypes rowspanned">&nbsp;</td>
        </tr>
      `;
    };

    // Replace screen panel data
    const screenTableRegex = /<tbody class="lotBody"[^>]*>[\s\S]*?<\/tbody>/;
    const screenPanelHtml = `
      <tbody class="lotBody" data-panelid="${screenPanel.metadata.lotNumber}">
        ${generatePanelHeaders(screenPanel)}
        ${processPanelRows(screenPanel)}
      </tbody>
    `;
    html = html.replace(screenTableRegex, screenPanelHtml);

    // Add ID panel after screen panel
    const idPanelHtml = `
      <tbody class="lotBody" data-panelid="${idPanel.metadata.lotNumber}">
        ${generatePanelHeaders(idPanel)}
        ${processPanelRows(idPanel)}
      </tbody>
    `;

    // Insert ID panel after screen panel
    html = html.replace('</tbody>', `</tbody>${idPanelHtml}`);

    // Update current date
    const expDateRegex = /<div class="expDate">Exp\. Date: <span>.*?<\/span><\/div>/;
    html = html.replace(
      expDateRegex,
      `<div class="expDate">Exp. Date: <span>${screenPanel.metadata.expirationDate}</span></div>`
    );

    // Replace current date with formatted date
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const currentDateRegex = /<div id="currentDate">.*?<\/div>/;
    html = html.replace(
      currentDateRegex,
      `<div id="currentDate">${formattedDate}</div>`
    );

    return html;
  } catch (error) {
    console.error('Error processing template:', error);
    throw error;
  }
};

interface HTMLToImageRef {
  saveImage: () => void;
}

export const HTMLToImageComponent = forwardRef<HTMLToImageRef, HTMLToImageComponentProps>(({
  templateHtml,
  screenPanel,
  idPanel,
  formData,
  includeRuledOut,
  onImageGenerated,
  onError,
}: any, ref: any) => {
  const viewShotRef = useRef<ViewShot>(null);
  const [processedHtml, setProcessedHtml] = useState<string>('');

  useEffect(() => {
    try {
      const html = processTemplate(templateHtml, screenPanel, idPanel, formData, includeRuledOut);
      setProcessedHtml(html);
    } catch (error) {
      console.error('Error processing template:', error);
      onError('Failed to process template');
    }
  }, [templateHtml, screenPanel, idPanel, formData, includeRuledOut]);

  const handleSaveToImage = async () => {
    try {
      if (!viewShotRef.current) throw new Error('ViewShot ref not available');

      const uri = await viewShotRef.current?.capture?.();
      const fileName = `antibody_report_${Date.now()}.png`;
      const filePath = `${RNFS.ExternalStorageDirectoryPath}/${fileName}`;

      await RNFS.copyFile(uri!, filePath);
      onImageGenerated(filePath);
    } catch (error) {
      console.error('Failed to save image:', error);
      onError('Failed to save report image');
    }
  };

  // Expose the handleSaveToImage function to the parent component
  useImperativeHandle(ref, () => ({
    saveImage: handleSaveToImage,
  }));

  return (
    <View style={styles.container}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'png', quality: 1.0 }}
        style={styles.viewShot}
      >
        <WebView
          source={{ html: processedHtml }}
          style={styles.webview}
          scrollEnabled={true}
          originWhitelist={['*']}
          onLoadEnd={() => console.log('WebView loaded')}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
        />
      </ViewShot>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  viewShot: {
    flex: 1,
    backgroundColor: 'white',
  },
  webview: {
    flex: 1,
    backgroundColor: 'white',
  }
});