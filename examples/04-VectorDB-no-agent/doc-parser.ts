import { Doc } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

async function main() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pdfFilePath = path.join(__dirname, '../files/bitcoin.pdf');
    const docxFilePath = path.join(__dirname, '../files/bitcoin.docx');
    const txtFilePath = path.join(__dirname, '../files/bitcoin.txt');
    const markdownFilePath = path.join(__dirname, '../files/bitcoin.md');

    //Initialize the pdf parser
    const pdfDoc = Doc.pdf(pdfFilePath);
    //parse the pdf document
    const parsedPDFDoc = await pdfDoc.parse();
    console.log(parsedPDFDoc);

    //initialize and parse in one line
    const parsedDocxDoc = await Doc.docx(docxFilePath).parse();
    console.log(parsedDocxDoc);

    //initialize and parse markdown file in one line, with custom metadata
    const parsedMarkdownDoc = await Doc.md(markdownFilePath, {
        title: 'Bitcoin',
        author: 'Satoshi Nakamoto',
        date: '2009-01-03',
        tags: ['bitcoin', 'crypto', 'blockchain'],
    }).parse();
    console.log(parsedMarkdownDoc);

    //initialize and parse text file in one line, with custom metadata
    const parsedTxtDoc = await Doc.text(txtFilePath, {
        title: 'Bitcoin',
        author: 'Satoshi Nakamoto',
        date: '2009-01-03',
        tags: ['bitcoin', 'crypto', 'blockchain'],
    }).parse();
    console.log(parsedTxtDoc);

    //parse a string
    const stringContent = fs.readFileSync(txtFilePath, 'utf8');
    const parsedString = await Doc.text(stringContent, {
        title: 'Bitcoin',
        author: 'Satoshi Nakamoto',
        date: '2009-01-03',
        tags: ['bitcoin', 'crypto', 'blockchain'],
    }).parse();
    console.log(parsedString);
}

main();
