import { DocParser, TDocumentParseSettings } from './DocParser.class';
import { PDFParser } from './parsers/PDFParser.class';
import { DOCXParser } from './parsers/DOCXParser.class';
import { MarkdownParser } from './parsers/MarkdownParser.class';
import { TextParser } from './parsers/TextParser.class';

const BuiltinDocParsers: Record<string, DocParser> = {
    pdf: new PDFParser(),
    docx: new DOCXParser(),
    md: new MarkdownParser(),
    text: new TextParser(),
};
export type TDocType = keyof typeof BuiltinDocParsers;

// Extensible interface for custom providers
export interface IDocParsers {}
// Combined provider type that can be extended
export type TDocParser = TDocType | keyof IDocParsers;

export type TDocParserFactory = {
    [K in TDocParser]: DocParser;
};

const Doc = {} as TDocParserFactory;

for (const type of Object.keys(BuiltinDocParsers) as TDocParser[]) {
    const key = type as TDocParser;
    Doc[key] = BuiltinDocParsers[type];
}

export { Doc };
