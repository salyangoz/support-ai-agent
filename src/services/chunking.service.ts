import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: [
    // Markdown structure first
    '\n## ',    // H2 headings
    '\n### ',   // H3 headings
    '\n#### ',  // H4 headings
    '\n\n',     // Paragraphs
    '\n',       // Line breaks
    // Sentence boundaries
    '. ',
    '.\n',
    '? ',
    '?\n',
    '! ',
    '!\n',
    // Last resort
    ' ',
    '',
  ],
});

export async function chunkText(text: string): Promise<string[]> {
  const docs = await splitter.createDocuments([text]);
  return docs.map((doc) => doc.pageContent);
}
