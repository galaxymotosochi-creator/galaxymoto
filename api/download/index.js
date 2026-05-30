export default function handler(req, res) {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(process.cwd(), 'cam.py');
  const content = fs.readFileSync(filePath, 'utf-8');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cam.py"');
  res.status(200).send(content);
}
