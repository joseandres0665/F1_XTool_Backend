const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { printLabel } = require('./printer/xtool');
const { readFontSettings, writeFontSettings } = require('./utils/settings');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory print queue
const printQueue = [];
let isPrinting = false;
let isFirstPrinting = true;

async function processQueue() {

  if (isPrinting || printQueue.length === 0) return;

  isPrinting = true;
  const job = printQueue.shift();

  try {
    await printLabel(job.name, isFirstPrinting);
    isFirstPrinting = false;     
    console.log(`✅ Printed label for ${job.name}`);
  } catch (error) {
    console.error(`❌ Failed to print label for ${job.name}`, error);
  }

  setTimeout(() => {
    isPrinting = false;
    processQueue();
  }, 1000* 60); // Wait 1s before next job
}

// Function to check if a name is banned
function isNameBanned(name) {
  try {
    const xlsxPath = path.join(__dirname, 'banned_names.xlsx');
    
    // Check if XLSX file exists, fallback to CSV if not
    if (!fs.existsSync(xlsxPath)) {
      // Fallback to CSV for backward compatibility
      const csvPath = path.join(__dirname, 'banned_names.csv');
      if (!fs.existsSync(csvPath)) {
        return false;
      }
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const bannedNames = lines.slice(1).map(line => {
        const nameValue = line.replace(/^"|"$/g, '').trim();
        return nameValue.normalize('NFC');
      });
      return checkNameAgainstList(name, bannedNames);
    }
    
    // Read XLSX file
    const workbook = XLSX.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON array
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Extract banned names (skip header row)
    const bannedNames = data.slice(1)
      .map(row => {
        // Get first column value (name)
        const nameValue = row[0] ? String(row[0]).trim() : '';
        return nameValue.normalize('NFC');
      })
      .filter(nameValue => nameValue.length > 0);
    
    return checkNameAgainstList(name, bannedNames);
  } catch (error) {
    console.error('Error reading banned names file:', error);
    // If file doesn't exist or can't be read, allow all names
    return false;
  }
}

// Helper function to check name against banned list
function checkNameAgainstList(name, bannedNames) {
  // Normalize input name for comparison
  const normalizedName = name.normalize('NFC');
  
  // Check exact match (case-insensitive only for Latin characters)
  // For Arabic, we do exact match after normalization
  const isLatin = /^[a-zA-Z0-9\s]+$/.test(name);
  if (isLatin) {
    return bannedNames.some(banned => banned.toLowerCase() === normalizedName.toLowerCase());
  } else {
    // For Arabic and other non-Latin scripts, do exact match
    return bannedNames.includes(normalizedName);
  }
}

// GET current settings
app.get('/api/font-settings', (req, res) => {
  const settings = readFontSettings();
  res.json(settings);
});

// POST to update settings
app.post('/api/font-settings', (req, res) => {
  const { fontFamily, fontSize, x, y } = req.body;

  const settings = readFontSettings();

  if (typeof fontFamily === 'string') settings.fontFamily = fontFamily;
  if (typeof fontSize === 'number') settings.fontSize = fontSize;
  if (typeof x === 'number') settings.x = x;
  if (typeof y === 'number') settings.y = y;

  writeFontSettings(settings);

  res.json({ success: true, fontSettings: settings });
});

// API to check if a name is valid to print
app.post('/api/check', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  const isBanned = isNameBanned(name);
  const isValid = !isBanned;

  res.status(200).json({ valid: isValid });
});

// API to add print job to queue
app.post('/api/print', async (req, res) => {
  const { first_name, second_name } = req.body;

  if (!first_name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  printQueue.push({ name: first_name });

  if(second_name)
    printQueue.push({name: second_name});
  processQueue();

  res.status(200).json({ message: 'Print job queued successfully' });
});

app.post('/api/print_excel', async (req, res) => {
  const { names } = req.body;

  if (!names) {
    return res.status(400).json({ message: 'Names is required' });
  }

  names.forEach(name => {
    printQueue.push({ name });
  });
  processQueue();

  res.status(200).json({ message: 'Print jobs queued successfully' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🖨️  Share A Coke backend running at http://localhost:${PORT}`);
});