// Re-exported through a TS module on purpose: Docusaurus merges the TOC of
// .md partials imported *directly* into a doc. On the problem page the sheet
// is hidden behind a toggle, so its headings must not appear in that TOC.
// /reference/cheat-sheets imports the .md partial directly to keep its TOC.
export {default} from '@site/docs/problems/messaging/_chat-system.cheatsheet.md';
