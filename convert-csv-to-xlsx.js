const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read CSV file
const csvPath = path.join(__dirname, 'banned_names.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV
const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
const data = lines.map(line => {
  // Handle CSV with quotes or without
  const nameValue = line.replace(/^"|"$/g, '').trim();
  return [nameValue];
});

// Create workbook and worksheet
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(data);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Banned Names');

// Write XLSX file
const xlsxPath = path.join(__dirname, 'banned_names.xlsx');
XLSX.writeFile(workbook, xlsxPath);

console.log(`✅ Successfully converted ${csvPath} to ${xlsxPath}`);
console.log(`   Total rows: ${data.length}`);

