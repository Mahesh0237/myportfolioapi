const fs = require('fs');
const path = require('path');

// Set the uploads directory path (relative to the project root)
const uploadsPath = path.join(__dirname, '../uploads');

function deleteEmptyFolders(directory = uploadsPath) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      deleteEmptyFolders(fullPath); // Recursive call

      if (fs.readdirSync(fullPath).length === 0) {
        fs.rmdirSync(fullPath);
      }
    }
  }
}

module.exports = deleteEmptyFolders;