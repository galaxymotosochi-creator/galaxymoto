const fs = require("fs");
const html = fs.readFileSync("admin.html","utf8");
const start = html.lastIndexOf("<script>");
const end = html.lastIndexOf("</script>");
const js = html.substring(start + 8, end);

let inString = false;
let stringChar = null;
for(let i = 0; i < js.length; i++) {
  const ch = js[i];
  const prev = i > 0 ? js[i-1] : null;
  if(inString) {
    if(ch === stringChar && prev !== "\\") {
      inString = false;
    }
  } else {
    if(ch === "\"" || ch === "'" || ch === "\`") {
      inString = true;
      stringChar = ch;
    } else if(ch === "<") {
      console.log("Found < outside string at", i);
      console.log("Context:", JSON.stringify(js.substring(Math.max(0,i-50), i+50)));
      break;
    }
  }
}
console.log("Search complete");
