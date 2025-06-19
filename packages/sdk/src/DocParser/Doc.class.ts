import { DocParser } from './DocParser.class';
import { DOCXParser } from './parsers/DOCXParser.class';
import { MarkdownParser } from './parsers/MarkdownParser.class';
import { PDFParser } from './parsers/PDFParser.class';
import { TextParser } from './parsers/TextParser.class';

export const Doc = {
    pdf: new PDFParser(),
    docx: new DOCXParser(),
    md: new MarkdownParser(),
    text: new TextParser(),
};

export type TDocType = keyof typeof Doc;

// Extensible interface for custom providers
export interface IDocParsers {}
// Combined provider type that can be extended
export type TDocParser = TDocType | keyof IDocParsers;

export type TDocParserFactory = {
    [K in TDocParser]: DocParser;
};

// This ensures that Doc is compatible with the factory type,
// which is useful for module augmentation.
const _: TDocParserFactory = Doc;
