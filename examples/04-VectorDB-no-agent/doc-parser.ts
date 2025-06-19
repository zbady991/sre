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

    //parse the pdf document
    let sTime = performance.now();

    const parsedPDFDoc = await Doc.pdf.parse(pdfFilePath);
    let eTime = performance.now();
    console.log(`PDF parsing took ${eTime - sTime}ms`);
    console.log(parsedPDFDoc);

    sTime = performance.now();
    await Doc.pdf.parse(pdfFilePath);
    eTime = performance.now();
    console.log(`2nd PDF parsing took ${eTime - sTime}ms`);

    //initialize and parse in one line
    const parsedDocxDoc = await Doc.docx.parse(docxFilePath);
    console.log(parsedDocxDoc);

    //initialize and parse markdown file in one line, with custom metadata
    const parsedMarkdownDoc = await Doc.md.parse(markdownFilePath, {
        title: 'Bitcoin',
        author: 'Satoshi Nakamoto',
        date: '2009-01-03',
        tags: ['bitcoin', 'crypto', 'blockchain'],
    });
    console.log(parsedMarkdownDoc);

    //initialize and parse text file in one line, with custom metadata
    const parsedTxtDoc = await Doc.text.parse(txtFilePath, {
        title: 'Bitcoin',
        author: 'Satoshi Nakamoto',
        date: '2009-01-03',
        tags: ['bitcoin', 'crypto', 'blockchain'],
    });
    console.log(parsedTxtDoc);

    //parse a string
    const stringContent = fs.readFileSync(txtFilePath, 'utf8');
    const parsedString = await Doc.text.parse(stringContent, {
        title: 'Bitcoin',
        author: 'Satoshi Nakamoto',
        date: '2009-01-03',
        tags: ['bitcoin', 'crypto', 'blockchain'],
    });
    console.log(parsedString);
}

main();
