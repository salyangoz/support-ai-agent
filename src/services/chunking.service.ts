import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
  chunkSize: 1000,
  chunkOverlap: 200,
});

export async function chunkText(text: string): Promise<string[]> {
  const docs = await splitter.createDocuments([text]);
  return docs.map((doc) => doc.pageContent);
}
