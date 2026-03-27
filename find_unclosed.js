const fs = require('fs');
const content = fs.readFileSync('/Users/happyfvneral/Downloads/imperosgrullo/src/App.tsx', 'utf8');
const lines = content.split('\n');

let openTags = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Simplistic matching for this specific file format
  const opens = (line.match(/<div(\s|>)/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
  
  const netOpens = opens - selfCloses;
  
  if (netOpens > 0) {
    for(let j=0; j<netOpens; j++) openTags.push(i + 1);
  }
  if (closes > 0) {
    for(let j=0; j<closes; j++) {
      if (openTags.length > 0) {
        openTags.pop();
      } else {
        console.log("Extra closing tag at line:", i + 1);
      }
    }
  }
}
console.log("Unclosed tags opened at lines:", openTags);
