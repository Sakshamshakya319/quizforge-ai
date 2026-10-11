import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';

// Configure the pdfjs worker using the local bundled asset
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const parseDocument = async (file) => {
  const extension = file.name.split('.').pop().toLowerCase();
  
  try {
    if (extension === 'pdf') {
      return await parsePdf(file);
    } else if (extension === 'docx') {
      return await parseDocx(file);
    } else if (extension === 'pptx') {
      return await parsePptx(file);
    } else if (extension === 'doc' || extension === 'ppt') {
      throw new Error(`Legacy ${extension.toUpperCase()} files are not directly supported in the browser. Please convert to DOCX/PPTX or PDF.`);
    } else {
      throw new Error(`Unsupported file format: ${extension}`);
    }
  } catch (error) {
    console.error('Error parsing document:', error);
    throw new Error(error.message || 'Failed to parse document');
  }
};

const parsePdf = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    let pageText = '';
    let lastY = null;
    
    for (const item of textContent.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        pageText += '\n';
      } else if (lastY !== null && item.str.trim() !== '') {
        pageText += ' '; // Add space between words on same line
      }
      pageText += item.str;
      lastY = item.transform[5];
      
      if (item.hasEOL) {
        pageText += '\n';
        lastY = null;
      }
    }
    
    fullText += `[Page ${i}]\n${pageText}\n\n`;
  }
  
  // If the extracted text is suspiciously short (e.g., scanned PDF without OCR)
  if (fullText.trim().length < 50 && pdf.numPages > 0) {
    throw new Error('This PDF appears to be scanned or image-based without OCR text. Please use an OCR tool first or upload a text-based document.');
  }
  
  return fullText;
};

/**
 * parseDocx — paragraph-preserving DOCX extractor.
 *
 * Strategy: parse word/document.xml directly with JSZip.
 *
 * Why not mammoth.extractRawText?
 *   mammoth joins all text runs inside a <w:p> with no separator,
 *   so options stored on "soft line breaks" (<w:br/>) get concatenated
 *   into one string: "A. OptionAB. OptionBC. OptionCD. OptionD".
 *
 * This extractor:
 *   - Treats every <w:p> as a paragraph boundary (hard newline in output).
 *   - Treats every <w:br/> as a soft line break (\n within the paragraph).
 *   - Decodes XML entities in text nodes.
 *   - Strips all other XML markup.
 *   - Skips header/footer and styles XML — only parses word/document.xml.
 */
const parseDocx = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('Invalid DOCX: word/document.xml not found inside the archive.');
  }
  
  const docXml = await docFile.async('string');
  
  const paragraphLines = extractParagraphLines(docXml);
  
  if (paragraphLines.length === 0) {
    throw new Error('No readable text could be extracted from this DOCX file.');
  }
  
  // Join paragraphs with double newline so the question extractor can
  // identify paragraph boundaries cleanly.
  return paragraphLines.join('\n');
};

/**
 * extractParagraphLines(xml)
 *
 * Parses word/document.xml and returns an array of strings, one per
 * logical paragraph. Soft line breaks (<w:br/>) within a paragraph
 * become \n characters inside the string.
 *
 * XML entity references (&amp; &lt; &gt; &apos; &quot;) are decoded.
 */
function extractParagraphLines(xml) {
  const lines = [];

  // Match every <w:p ...>...</w:p> block
  // Using non-greedy [\s\S]*? with explicit close tag
  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;

  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const paraXml = paraMatch[0];
    const paraText = extractParaText(paraXml);
    if (paraText.trim()) {
      lines.push(paraText);
    }
  }

  return lines;
}

/**
 * extractParaText(paraXml)
 *
 * Given the raw XML of one <w:p> element, returns the combined text
 * where:
 *   <w:t>text</w:t>      → "text"
 *   <w:br/>              → "\n"  (soft line break)
 *   anything else        → ignored
 */
function extractParaText(paraXml) {
  let text = '';

  // Match <w:t>, <w:t xml:space="preserve">, and <w:br .../>
  // We process them in document order using exec in a loop.
  const tokenRegex = /<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:br[^/]*/g;
  let m;

  while ((m = tokenRegex.exec(paraXml)) !== null) {
    const tok = m[0];
    if (tok.startsWith('<w:br')) {
      text += '\n';
    } else {
      // <w:t ...>content</w:t>
      const inner = tok.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
      text += decodeXmlEntities(inner);
    }
  }

  return text;
}

/**
 * Decode the five standard XML entities and numeric character references.
 */
function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g,   (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

const parsePptx = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  let fullText = '';
  
  const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
  
  // Sort slides properly (slide1.xml, slide2.xml, etc.)
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
    const numB = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
    return numA - numB;
  });
  
  for (const [index, slideFile] of slideFiles.entries()) {
    const content = await zip.file(slideFile).async('string');
    // Extract text from XML (a:t tags usually contain the text)
    const matches = content.match(/<a:t>([\s\S]*?)<\/a:t>/g);
    if (matches) {
      const slideText = matches.map(match => match.replace(/<\/?a:t>/g, '')).join(' ');
      fullText += `[Slide ${index + 1}]\n${slideText}\n\n`;
    }
  }
  
  return fullText;
};
